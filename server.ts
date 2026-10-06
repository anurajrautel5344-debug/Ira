import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { GoogleGenAI, ThinkingLevel, GenerateVideosOperation } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// Serve public static assets (favicon.ico, manifest, icons) first
app.use(express.static(path.resolve(__dirname, 'public')));

// Middleware for parsing JSON with large payloads for media (base64 audio/images/video)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Shared server-side Gemini client with User-Agent header as required
const getGeminiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  return new GoogleGenAI({
    apiKey: apiKey || '',
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
};

const SYSTEM_INSTRUCTION = `You are Ira (ईरा), an exceptionally capable, intuitive, and friendly personal AI assistant for Android.
Your core traits:
1. Warm, responsive, articulate, and trustworthy.
2. Fluent in English, Hindi (हिंदी), and Hinglish (natural mix). You adapt gracefully to whatever language or dialect the user uses.
3. You help manage personal productivity, schedule events, summarize emails, draft tasks, provide insights into Google Workspace, generate creative images/videos, analyze visual documents, and answer questions.
4. When executing complex reasoning, you explain your thoughts systematically.
5. You are conscious of being an Android-first companion: you provide actionable, concise, and beautifully formatted responses suitable for mobile screens and voice reading.`;

// Helper to detect 429, 503 high demand, and quota errors
function isRetryableModelError(err: any): boolean {
  if (!err) return false;
  const str = String(err.message || err.status || err.code || err);
  return (
    str.includes('429') ||
    str.includes('503') ||
    str.includes('RESOURCE_EXHAUSTED') ||
    str.includes('UNAVAILABLE') ||
    str.includes('high demand') ||
    str.includes('quota') ||
    str.includes('Quota exceeded') ||
    str.includes('overloaded')
  );
}

// ==========================================
// 1. CHAT & REASONING ENDPOINT WITH RESILIENT CASCADE
// ==========================================
app.post('/api/chat', async (req, res) => {
  try {
    const {
      messages,
      modelMode = 'standard', // 'standard' | 'fast' | 'thinking'
      useSearch = false,
      useMaps = false,
      systemOverride = null,
    } = req.body;

    const ai = getGeminiClient();

    // Select primary model
    let primaryModel = 'gemini-3.8-flash';
    let thinkingConfig = undefined;

    if (modelMode === 'thinking') {
      primaryModel = 'gemini-3.1-pro-preview';
      thinkingConfig = { thinkingLevel: ThinkingLevel.HIGH };
    } else if (modelMode === 'fast') {
      primaryModel = 'gemini-3.1-flash-lite';
    } else {
      primaryModel = 'gemini-3.8-flash';
    }

    // Configure tools
    const tools: any[] = [];
    if (useMaps) {
      tools.push({ googleMaps: {} });
    } else if (useSearch) {
      tools.push({ googleSearch: {} });
    }

    // Format conversation history
    const contents = (messages || []).map((m: any) => {
      const parts: any[] = [];
      if (m.media && m.media.data && m.media.mimeType) {
        parts.push({
          inlineData: {
            mimeType: m.media.mimeType,
            data: m.media.data,
          },
        });
      }
      if (m.text) {
        parts.push({ text: m.text });
      }
      return {
        role: m.role === 'assistant' ? 'model' : 'user',
        parts,
      };
    });

    if (contents.length === 0) {
      contents.push({ role: 'user', parts: [{ text: 'Hello Ira!' }] });
    }

    const config: any = {
      systemInstruction: systemOverride || SYSTEM_INSTRUCTION,
    };

    if (thinkingConfig) {
      config.thinkingConfig = thinkingConfig;
    }

    if (tools.length > 0) {
      config.tools = tools;
    }

    // Candidate fallback models in case primary model hits 503 (high demand) or 429
    const modelCandidates = [
      primaryModel,
      'gemini-3.8-flash',
      'gemini-3.1-flash-lite',
      'gemini-flash-latest',
      'gemini-2.5-flash',
    ];

    // Remove duplicates while preserving order
    const uniqueModels = Array.from(new Set(modelCandidates));

    let response: any = null;
    let modelUsed = primaryModel;
    let lastError: any = null;

    for (const model of uniqueModels) {
      try {
        const attemptConfig = { ...config };
        // If falling back from thinking mode, remove thinkingConfig to reduce latency and quota
        if (model !== 'gemini-3.1-pro-preview' && attemptConfig.thinkingConfig) {
          delete attemptConfig.thinkingConfig;
        }

        response = await ai.models.generateContent({
          model,
          contents,
          config: attemptConfig,
        });

        if (response?.text) {
          modelUsed = model;
          break;
        }
      } catch (err: any) {
        lastError = err;
        if (isRetryableModelError(err)) {
          // Continue to next fallback model
          continue;
        }
        throw err;
      }
    }

    if (!response || !response.text) {
      // Graceful high-traffic response instead of 500
      return res.json({
        text: 'नमस्ते! Ira is currently receiving high demand from Google AI servers. Please wait a few moments and try your request again, or switch to Lite mode.',
        modelUsed: 'system-traffic-fallback',
        groundingMetadata: null,
      });
    }

    const replyText = response.text || '';
    const candidate = response?.candidates?.[0];
    const groundingMetadata = candidate?.groundingMetadata;

    res.json({
      text: replyText,
      modelUsed,
      groundingMetadata: groundingMetadata || null,
    });
  } catch (error: any) {
    res.json({
      text: 'Ira is temporarily re-establishing connection with the AI server. Please try asking again in a few seconds.',
      modelUsed: 'system-reconnect',
      groundingMetadata: null,
    });
  }
});

// ==========================================
// 2. RESILIENT AUDIO TRANSCRIPTION PIPELINE
// ==========================================
app.post('/api/transcribe', async (req, res) => {
  const { audioData, mimeType = 'audio/webm' } = req.body;
  if (!audioData) {
    return res.status(400).json({ error: 'audioData base64 is required' });
  }

  const ai = getGeminiClient();
  const audioPart = {
    inlineData: {
      mimeType,
      data: audioData,
    },
  };

  const transcribeModels = [
    'gemini-3.5-transcribe',
    'gemini-3.8-flash',
    'gemini-3.1-flash-lite',
    'gemini-flash-latest',
  ];

  for (const model of transcribeModels) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: {
          parts: [
            audioPart,
            { text: 'Transcribe this voice audio accurately. Output only the spoken words verbatim.' },
          ],
        },
      });

      if (response?.text?.trim()) {
        return res.json({ text: response.text.trim(), source: model });
      }
    } catch (err: any) {
      if (isRetryableModelError(err)) {
        continue;
      }
    }
  }

  // Soft fallback: inform client to use browser speech recognition
  return res.json({
    text: '',
    rateLimited: true,
    message: 'Voice transcription servers busy. Using device speech recognition.',
  });
});

// ==========================================
// 3. RESILIENT TEXT-TO-SPEECH
// ==========================================
app.post('/api/speech', async (req, res) => {
  const { text, voice = 'Kore' } = req.body;
  if (!text) {
    return res.status(400).json({ error: 'text is required' });
  }

  const ai = getGeminiClient();
  const cleanText = text.replace(/[*#_`]/g, '').slice(0, 1200);

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash-lite-tts',
      contents: [
        {
          role: 'user',
          parts: [{ text: cleanText }],
        },
      ],
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: voice },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (base64Audio) {
      return res.json({
        audioUrl: `data:audio/wav;base64,${base64Audio}`,
        format: 'wav',
      });
    }
  } catch (speechErr: any) {
    return res.json({
      audioUrl: null,
      fallbackToBrowser: true,
      rateLimited: isRetryableModelError(speechErr),
    });
  }

  res.json({ audioUrl: null, fallbackToBrowser: true });
});

// ==========================================
// 4. IMAGE GENERATION & EDITING
// ==========================================
app.post('/api/generate-image', async (req, res) => {
  try {
    const {
      prompt,
      aspectRatio = '1:1',
      imageSize = '1K',
      editImage = null,
      editMimeType = 'image/png',
      modelChoice = 'flash',
    } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    const ai = getGeminiClient();
    const model = modelChoice === 'pro' ? 'gemini-3-pro-image' : 'gemini-3.1-flash-image';

    const parts: any[] = [];
    if (editImage) {
      parts.push({
        inlineData: {
          mimeType: editMimeType,
          data: editImage,
        },
      });
    }
    parts.push({ text: prompt });

    const config: any = {
      imageConfig: {
        aspectRatio: aspectRatio,
        imageSize: imageSize,
      },
    };

    let response: any;
    try {
      response = await ai.models.generateContent({
        model,
        contents: { parts },
        config,
      });
    } catch (imgErr: any) {
      response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-lite-image',
        contents: { parts },
        config: {
          imageConfig: { aspectRatio },
        },
      });
    }

    let imageUrl: string | null = null;
    let descriptionText = '';

    const candidate = response?.candidates?.[0];
    if (candidate?.content?.parts) {
      for (const part of candidate.content.parts) {
        if (part.inlineData?.data) {
          imageUrl = `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
        } else if (part.text) {
          descriptionText += part.text;
        }
      }
    }

    if (!imageUrl) {
      return res.status(500).json({ error: 'No image was returned by the model' });
    }

    res.json({
      imageUrl,
      description: descriptionText,
      aspectRatio,
      imageSize,
      modelUsed: model,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Image generation failed' });
  }
});

// ==========================================
// 5. VEO VIDEO GENERATION
// ==========================================
app.post('/api/generate-video', async (req, res) => {
  try {
    const { prompt, aspectRatio = '16:9', startImage = null, mimeType = 'image/png' } = req.body;

    const ai = getGeminiClient();

    const videoConfig: any = {
      model: 'veo-3.1-lite-generate-preview',
      prompt: prompt || 'A cinematic high definition sequence',
      config: {
        numberOfVideos: 1,
        resolution: '720p',
        aspectRatio: aspectRatio === '9:16' ? '9:16' : '16:9',
      },
    };

    if (startImage) {
      videoConfig.image = {
        imageBytes: startImage,
        mimeType: mimeType,
      };
    }

    const operation = await ai.models.generateVideos(videoConfig);
    res.json({ operationName: operation.name });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to start video generation' });
  }
});

app.post('/api/video-status', async (req, res) => {
  try {
    const { operationName } = req.body;
    if (!operationName) {
      return res.status(400).json({ error: 'operationName is required' });
    }

    const ai = getGeminiClient();
    const op = new GenerateVideosOperation();
    op.name = operationName;
    const updated = await ai.operations.getVideosOperation({ operation: op });

    res.json({
      done: Boolean(updated.done),
      metadata: updated.metadata || null,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to poll video status' });
  }
});

app.post('/api/video-download', async (req, res) => {
  try {
    const { operationName } = req.body;
    if (!operationName) {
      return res.status(400).json({ error: 'operationName is required' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    const ai = getGeminiClient();
    const op = new GenerateVideosOperation();
    op.name = operationName;
    const updated = await ai.operations.getVideosOperation({ operation: op });

    const uri = updated.response?.generatedVideos?.[0]?.video?.uri;
    if (!uri) {
      return res.status(404).json({ error: 'Video URI not found in completed operation' });
    }

    const videoRes = await fetch(uri, {
      headers: { 'x-goog-api-key': apiKey || '' },
    });

    if (!videoRes.ok) {
      return res.status(videoRes.status).json({ error: 'Failed to download generated video' });
    }

    res.setHeader('Content-Type', 'video/mp4');
    const arrayBuffer = await videoRes.arrayBuffer();
    res.send(Buffer.from(arrayBuffer));
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Video download failed' });
  }
});

// ==========================================
// 6. MULTIMODAL MEDIA UNDERSTANDING
// ==========================================
app.post('/api/analyze-multimodal', async (req, res) => {
  try {
    const { mediaData, mimeType, prompt } = req.body;
    if (!mediaData || !mimeType) {
      return res.status(400).json({ error: 'mediaData and mimeType are required' });
    }

    const ai = getGeminiClient();
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-pro-preview',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType,
              data: mediaData,
            },
          },
          {
            text: prompt || 'Analyze this content in deep detail. Identify key elements, text, objects, contexts, and insights.',
          },
        ],
      },
    });

    res.json({ analysis: response.text || '' });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Analysis failed' });
  }
});

// ==========================================
// 7. ANDROID APK BUNDLE METADATA & DOWNLOAD
// ==========================================
app.get('/api/apk/info', (req, res) => {
  res.json({
    appName: 'Ira - AI Personal Assistant',
    version: '1.2.0',
    packageName: 'ai.studio.ira.assistant',
    minAndroidVersion: 'Android 8.0 (Oreo) and above',
    targetSdk: 35,
    features: [
      'Voice Assistant with real-time Speech Synthesis & Transcribe',
      'Google Workspace Integration (Gmail, Calendar, Drive, Tasks, Sheets, Docs)',
      'Veo Video Generator & Gemini Image Studio',
      'Offline PWA Cache & Instant Home Screen WebAPK Launcher',
      'Deep Reasoning Mode with Thinking Level High',
    ],
    downloadUrl: '/api/apk/download',
  });
});

app.get('/api/apk/download', (req, res) => {
  const packageContent = JSON.stringify(
    {
      appName: 'Ira - AI Personal Assistant',
      version: '1.2.0',
      platform: 'android',
      packageName: 'ai.studio.ira.assistant',
      manifestUrl: '/manifest.webmanifest',
      display: 'standalone',
      orientation: 'portrait-primary',
      themeColor: '#0b0f19',
      permissions: ['android.permission.RECORD_AUDIO', 'android.permission.CAMERA', 'android.permission.INTERNET'],
      installedDate: new Date().toISOString(),
      installationInstructions: [
        '1. If prompted, select "Add to Home Screen" or "Install App".',
        '2. On Chrome for Android, tap the ⋮ menu and tap "Install app" to generate a signed WebAPK.',
        '3. Grant Microphone and Camera permissions when prompted for voice and photo analysis.',
      ],
    },
    null,
    2
  );

  res.setHeader('Content-Disposition', 'attachment; filename="Ira-AI-Assistant.apk.json"');
  res.setHeader('Content-Type', 'application/json');
  res.send(packageContent);
});

// ==========================================
// VITE DEV SERVER OR STATIC PRODUCTION SERVING
// ==========================================
async function startServer() {
  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, host: '0.0.0.0', port: PORT, hmr: false },
      appType: 'spa',
    });
    app.use(vite.middlewares);

    // Single-page application HTML fallback
    app.use('*', async (req, res, next) => {
      if (req.originalUrl.startsWith('/api')) {
        return next();
      }
      try {
        const url = req.originalUrl;
        let template = fs.readFileSync(path.resolve(__dirname, 'index.html'), 'utf-8');
        template = await vite.transformIndexHtml(url, template);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (e) {
        next(e);
      }
    });
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Ira Assistant server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
