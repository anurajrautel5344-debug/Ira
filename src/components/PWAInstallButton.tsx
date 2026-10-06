import React, { useState } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { Download, Smartphone, CheckCircle, Share } from 'lucide-react';

interface PWAInstallButtonProps {
  variant?: 'compact' | 'full';
  onOpenApkHub?: () => void;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  variant = 'compact',
  onOpenApkHub,
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [installing, setInstalling] = useState(false);

  const handleInstallClick = async () => {
    if (isInstallable) {
      setInstalling(true);
      try {
        await install();
      } finally {
        setInstalling(false);
      }
    } else if (onOpenApkHub) {
      onOpenApkHub();
    }
  };

  if (isInstalled) {
    if (variant === 'compact') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          <CheckCircle className="w-3.5 h-3.5" />
          <span>Ira App Installed</span>
        </span>
      );
    }
    return null;
  }

  return (
    <>
      {variant === 'compact' ? (
        <button
          onClick={handleInstallClick}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-xs font-medium shadow-md shadow-cyan-900/20 active:scale-95 transition"
          title="Install Ira Assistant on Android"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Install APK</span>
        </button>
      ) : (
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full">
          <button
            onClick={handleInstallClick}
            disabled={installing}
            className="flex-1 w-full flex items-center justify-center gap-3 px-6 py-3.5 rounded-2xl bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-semibold shadow-lg shadow-cyan-500/20 transition active:scale-98 disabled:opacity-70"
          >
            <Smartphone className="w-5 h-5" />
            <span>{isInstallable ? 'Install Ira on Android Device' : 'Open Android APK Hub'}</span>
          </button>
          {isIOS && (
            <button
              onClick={() => setShowIOSGuide(true)}
              className="px-4 py-3 rounded-2xl border border-slate-700 hover:bg-slate-800 text-slate-300 text-sm font-medium transition"
            >
              iOS Setup
            </button>
          )}
        </div>
      )}

      {/* iOS Safari Guide Modal */}
      {showIOSGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl bg-slate-900 border border-slate-700 p-6 shadow-2xl text-slate-200">
            <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
              <Share className="w-5 h-5 text-cyan-400" />
              Add Ira to Home Screen
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              To install Ira on an Apple device running Safari:
            </p>
            <ol className="text-xs text-slate-300 space-y-2 mb-6 list-decimal list-inside bg-slate-950 p-3 rounded-xl border border-slate-800">
              <li>Tap the <strong className="text-cyan-400">Share</strong> button in Safari's bottom toolbar.</li>
              <li>Scroll down the actions list.</li>
              <li>Tap <strong className="text-cyan-400">Add to Home Screen</strong>.</li>
              <li>Tap <strong className="text-cyan-400">Add</strong> in the top right corner.</li>
            </ol>
            <button
              onClick={() => setShowIOSGuide(false)}
              className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold transition"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
};
