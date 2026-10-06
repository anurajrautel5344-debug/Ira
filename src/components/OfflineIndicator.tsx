import React from 'react';
import { useOnlineStatus } from '../hooks/usePWAInstall';
import { WifiOff } from 'lucide-react';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 sm:left-auto sm:right-6 sm:w-auto z-50 flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-amber-500/90 text-slate-950 font-medium text-xs shadow-2xl backdrop-blur-md animate-bounce">
      <WifiOff className="w-4 h-4" />
      <span>Offline Mode — Ira is running from device cache.</span>
    </div>
  );
};
