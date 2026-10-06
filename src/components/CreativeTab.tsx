import React, { useState, useRef } from 'react';
import {
  Sparkles,
  Image as ImageIcon,
  Video,
  Film,
  Download,
  Loader2,
  Sliders,
  Ratio,
  Maximize2,
  Wand2,
  RefreshCw,
  Eye,
  AlertCircle,
  FileVideo,
} from 'lucide-react';

export const CreativeTab: React.FC = () => {
  const [subTab, setSubTab] = useState<'image' | 'video' | 'multimodal'>('image');

  // ==========================================
  // IMAGE GENERATOR & EDITOR STATE
  // ==========================================
  const [imagePrompt, setImagePrompt] = useState('');
  const [imageAspectRatio, setImageAspectRatio] = useState('1:1');
  const [imageSize, setImageSize] = useState<'1K' | '2K' | '4K'>('1K');
  const [imageQuality, setImageQuality] = useState<'flash' | 'pro'>('flash');
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [imageDescription, setImageDescription] = useState('');
  const [editSourceImage, setEditSourceImage] = useState<string | null>(null);
  const [editMimeType, setEditMimeType] = useState('image/png');
  const imageInputRef = useRef<HTMLInputElement | null>(null);

  // ==========================================
  // VEO VIDEO GENERATOR STATE
  // ==========================================
  const [videoPrompt, setVideoPrompt] = useState('');
  const [videoAspectRatio, setVideoAspectRatio] = useState<'16:9' | '9:16'>('16:9');
  const [videoStartImage, setVideoStartImage] = useState<string | null>(null);
  const [videoMimeType, setVideoMimeType] = useState('image/png');
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false);
  const [videoProgressStatus, setVideoProgressStatus] = useState('');
  const [generatedVideoUrl, setGeneratedVideoUrl] = useState<string | null>(null);
  const videoInputRef = useRef<HTMLInputElement | null>(null);

  // ==========================================
  // MULTIMODAL INSPECTOR (gemini-3.1-pro-preview)
  // ==========================================
  const [inspectPrompt, setInspectPrompt] = useState(
    'Analyze this photo/video in thorough detail. Explain the context, extract any text or numbers, identify key items, and highlight notable insights.'
  );
  const [inspectMediaData, setInspectMediaData] = useState<string | null>(null);
  const [inspectMediaType, setInspectMediaType] = useState<'image' | 'video'>('image');
  const [inspectMimeType, setInspectMimeType] = useState('image/png');
  const [inspectPreviewUrl, setInspectPreviewUrl] = useState<string | null>(null);
  const [isInspecting, setIsInspecting] = useState(false);
  const [inspectResult, setInspectResult] = useState('');
  const inspectorFileInputRef = useRef<HTMLInputElement | null>(null);

  // Common Aspect Ratios as requested
  const aspectRatios = ['1:1', '2:3', '3:2', '3:4', '4:3', '9:16', '16:9', '21:9'];

  // Handle Edit Image Selection
  const handleEditImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      const full = reader.result as string;
      setEditSourceImage(full.split(',')[1]);
      setEditMimeType(file.type);
    };
    reader.readAsDataURL(file);
  };

  // Generate or Edit Image
  const handleGenerateImage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!imagePrompt.trim() || isGeneratingImage) return;

    setIsGeneratingImage(true);
    setImageDescription('');
    try {
      const res = await fetch('/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: imagePrompt,
          aspectRatio: imageAspectRatio,
          imageSize,
          modelChoice: imageQuality,
          editImage: editSourceImage,
          editMimeType,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Image generation failed');
      }

      const data = await res.json();
      setGeneratedImage(data.imageUrl);
      setImageDescription(data.description || '');
    } catch (err: any) {
      alert(`Error generating image: ${err.message}`);
    } finally {
      setIsGeneratingImage(false);
    }
  };

  // Handle Video Photo Upload (Image-to-Video)
  const handleVideoPhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      const full = reader.result as string;
      setVideoStartImage(full.split(',')[1]);
      setVideoMimeType(file.type);
    };
    reader.readAsDataURL(file);
  };

  // Generate Video with Veo
  const handleGenerateVideo = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!videoPrompt.trim() && !videoStartImage) || isGeneratingVideo) return;

    setIsGeneratingVideo(true);
    setGeneratedVideoUrl(null);
    setVideoProgressStatus('Initializing Veo Video generator model...');

    try {
      // 1. Start generation
      const startRes = await fetch('/api/generate-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: videoPrompt || 'A stunning cinematic moving scene',
          aspectRatio: videoAspectRatio,
          startImage: videoStartImage,
          mimeType: videoMimeType,
        }),
      });

      if (!startRes.ok) {
        const err = await startRes.json();
        throw new Error(err.error || 'Failed to start video generation');
      }

      const { operationName } = await startRes.json();
      setVideoProgressStatus('Veo model is rendering video frames (usually takes 1-2 minutes)...');

      // 2. Poll status
      let isDone = false;
      let attempts = 0;
      const maxAttempts = 40;

      while (!isDone && attempts < maxAttempts) {
        attempts++;
        await new Promise((r) => setTimeout(r, 7000));
        setVideoProgressStatus(`Rendering video frames... (${attempts * 7}s elapsed)`);

        const pollRes = await fetch('/api/video-status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ operationName }),
        });

        if (pollRes.ok) {
          const pollData = await pollRes.json();
          if (pollData.done) {
            isDone = true;
            break;
          }
        }
      }

      if (!isDone) {
        throw new Error('Video generation timed out. Please try again.');
      }

      // 3. Download video
      setVideoProgressStatus('Downloading completed Veo video...');
      const downloadRes = await fetch('/api/video-download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operationName }),
      });

      if (!downloadRes.ok) {
        throw new Error('Failed to retrieve video stream');
      }

      const videoBlob = await downloadRes.blob();
      const videoUrl = URL.createObjectURL(videoBlob);
      setGeneratedVideoUrl(videoUrl);
      setVideoProgressStatus('');
    } catch (err: any) {
      alert(`Video generation error: ${err.message}`);
      setVideoProgressStatus('');
    } finally {
      setIsGeneratingVideo(false);
    }
  };

  // Multimodal File Upload
  const handleInspectMediaUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isVid = file.type.startsWith('video/');
    setInspectMediaType(isVid ? 'video' : 'image');
    setInspectMimeType(file.type);
    setInspectPreviewUrl(URL.createObjectURL(file));

    const reader = new FileReader();
    reader.onloadend = () => {
      const full = reader.result as string;
      setInspectMediaData(full.split(',')[1]);
    };
    reader.readAsDataURL(file);
  };

  // Inspect with Gemini Pro
  const handleRunInspection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inspectMediaData || isInspecting) return;

    setIsInspecting(true);
    setInspectResult('');
    try {
      const res = await fetch('/api/analyze-multimodal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mediaData: inspectMediaData,
          mimeType: inspectMimeType,
          prompt: inspectPrompt,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Inspection failed');
      }

      const data = await res.json();
      setInspectResult(data.analysis || 'Analysis complete.');
    } catch (err: any) {
      alert(`Inspection error: ${err.message}`);
    } finally {
      setIsInspecting(false);
    }
  };

  return (
    <div className="flex flex-col h-full max-w-5xl mx-auto p-4 sm:p-6 overflow-y-auto">
      {/* Header */}
      <div className="mb-6 pb-4 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-cyan-400" />
            Ira Creative Studio
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Generate and edit images with Gemini Flash/Pro, animate photos with Veo 3, and deeply analyze visual media.
          </p>
        </div>

        {/* Tab switchers */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-900 rounded-2xl border border-slate-800 text-xs">
          <button
            onClick={() => setSubTab('image')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-medium transition ${
              subTab === 'image'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <ImageIcon className="w-3.5 h-3.5" />
            <span>Image Studio</span>
          </button>
          <button
            onClick={() => setSubTab('video')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-medium transition ${
              subTab === 'video'
                ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Film className="w-3.5 h-3.5" />
            <span>Veo Video</span>
          </button>
          <button
            onClick={() => setSubTab('multimodal')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-medium transition ${
              subTab === 'multimodal'
                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Visual Inspector</span>
          </button>
        </div>
      </div>

      {/* SUBTAB 1: IMAGE STUDIO */}
      {subTab === 'image' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Controls & Prompt Form */}
          <form onSubmit={handleGenerateImage} className="lg:col-span-5 space-y-4">
            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Creative Prompt
                </label>
                <textarea
                  rows={3}
                  value={imagePrompt}
                  onChange={(e) => setImagePrompt(e.target.value)}
                  placeholder="e.g., A futuristic cyberpunk personal assistant avatar floating in neon ambient light..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                  required
                />
              </div>

              {/* Aspect Ratio Picker (1:1, 2:3, 3:2, 3:4, 4:3, 9:16, 16:9, 21:9) */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <Ratio className="w-3.5 h-3.5 text-cyan-400" /> Aspect Ratio
                  </span>
                  <span className="text-cyan-400 font-mono text-[11px]">{imageAspectRatio}</span>
                </label>
                <div className="grid grid-cols-4 gap-1.5">
                  {aspectRatios.map((ar) => (
                    <button
                      key={ar}
                      type="button"
                      onClick={() => setImageAspectRatio(ar)}
                      className={`py-1.5 rounded-lg text-[11px] font-medium transition ${
                        imageAspectRatio === ar
                          ? 'bg-cyan-500 text-slate-950 font-bold shadow-sm'
                          : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                      }`}
                    >
                      {ar}
                    </button>
                  ))}
                </div>
              </div>

              {/* Resolution Controls (1K, 2K, 4K) */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <Maximize2 className="w-3.5 h-3.5 text-purple-400" /> Resolution Quality
                  </span>
                  <span className="text-purple-400 font-mono text-[11px]">{imageSize}</span>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['1K', '2K', '4K'] as const).map((size) => (
                    <button
                      key={size}
                      type="button"
                      onClick={() => setImageSize(size)}
                      className={`py-1.5 rounded-lg text-xs font-medium transition ${
                        imageSize === size
                          ? 'bg-purple-600 text-white font-bold shadow-md shadow-purple-900/30'
                          : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                      }`}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>

              {/* Optional: Upload Source Photo to Edit */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <Wand2 className="w-3.5 h-3.5 text-amber-400" /> Edit Existing Photo (Optional)
                  </span>
                  {editSourceImage && (
                    <button
                      type="button"
                      onClick={() => setEditSourceImage(null)}
                      className="text-[10px] text-rose-400 hover:underline"
                    >
                      Clear Image
                    </button>
                  )}
                </label>
                <input
                  type="file"
                  ref={imageInputRef}
                  onChange={handleEditImageUpload}
                  accept="image/*"
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => imageInputRef.current?.click()}
                  className={`w-full py-2.5 rounded-xl border border-dashed text-xs transition flex items-center justify-center gap-2 ${
                    editSourceImage
                      ? 'border-amber-500/40 bg-amber-500/10 text-amber-300'
                      : 'border-slate-800 bg-slate-950/60 text-slate-400 hover:text-white hover:border-slate-700'
                  }`}
                >
                  <ImageIcon className="w-4 h-4" />
                  <span>{editSourceImage ? 'Photo attached for editing' : 'Upload photo to modify'}</span>
                </button>
              </div>

              {/* Generate Button */}
              <button
                type="submit"
                disabled={isGeneratingImage || !imagePrompt.trim()}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white text-xs font-bold shadow-lg shadow-cyan-900/30 transition flex items-center justify-center gap-2 disabled:opacity-50 active:scale-98"
              >
                {isGeneratingImage ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Rendering with Gemini...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>{editSourceImage ? 'Edit Photo with Gemini' : 'Generate Image'}</span>
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Generated Image Preview Card */}
          <div className="lg:col-span-7 flex flex-col">
            <div className="flex-1 p-4 rounded-3xl bg-slate-900 border border-slate-800 flex flex-col items-center justify-center min-h-[360px] relative overflow-hidden">
              {isGeneratingImage ? (
                <div className="flex flex-col items-center gap-3 text-center">
                  <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center animate-spin">
                    <Sparkles className="w-6 h-6" />
                  </div>
                  <p className="text-xs text-slate-300 font-medium">Generating high-fidelity visual...</p>
                  <p className="text-[10px] text-slate-500">Configured size: {imageSize} • Aspect ratio: {imageAspectRatio}</p>
                </div>
              ) : generatedImage ? (
                <div className="w-full h-full flex flex-col items-center justify-center gap-3">
                  <img
                    src={generatedImage}
                    alt={imagePrompt}
                    className="max-h-[460px] w-auto max-w-full rounded-2xl shadow-2xl object-contain border border-slate-800"
                  />
                  <div className="w-full flex items-center justify-between px-2 pt-2 border-t border-slate-800/60">
                    <span className="text-[10px] text-slate-400 font-mono">
                      {imageSize} • {imageAspectRatio}
                    </span>
                    <a
                      href={generatedImage}
                      download={`Ira-Art-${Date.now()}.png`}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-medium shadow-md transition"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download</span>
                    </a>
                  </div>
                </div>
              ) : (
                <div className="text-center p-8 text-slate-500 text-xs">
                  <ImageIcon className="w-10 h-10 mx-auto mb-2 text-slate-700" />
                  <p>Your generated visual will appear here.</p>
                  <p className="text-[10px] text-slate-600 mt-1">Supports all 8 aspect ratios & 4K quality.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 2: VEO VIDEO GENERATOR */}
      {subTab === 'video' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Video Configuration Form */}
          <form onSubmit={handleGenerateVideo} className="lg:col-span-5 space-y-4">
            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Video Cinematic Prompt
                </label>
                <textarea
                  rows={3}
                  value={videoPrompt}
                  onChange={(e) => setVideoPrompt(e.target.value)}
                  placeholder="e.g., A glowing drone flying over a futuristic metropolis at sunset, cinematic lighting, 4K resolution..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Aspect Ratio (16:9 landscape or 9:16 portrait) */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <Ratio className="w-3.5 h-3.5 text-indigo-400" /> Veo Aspect Ratio
                  </span>
                  <span className="text-indigo-400 font-mono text-[11px]">{videoAspectRatio}</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setVideoAspectRatio('16:9')}
                    className={`py-2 rounded-xl text-xs font-medium transition flex items-center justify-center gap-1.5 ${
                      videoAspectRatio === '16:9'
                        ? 'bg-indigo-600 text-white font-bold shadow-md shadow-indigo-900/40'
                        : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                    }`}
                  >
                    <span>16:9 Landscape</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setVideoAspectRatio('9:16')}
                    className={`py-2 rounded-xl text-xs font-medium transition flex items-center justify-center gap-1.5 ${
                      videoAspectRatio === '9:16'
                        ? 'bg-indigo-600 text-white font-bold shadow-md shadow-indigo-900/40'
                        : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                    }`}
                  >
                    <span>9:16 Portrait (Shorts)</span>
                  </button>
                </div>
              </div>

              {/* Animate Photo with Veo */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center justify-between">
                  <span>Animate Starting Photo (Veo Image-to-Video)</span>
                  {videoStartImage && (
                    <button
                      type="button"
                      onClick={() => setVideoStartImage(null)}
                      className="text-[10px] text-rose-400 hover:underline"
                    >
                      Clear
                    </button>
                  )}
                </label>
                <input
                  type="file"
                  ref={videoInputRef}
                  onChange={handleVideoPhotoUpload}
                  accept="image/*"
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => videoInputRef.current?.click()}
                  className={`w-full py-2.5 rounded-xl border border-dashed text-xs transition flex items-center justify-center gap-2 ${
                    videoStartImage
                      ? 'border-indigo-500/40 bg-indigo-500/10 text-indigo-300'
                      : 'border-slate-800 bg-slate-950/60 text-slate-400 hover:text-white hover:border-slate-700'
                  }`}
                >
                  <Film className="w-4 h-4" />
                  <span>{videoStartImage ? 'Starting photo attached' : 'Upload photo to animate into video'}</span>
                </button>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isGeneratingVideo || (!videoPrompt.trim() && !videoStartImage)}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 text-white text-xs font-bold shadow-lg shadow-indigo-900/30 transition flex items-center justify-center gap-2 disabled:opacity-50 active:scale-98"
              >
                {isGeneratingVideo ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Rendering Veo Video...</span>
                  </>
                ) : (
                  <>
                    <Video className="w-4 h-4" />
                    <span>Generate Video with Veo</span>
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Video Preview Card */}
          <div className="lg:col-span-7 flex flex-col">
            <div className="flex-1 p-4 rounded-3xl bg-slate-900 border border-slate-800 flex flex-col items-center justify-center min-h-[360px] relative overflow-hidden">
              {isGeneratingVideo ? (
                <div className="flex flex-col items-center gap-4 text-center p-6 max-w-sm">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center animate-pulse">
                    <Film className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-white mb-1">Veo 3 Video Generator</h4>
                    <p className="text-xs text-indigo-300 animate-pulse font-medium">
                      {videoProgressStatus || 'Generating your video...'}
                    </p>
                    <p className="text-[10px] text-slate-500 mt-2">
                      Aspect Ratio: {videoAspectRatio} • Veo Fast Preview
                    </p>
                  </div>
                </div>
              ) : generatedVideoUrl ? (
                <div className="w-full flex flex-col items-center gap-3">
                  <video
                    src={generatedVideoUrl}
                    controls
                    autoPlay
                    loop
                    className="max-h-[460px] rounded-2xl shadow-2xl border border-slate-800 bg-black"
                  />
                  <div className="w-full flex items-center justify-between px-2 pt-2 border-t border-slate-800/60">
                    <span className="text-[10px] text-slate-400 font-mono">
                      {videoAspectRatio} • Veo Video Complete
                    </span>
                    <a
                      href={generatedVideoUrl}
                      download={`Ira-Veo-${Date.now()}.mp4`}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium shadow-md transition"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download MP4</span>
                    </a>
                  </div>
                </div>
              ) : (
                <div className="text-center p-8 text-slate-500 text-xs">
                  <Video className="w-10 h-10 mx-auto mb-2 text-slate-700" />
                  <p>Your generated Veo video will play here.</p>
                  <p className="text-[10px] text-slate-600 mt-1">Supports 16:9 Landscape & 9:16 Portrait.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 3: MULTIMODAL INSPECTOR */}
      {subTab === 'multimodal' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <form onSubmit={handleRunInspection} className="lg:col-span-5 space-y-4">
            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Upload Photo or Video to Inspect
                </label>
                <input
                  type="file"
                  ref={inspectorFileInputRef}
                  onChange={handleInspectMediaUpload}
                  accept="image/*,video/*"
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => inspectorFileInputRef.current?.click()}
                  className={`w-full py-4 rounded-xl border border-dashed text-xs transition flex flex-col items-center justify-center gap-1.5 ${
                    inspectMediaData
                      ? 'border-purple-500/40 bg-purple-500/10 text-purple-300'
                      : 'border-slate-800 bg-slate-950/60 text-slate-400 hover:text-white hover:border-slate-700'
                  }`}
                >
                  <Eye className="w-5 h-5 text-purple-400" />
                  <span className="font-medium">
                    {inspectMediaData ? `${inspectMediaType.toUpperCase()} attached` : 'Select Photo or Video clip'}
                  </span>
                  <span className="text-[10px] text-slate-500">Gemini 3.1 Pro multimodal reasoning</span>
                </button>
              </div>

              {inspectPreviewUrl && (
                <div className="rounded-xl overflow-hidden border border-slate-800 max-h-48">
                  {inspectMediaType === 'image' ? (
                    <img src={inspectPreviewUrl} alt="Inspection preview" className="w-full h-auto object-cover max-h-48" />
                  ) : (
                    <video src={inspectPreviewUrl} controls className="w-full max-h-48 object-cover" />
                  )}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Analysis Question / Instruction
                </label>
                <textarea
                  rows={3}
                  value={inspectPrompt}
                  onChange={(e) => setInspectPrompt(e.target.value)}
                  placeholder="What would you like Gemini Pro to inspect in this media?"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={isInspecting || !inspectMediaData}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white text-xs font-bold shadow-lg shadow-purple-900/30 transition flex items-center justify-center gap-2 disabled:opacity-50 active:scale-98"
              >
                {isInspecting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Analyzing with Gemini 3.1 Pro...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Run Deep Analysis</span>
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Analysis Results Card */}
          <div className="lg:col-span-7 flex flex-col">
            <div className="flex-1 p-6 rounded-3xl bg-slate-900 border border-slate-800 flex flex-col min-h-[360px]">
              <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-400" />
                Gemini 3.1 Pro Multimodal Intelligence
              </h3>

              {isInspecting ? (
                <div className="m-auto flex flex-col items-center gap-3 text-center">
                  <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
                  <p className="text-xs text-slate-300">Evaluating frames, text, and objects...</p>
                </div>
              ) : inspectResult ? (
                <div className="flex-1 overflow-y-auto pr-1">
                  <p className="text-xs leading-relaxed text-slate-200 whitespace-pre-wrap">
                    {inspectResult}
                  </p>
                </div>
              ) : (
                <div className="m-auto text-center p-8 text-slate-500 text-xs">
                  <Eye className="w-10 h-10 mx-auto mb-2 text-slate-700" />
                  <p>Upload a photo or video to view detailed AI insights.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
