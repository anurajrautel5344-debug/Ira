import React, { useState } from 'react';
import { ChatTab } from './components/ChatTab';
import { WorkspaceTab } from './components/WorkspaceTab';
import { CreativeTab } from './components/CreativeTab';
import { ApkTab } from './components/ApkTab';
import { VoiceModeModal } from './components/VoiceModeModal';
import { PWAInstallButton } from './components/PWAInstallButton';
import { OfflineIndicator } from './components/OfflineIndicator';
import {
  MessageSquare,
  Layers,
  Sparkles,
  Smartphone,
  Headphones,
  ShieldCheck,
  Wifi,
  BatteryCharging,
} from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<'chat' | 'workspace' | 'creative' | 'apk'>('chat');
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);

  // Helper for Voice Mode to invoke chat API
  const handleVoiceSendMessage = async (text: string) => {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', text }],
        modelMode: 'fast',
      }),
    });
    if (!res.ok) {
      throw new Error('Failed to get voice reply');
    }
    const data = await res.json();
    return { reply: data.text || 'Ira processed your voice request.' };
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-slate-950 text-slate-100 overflow-hidden font-sans select-none antialiased">
      {/* Android Emulated Status Bar (Aesthetic native Android touch) */}
      <div className="px-4 py-1.5 bg-slate-950 border-b border-slate-900/60 flex items-center justify-between text-[11px] text-slate-400">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-white tracking-tight">
            {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
          <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-900 text-cyan-400 font-mono">
            5G
          </span>
        </div>
        <div className="flex items-center gap-2.5 text-slate-400">
          <Wifi className="w-3.5 h-3.5" />
          <BatteryCharging className="w-3.5 h-3.5 text-emerald-400" />
          <span className="text-[10px] font-mono">100%</span>
        </div>
      </div>

      {/* Main Top Header */}
      <header className="px-4 py-2.5 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 flex items-center justify-between z-20 shrink-0">
        {/* Ira Brand & Avatar */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-cyan-400 via-blue-500 to-indigo-600 p-0.5 shadow-md shadow-cyan-500/20">
              <div className="w-full h-full rounded-[14px] bg-slate-950 flex items-center justify-center text-cyan-300">
                <Sparkles className="w-4 h-4" />
              </div>
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-slate-950" />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold text-white tracking-tight">Ira</h1>
              <span className="text-[11px] font-medium text-cyan-400">ईरा</span>
              <span className="hidden sm:inline-block text-[10px] px-1.5 py-0.2 rounded-md bg-slate-800 text-slate-400">
                Personal AI Assistant
              </span>
            </div>
            <p className="text-[10px] text-slate-400 flex items-center gap-1">
              <span>Android Ready</span>
              <span>•</span>
              <span className="text-emerald-400">Workspace Connected</span>
            </p>
          </div>
        </div>

        {/* Header Right Actions */}
        <div className="flex items-center gap-2">
          {/* Hands-free Voice Button */}
          <button
            onClick={() => setIsVoiceModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-cyan-500/20 to-indigo-500/20 hover:from-cyan-500/30 hover:to-indigo-500/30 border border-cyan-500/40 text-cyan-300 text-xs font-semibold shadow-sm transition active:scale-95"
            title="Launch Hands-free Voice Assistant"
          >
            <Headphones className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Voice Mode</span>
          </button>

          {/* PWA / APK Install Button */}
          <PWAInstallButton
            variant="compact"
            onOpenApkHub={() => setActiveTab('apk')}
          />
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-hidden relative bg-slate-950">
        {activeTab === 'chat' && (
          <ChatTab
            onOpenVoiceModal={() => setIsVoiceModalOpen(true)}
            onOpenWorkspace={() => setActiveTab('workspace')}
          />
        )}
        {activeTab === 'workspace' && <WorkspaceTab />}
        {activeTab === 'creative' && <CreativeTab />}
        {activeTab === 'apk' && <ApkTab />}
      </main>

      {/* Bottom Navigation Bar (Android Mobile-first style) */}
      <nav className="bg-slate-900/95 backdrop-blur-md border-t border-slate-800 px-2 py-1.5 z-20 shrink-0">
        <div className="max-w-md mx-auto grid grid-cols-4 gap-1 text-center">
          <button
            onClick={() => setActiveTab('chat')}
            className={`flex flex-col items-center justify-center py-1.5 rounded-2xl transition ${
              activeTab === 'chat'
                ? 'text-cyan-400 bg-cyan-500/10'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <MessageSquare className="w-4 h-4 mb-0.5" />
            <span className="text-[10px] font-semibold">Assistant</span>
          </button>

          <button
            onClick={() => setActiveTab('workspace')}
            className={`flex flex-col items-center justify-center py-1.5 rounded-2xl transition ${
              activeTab === 'workspace'
                ? 'text-blue-400 bg-blue-500/10'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-4 h-4 mb-0.5" />
            <span className="text-[10px] font-semibold">Workspace</span>
          </button>

          <button
            onClick={() => setActiveTab('creative')}
            className={`flex flex-col items-center justify-center py-1.5 rounded-2xl transition ${
              activeTab === 'creative'
                ? 'text-purple-400 bg-purple-500/10'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sparkles className="w-4 h-4 mb-0.5" />
            <span className="text-[10px] font-semibold">Creative</span>
          </button>

          <button
            onClick={() => setActiveTab('apk')}
            className={`flex flex-col items-center justify-center py-1.5 rounded-2xl transition ${
              activeTab === 'apk'
                ? 'text-emerald-400 bg-emerald-500/10'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Smartphone className="w-4 h-4 mb-0.5" />
            <span className="text-[10px] font-semibold">Android APK</span>
          </button>
        </div>
      </nav>

      {/* Voice Mode Modal */}
      <VoiceModeModal
        isOpen={isVoiceModalOpen}
        onClose={() => setIsVoiceModalOpen(false)}
        onSendMessage={handleVoiceSendMessage}
      />

      {/* Offline Status Toast */}
      <OfflineIndicator />
    </div>
  );
}
