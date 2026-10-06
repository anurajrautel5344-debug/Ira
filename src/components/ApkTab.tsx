import React, { useState } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import {
  Smartphone,
  Download,
  CheckCircle2,
  Shield,
  Mic,
  Camera,
  Layers,
  Sparkles,
  Cpu,
  Globe2,
  Share2,
  FileDown,
  Info,
} from 'lucide-react';

export const ApkTab: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [downloadingBundle, setDownloadingBundle] = useState(false);
  const [activeLang, setActiveLang] = useState<'en' | 'hi'>('en');

  const handleInstallClick = async () => {
    if (isInstallable) {
      await install();
    } else {
      alert('To install on Android: Tap the 3 dots (⋮) in your Chrome/browser menu and tap "Install app" or "Add to Home Screen".');
    }
  };

  const handleDownloadApkBundle = async () => {
    setDownloadingBundle(true);
    try {
      const res = await fetch('/api/apk/download');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'Ira-AI-Assistant.apk.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err) {
      console.error('Download error:', err);
    } finally {
      setDownloadingBundle(false);
    }
  };

  return (
    <div className="flex flex-col h-full max-w-4xl mx-auto p-4 sm:p-6 overflow-y-auto space-y-6">
      {/* Hero Banner */}
      <div className="relative overflow-hidden p-6 sm:p-8 rounded-3xl bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 border border-slate-800 shadow-2xl">
        <div className="absolute top-0 right-0 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-3xl bg-gradient-to-tr from-cyan-400 via-blue-500 to-indigo-600 p-0.5 shadow-2xl shadow-cyan-500/30 shrink-0">
              <div className="w-full h-full rounded-[22px] bg-slate-950 flex items-center justify-center text-cyan-300">
                <Smartphone className="w-9 h-9" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-[10px] font-bold uppercase tracking-wider">
                  Android APK & PWA Edition
                </span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold">
                  v1.2.0
                </span>
              </div>
              <h2 className="text-2xl font-black text-white tracking-tight">
                Ira (ईरा) for Android
              </h2>
              <p className="text-xs text-slate-300 mt-1 max-w-md">
                Your personal AI assistant with Google Workspace integration, real-time voice, Veo 3 Video creation, and High Thinking reasoning.
              </p>
            </div>
          </div>

          {/* Install CTA */}
          <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto shrink-0">
            {isInstalled ? (
              <div className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-semibold">
                <CheckCircle2 className="w-4 h-4" />
                <span>Installed on Device</span>
              </div>
            ) : (
              <button
                onClick={handleInstallClick}
                className="flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-bold text-xs shadow-xl shadow-cyan-500/20 active:scale-95 transition"
              >
                <Download className="w-4 h-4" />
                <span>Install Ira App on Android</span>
              </button>
            )}

            <button
              onClick={handleDownloadApkBundle}
              disabled={downloadingBundle}
              className="flex items-center justify-center gap-2 px-4 py-3.5 rounded-2xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 text-xs font-semibold transition"
            >
              <FileDown className="w-4 h-4 text-cyan-400" />
              <span>{downloadingBundle ? 'Downloading...' : 'Package Bundle'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Language Selector for Guide */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <Globe2 className="w-4 h-4 text-cyan-400" />
          Android Installation Guide / इंस्टॉलेशन गाइड
        </h3>
        <div className="flex items-center p-0.5 bg-slate-900 border border-slate-800 rounded-xl text-xs">
          <button
            onClick={() => setActiveLang('en')}
            className={`px-3 py-1 rounded-lg font-medium transition ${
              activeLang === 'en' ? 'bg-cyan-500/20 text-cyan-300 font-bold' : 'text-slate-400'
            }`}
          >
            English
          </button>
          <button
            onClick={() => setActiveLang('hi')}
            className={`px-3 py-1 rounded-lg font-medium transition ${
              activeLang === 'hi' ? 'bg-cyan-500/20 text-cyan-300 font-bold' : 'text-slate-400'
            }`}
          >
            हिंदी
          </button>
        </div>
      </div>

      {/* Step by Step Guide Card */}
      <div className="p-5 rounded-3xl bg-slate-900/80 border border-slate-800 text-slate-300 space-y-4">
        {activeLang === 'en' ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80">
              <span className="w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-400 font-bold flex items-center justify-center mb-2">
                1
              </span>
              <h4 className="font-semibold text-white mb-1">One-Tap Install</h4>
              <p className="text-slate-400 leading-relaxed">
                Tap the <strong>"Install Ira App on Android"</strong> button above. If prompted by your browser, tap <strong>Install</strong>.
              </p>
            </div>
            <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80">
              <span className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 font-bold flex items-center justify-center mb-2">
                2
              </span>
              <h4 className="font-semibold text-white mb-1">Chrome / Browser Menu</h4>
              <p className="text-slate-400 leading-relaxed">
                If the prompt doesn't show automatically, tap the three dots <strong>(⋮)</strong> in Chrome and select <strong>"Install app"</strong> or <strong>"Add to Home Screen"</strong>.
              </p>
            </div>
            <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80">
              <span className="w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-400 font-bold flex items-center justify-center mb-2">
                3
              </span>
              <h4 className="font-semibold text-white mb-1">Grant Permissions</h4>
              <p className="text-slate-400 leading-relaxed">
                Allow microphone & camera access when prompted for real-time voice conversations and multimodal photo understanding.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80">
              <span className="w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-400 font-bold flex items-center justify-center mb-2">
                1
              </span>
              <h4 className="font-semibold text-white mb-1">इंस्टॉल बटन दबाएं</h4>
              <p className="text-slate-400 leading-relaxed">
                ऊपर दिए गए <strong>"Install Ira App on Android"</strong> बटन पर क्लिक करें। पॉप-अप आने पर <strong>Install</strong> चुनें।
              </p>
            </div>
            <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80">
              <span className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 font-bold flex items-center justify-center mb-2">
                2
              </span>
              <h4 className="font-semibold text-white mb-1">ब्राउज़र मेनू से जोड़ें</h4>
              <p className="text-slate-400 leading-relaxed">
                यदि बटन न दिखे, तो क्रोम के ऊपरी दाएं कोने में 3 डॉट्स <strong>(⋮)</strong> पर क्लिक करें और <strong>"Install app"</strong> या <strong>"Add to Home screen"</strong> चुनें।
              </p>
            </div>
            <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80">
              <span className="w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-400 font-bold flex items-center justify-center mb-2">
                3
              </span>
              <h4 className="font-semibold text-white mb-1">माइक और कैमरा अनुमति</h4>
              <p className="text-slate-400 leading-relaxed">
                वॉइस असिस्टेंट और फ़ोटो विश्लेषण के लिए माइक्रोफ़ोन और कैमरा की अनुमति दें। ईरा अब आपके होम स्क्रीन पर ऐप की तरह काम करेगी!
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Feature Specifications Grid */}
      <div>
        <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-cyan-400" />
          Ira Assistant Features on Android
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
          <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800">
            <Mic className="w-5 h-5 text-cyan-400 mb-2" />
            <h4 className="font-semibold text-white">Live Voice Mode</h4>
            <p className="text-slate-400 mt-1">
              Natural speech synthesis (Gemini 3.8 TTS) and real-time audio transcription (Gemini 3.5 Transcribe).
            </p>
          </div>
          <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800">
            <Layers className="w-5 h-5 text-blue-400 mb-2" />
            <h4 className="font-semibold text-white">12 Workspace Services</h4>
            <p className="text-slate-400 mt-1">
              Connect Google Drive, Gmail, Calendar, Sheets, Docs, Slides, Tasks, Meet, and Contacts with secure user confirmation.
            </p>
          </div>
          <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800">
            <Cpu className="w-5 h-5 text-purple-400 mb-2" />
            <h4 className="font-semibold text-white">High Thinking Level</h4>
            <p className="text-slate-400 mt-1">
              Powered by Gemini 3.1 Pro Preview with high reasoning mode for coding, planning, and complex queries.
            </p>
          </div>
          <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800">
            <Sparkles className="w-5 h-5 text-amber-400 mb-2" />
            <h4 className="font-semibold text-white">Creative Image Studio</h4>
            <p className="text-slate-400 mt-1">
              Text-to-image and image editing across 8 aspect ratios (1:1 to 21:9) and resolutions up to 4K.
            </p>
          </div>
          <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800">
            <Smartphone className="w-5 h-5 text-indigo-400 mb-2" />
            <h4 className="font-semibold text-white">Veo 3 Video Generator</h4>
            <p className="text-slate-400 mt-1">
              Text-to-video and photo-to-video generation with 16:9 Landscape and 9:16 Portrait aspect ratios.
            </p>
          </div>
          <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800">
            <Globe2 className="w-5 h-5 text-emerald-400 mb-2" />
            <h4 className="font-semibold text-white">English & Hindi Fluency</h4>
            <p className="text-slate-400 mt-1">
              Converses seamlessly in Hindi (हिंदी), Hinglish, and English tailored for personal daily use.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
