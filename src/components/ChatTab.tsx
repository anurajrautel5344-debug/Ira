import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Mic,
  MicOff,
  Image as ImageIcon,
  Video,
  Volume2,
  Sparkles,
  Search,
  MapPin,
  BrainCircuit,
  Zap,
  Globe,
  Loader2,
  ExternalLink,
  Trash2,
  Headphones,
} from 'lucide-react';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: string;
  modelUsed?: string;
  groundingMetadata?: any;
  media?: {
    type: 'image' | 'video';
    previewUrl: string;
    mimeType: string;
    data: string;
  };
}

interface ChatTabProps {
  onOpenVoiceModal: () => void;
  onOpenWorkspace: () => void;
}

export const ChatTab: React.FC<ChatTabProps> = ({
  onOpenVoiceModal,
  onOpenWorkspace,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'init-1',
      role: 'assistant',
      text: 'नमस्ते! I am Ira (ईरा), your personal AI assistant. How can I assist you today? I can manage your Google Workspace, generate creative images & Veo videos, conduct deep reasoning with High Thinking mode, or chat via voice in English and Hindi.',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      modelUsed: 'gemini-3.5-flash',
    },
  ]);

  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [modelMode, setModelMode] = useState<'standard' | 'thinking' | 'fast'>('standard');
  const [useSearch, setUseSearch] = useState(false);
  const [useMaps, setUseMaps] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingStatus, setRecordingStatus] = useState('');
  const [attachedMedia, setAttachedMedia] = useState<{
    type: 'image' | 'video';
    previewUrl: string;
    mimeType: string;
    data: string;
  } | null>(null);

  const [activeSpeechId, setActiveSpeechId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  // Handle Search vs Maps mutual exclusivity
  const toggleSearch = () => {
    setUseSearch((prev) => {
      if (!prev) setUseMaps(false);
      return !prev;
    });
  };

  const toggleMaps = () => {
    setUseMaps((prev) => {
      if (!prev) setUseSearch(false);
      return !prev;
    });
  };

  const speechRecognitionRef = useRef<any>(null);
  const recognitionTextRef = useRef<string>('');

  // Handle Audio Recording with resilient dual-engine (Browser WebSpeech + Gemini fallback)
  const startAudioRecording = async () => {
    try {
      setIsRecording(true);
      setRecordingStatus('Listening to your voice...');
      audioChunksRef.current = [];
      recognitionTextRef.current = '';

      // Try Native Browser SpeechRecognition (Zero API quota, real-time on Android)
      const SpeechRecognitionClass =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

      if (SpeechRecognitionClass) {
        try {
          const recognition = new SpeechRecognitionClass();
          recognition.continuous = false;
          recognition.interimResults = true;
          recognition.lang = 'en-US';

          recognition.onresult = (event: any) => {
            let current = '';
            for (let i = 0; i < event.results.length; i++) {
              current += event.results[i][0].transcript;
            }
            if (current.trim()) {
              recognitionTextRef.current = current.trim();
              setInputText(current.trim());
            }
          };

          recognition.onerror = () => {
            // Silently fall back to media recorder
          };

          recognition.onend = () => {
            setIsRecording(false);
            setRecordingStatus('');
          };

          speechRecognitionRef.current = recognition;
          recognition.start();
        } catch {}
      }

      // Companion audio stream for backup
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        if (!recognitionTextRef.current.trim() && audioChunksRef.current.length > 0) {
          setRecordingStatus('Processing audio with Gemini...');
          const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });

          const reader = new FileReader();
          reader.onloadend = async () => {
            const base64 = (reader.result as string).split(',')[1];
            try {
              const res = await fetch('/api/transcribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ audioData: base64, mimeType: 'audio/webm' }),
              });
              const data = await res.json();
              if (data.text) {
                setInputText((prev) => (prev ? `${prev} ${data.text}` : data.text));
              }
            } catch {
              // Silently handle
            } finally {
              setIsRecording(false);
              setRecordingStatus('');
            }
          };
          reader.readAsDataURL(blob);
        } else {
          setIsRecording(false);
          setRecordingStatus('');
        }
      };

      mediaRecorder.start();
    } catch {
      setIsRecording(false);
      setRecordingStatus('');
    }
  };

  const stopAudioRecording = () => {
    if (speechRecognitionRef.current) {
      try {
        speechRecognitionRef.current.stop();
      } catch {}
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    } else {
      setIsRecording(false);
      setRecordingStatus('');
    }
  };

  // Handle File Upload (Image / Video)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isVid = file.type.startsWith('video/');
    const isImg = file.type.startsWith('image/');
    if (!isImg && !isVid) {
      alert('Please upload an image or video file.');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const full = reader.result as string;
      const base64 = full.split(',')[1];
      setAttachedMedia({
        type: isVid ? 'video' : 'image',
        previewUrl: URL.createObjectURL(file),
        mimeType: file.type,
        data: base64,
      });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Text to Speech playback with Gemini TTS + Browser SpeechSynthesis fallback
  const handleSpeak = async (messageId: string, text: string) => {
    if (activeSpeechId === messageId) {
      if (currentAudioRef.current) currentAudioRef.current.pause();
      if (window.speechSynthesis) window.speechSynthesis.cancel();
      setActiveSpeechId(null);
      return;
    }

    const cleanText = text.replace(/[*#_`]/g, '').slice(0, 1000);
    setActiveSpeechId(messageId);

    try {
      const res = await fetch('/api/speech', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: cleanText }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.audioUrl) {
          if (currentAudioRef.current) currentAudioRef.current.pause();
          const audio = new Audio(data.audioUrl);
          currentAudioRef.current = audio;
          audio.onended = () => setActiveSpeechId(null);
          audio.onerror = () => fallbackSpeak(cleanText);
          await audio.play();
          return;
        }
      }
    } catch {}

    fallbackSpeak(cleanText);
  };

  const fallbackSpeak = (text: string) => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.05;
      utterance.onend = () => setActiveSpeechId(null);
      utterance.onerror = () => setActiveSpeechId(null);
      window.speechSynthesis.speak(utterance);
    } else {
      setActiveSpeechId(null);
    }
  };

  // Send Message
  const handleSendMessage = async (customText?: string) => {
    const textToSend = customText !== undefined ? customText : inputText;
    if ((!textToSend.trim() && !attachedMedia) || isLoading) return;

    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      text: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      media: attachedMedia || undefined,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputText('');
    setAttachedMedia(null);
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, userMessage],
          modelMode,
          useSearch,
          useMaps,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to get response from Ira');
      }

      const data = await response.json();
      const assistantMessage: ChatMessage = {
        id: `reply-${Date.now()}`,
        role: 'assistant',
        text: data.text || 'Ira processed your request.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        modelUsed: data.modelUsed,
        groundingMetadata: data.groundingMetadata,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err: any) {
      console.error('Chat error:', err);
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: 'assistant',
          text: `Oops! ${err.message || 'I encountered an error. Please check your connection and try again.'}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const clearChat = () => {
    setMessages([
      {
        id: 'init-reset',
        role: 'assistant',
        text: 'Chat history cleared. How can I help you right now?',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        modelUsed: 'gemini-3.5-flash',
      },
    ]);
  };

  return (
    <div className="flex flex-col h-full max-w-4xl mx-auto">
      {/* Top Controls Toolbar */}
      <div className="p-3 bg-slate-900/80 backdrop-blur-md border-b border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
        {/* Model Mode Selection */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-950 rounded-xl border border-slate-800">
          <button
            onClick={() => setModelMode('standard')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-medium transition ${
              modelMode === 'standard'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Flash 3.5</span>
          </button>
          <button
            onClick={() => setModelMode('thinking')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-medium transition ${
              modelMode === 'thinking'
                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <BrainCircuit className="w-3.5 h-3.5" />
            <span>High Thinking</span>
          </button>
          <button
            onClick={() => setModelMode('fast')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-medium transition ${
              modelMode === 'fast'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Lite (Fast)</span>
          </button>
        </div>

        {/* Grounding & Voice Toggles */}
        <div className="flex items-center gap-2">
          <button
            onClick={toggleSearch}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl border transition ${
              useSearch
                ? 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
            }`}
            title="Google Search Grounding"
          >
            <Search className="w-3.5 h-3.5" />
            <span>Search</span>
          </button>

          <button
            onClick={toggleMaps}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl border transition ${
              useMaps
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
            }`}
            title="Google Maps Grounding"
          >
            <MapPin className="w-3.5 h-3.5" />
            <span>Maps</span>
          </button>

          <button
            onClick={onOpenVoiceModal}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-medium shadow-md shadow-cyan-900/30 transition"
            title="Open Hands-free Voice Mode"
          >
            <Headphones className="w-3.5 h-3.5" />
            <span>Live Voice</span>
          </button>

          <button
            onClick={clearChat}
            className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-slate-800 transition"
            title="Clear Chat History"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => {
          const isUser = message.role === 'user';
          return (
            <div
              key={message.id}
              className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} max-w-full`}
            >
              <div
                className={`flex gap-3 max-w-[92%] sm:max-w-[80%] rounded-2xl p-4 shadow-sm ${
                  isUser
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-tr-none'
                    : 'bg-slate-900/90 border border-slate-800 text-slate-100 rounded-tl-none'
                }`}
              >
                {!isUser && (
                  <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-cyan-400 via-blue-500 to-indigo-500 shrink-0 flex items-center justify-center text-white shadow-md">
                    <Sparkles className="w-4 h-4" />
                  </div>
                )}

                <div className="flex-1 space-y-2 overflow-hidden">
                  {/* Media attachment if user uploaded photo/video */}
                  {message.media && (
                    <div className="rounded-xl overflow-hidden max-h-56 border border-white/10 mb-2">
                      {message.media.type === 'image' ? (
                        <img
                          src={message.media.previewUrl}
                          alt="Uploaded attachment"
                          className="w-full h-auto object-cover max-h-56"
                        />
                      ) : (
                        <video
                          src={message.media.previewUrl}
                          controls
                          className="w-full max-h-56 object-cover"
                        />
                      )}
                    </div>
                  )}

                  {/* Message Text */}
                  <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                    {message.text}
                  </p>

                  {/* Grounding Sources (Search / Maps web links) */}
                  {message.groundingMetadata?.webSearchQueries && (
                    <div className="mt-3 pt-2 border-t border-slate-800 text-xs text-cyan-300">
                      <div className="flex items-center gap-1 mb-1 font-semibold">
                        <Globe className="w-3 h-3" />
                        <span>Sources & Search Grounding</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {message.groundingMetadata.groundingChunks?.map((chunk: any, i: number) => {
                          const uri = chunk.web?.uri;
                          const title = chunk.web?.title || 'Web Result';
                          if (!uri) return null;
                          return (
                            <a
                              key={i}
                              href={uri}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-950 border border-slate-800 text-cyan-400 hover:text-white transition"
                            >
                              <span className="truncate max-w-[140px]">{title}</span>
                              <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                            </a>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Message Footer */}
                  <div
                    className={`flex items-center justify-between gap-3 pt-1 text-[10px] ${
                      isUser ? 'text-blue-200' : 'text-slate-400'
                    }`}
                  >
                    <span>{message.timestamp}</span>

                    <div className="flex items-center gap-2">
                      {message.modelUsed && (
                        <span className="px-1.5 py-0.5 rounded bg-slate-950/60 border border-slate-800 text-slate-400">
                          {message.modelUsed.replace('gemini-', '')}
                        </span>
                      )}

                      {!isUser && (
                        <button
                          onClick={() => handleSpeak(message.id, message.text)}
                          className={`p-1 rounded hover:bg-slate-800 transition ${
                            activeSpeechId === message.id ? 'text-cyan-400 animate-pulse' : 'text-slate-400'
                          }`}
                          title="Speak reply aloud with Gemini TTS"
                        >
                          <Volume2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {/* Loading Indicator */}
        {isLoading && (
          <div className="flex items-start gap-3 max-w-[80%]">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-cyan-400 to-indigo-500 shrink-0 flex items-center justify-center text-white">
              <Sparkles className="w-4 h-4 animate-spin" />
            </div>
            <div className="p-3.5 rounded-2xl rounded-tl-none bg-slate-900 border border-slate-800 text-xs text-slate-300 flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
              <span>
                {modelMode === 'thinking'
                  ? 'Ira is reasoning deeply with High Thinking Level...'
                  : useSearch
                  ? 'Ira is grounding answer with Google Search...'
                  : useMaps
                  ? 'Ira is exploring Google Maps data...'
                  : 'Ira is typing...'}
              </span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggestion Quick Chips */}
      {messages.length < 3 && (
        <div className="px-4 py-2 flex items-center gap-2 overflow-x-auto no-scrollbar text-xs">
          <button
            onClick={() => handleSendMessage('Review my Google Workspace tasks and calendar for today.')}
            className="shrink-0 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 transition"
          >
            📅 Check Today's Calendar & Tasks
          </button>
          <button
            onClick={() => handleSendMessage('ईरा, आज का मुख्य समाचार और मौसम क्या है?')}
            className="shrink-0 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-cyan-300 transition"
          >
            🇮🇳 आज का मौसम और समाचार
          </button>
          <button
            onClick={() => {
              setModelMode('thinking');
              handleSendMessage('Solve this step-by-step with deep reasoning: What is the optimal strategy for organizing a personal productivity system using Google Workspace?');
            }}
            className="shrink-0 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-purple-300 transition"
          >
            🧠 Deep Thinking Plan
          </button>
        </div>
      )}

      {/* Input Composer */}
      <div className="p-3 bg-slate-900/90 border-t border-slate-800">
        {/* Media Preview before send */}
        {attachedMedia && (
          <div className="mb-2 p-2 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between max-w-sm">
            <div className="flex items-center gap-2 truncate">
              {attachedMedia.type === 'image' ? (
                <img
                  src={attachedMedia.previewUrl}
                  alt="Attachment preview"
                  className="w-10 h-10 rounded-lg object-cover"
                />
              ) : (
                <div className="w-10 h-10 rounded-lg bg-indigo-950 flex items-center justify-center text-indigo-400">
                  <Video className="w-5 h-5" />
                </div>
              )}
              <div className="text-xs truncate">
                <span className="font-medium text-white capitalize">{attachedMedia.type} attached</span>
                <p className="text-[10px] text-slate-400">Ready for Multimodal analysis</p>
              </div>
            </div>
            <button
              onClick={() => setAttachedMedia(null)}
              className="text-slate-400 hover:text-white p-1"
            >
              ✕
            </button>
          </div>
        )}

        {/* Audio Recording Status Banner */}
        {isRecording && (
          <div className="mb-2 px-3 py-2 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-center justify-between text-xs text-rose-300 animate-pulse">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
              <span>{recordingStatus}</span>
            </div>
            <button
              onClick={stopAudioRecording}
              className="px-2 py-0.5 rounded-lg bg-rose-600 text-white font-medium"
            >
              Done
            </button>
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="flex items-center gap-2"
        >
          {/* File Upload Button */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept="image/*,video/*"
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="p-2.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-cyan-400 transition"
            title="Attach photo or video for multimodal analysis"
          >
            <ImageIcon className="w-4 h-4" />
          </button>

          {/* Voice Input with Transcription */}
          <button
            type="button"
            onClick={isRecording ? stopAudioRecording : startAudioRecording}
            className={`p-2.5 rounded-xl transition ${
              isRecording
                ? 'bg-rose-500 text-white animate-pulse'
                : 'bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-cyan-400'
            }`}
            title={isRecording ? 'Stop recording' : 'Speak to Transcribe with Gemini 3.5'}
          >
            {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>

          {/* Text Input */}
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={
              isRecording
                ? 'Listening to your voice...'
                : 'Ask Ira anything in English or Hindi...'
            }
            className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition"
          />

          {/* Send Button */}
          <button
            type="submit"
            disabled={(!inputText.trim() && !attachedMedia) || isLoading}
            className="p-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white shadow-md shadow-cyan-900/30 transition disabled:opacity-40 disabled:cursor-not-allowed active:scale-95"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
