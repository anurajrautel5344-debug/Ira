import React from 'react';
import { Mic, Volume2, Sparkles, Loader2 } from 'lucide-react';

export type AssistantState = 'idle' | 'listening' | 'thinking' | 'speaking';

interface VoiceOrbProps {
  state: AssistantState;
  onClick?: () => void;
  size?: 'sm' | 'md' | 'lg';
  label?: string;
}

export const VoiceOrb: React.FC<VoiceOrbProps> = ({
  state,
  onClick,
  size = 'md',
  label,
}) => {
  const sizeClasses = {
    sm: 'w-10 h-10',
    md: 'w-20 h-20',
    lg: 'w-36 h-36',
  };

  const ringSizes = {
    sm: 'w-16 h-16',
    md: 'w-32 h-32',
    lg: 'w-52 h-52',
  };

  return (
    <div className="flex flex-col items-center justify-center gap-3">
      <div className="relative flex items-center justify-center">
        {/* Outer glowing pulsing aura */}
        {(state === 'listening' || state === 'speaking') && (
          <div
            className={`absolute ${ringSizes[size]} rounded-full bg-cyan-500/20 blur-xl animate-ping opacity-60`}
          />
        )}
        {state === 'thinking' && (
          <div
            className={`absolute ${ringSizes[size]} rounded-full bg-purple-500/25 blur-xl animate-pulse opacity-70`}
          />
        )}

        {/* Ambient Ring */}
        <div
          className={`absolute ${ringSizes[size]} rounded-full border border-cyan-500/20 transition-all duration-700 ${
            state === 'listening' ? 'scale-110 border-cyan-400/50' : 'scale-100'
          }`}
        />

        {/* Core Interactive Orb */}
        <button
          type="button"
          onClick={onClick}
          aria-label={label || `Ira Assistant is ${state}`}
          className={`relative ${sizeClasses[size]} rounded-full flex items-center justify-center cursor-pointer transition-all duration-500 transform active:scale-95 shadow-2xl focus:outline-none ${
            state === 'listening'
              ? 'bg-gradient-to-tr from-rose-500 via-pink-500 to-amber-400 shadow-rose-500/50 scale-105'
              : state === 'thinking'
              ? 'bg-gradient-to-tr from-violet-600 via-purple-500 to-indigo-500 shadow-purple-500/50 rotate-180 animate-spin-slow'
              : state === 'speaking'
              ? 'bg-gradient-to-tr from-cyan-400 via-teal-400 to-emerald-400 shadow-cyan-500/50 scale-105'
              : 'bg-gradient-to-tr from-cyan-500 via-blue-600 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 shadow-cyan-600/30'
          }`}
        >
          {/* Inner Light Ripple */}
          <div className="absolute inset-1 rounded-full bg-white/20 backdrop-blur-sm pointer-events-none" />

          {/* Central Icon */}
          <div className="relative text-white z-10 transition-transform">
            {state === 'listening' && <Mic className="w-1/2 h-1/2 animate-pulse mx-auto" />}
            {state === 'thinking' && <Loader2 className="w-1/2 h-1/2 animate-spin mx-auto" />}
            {state === 'speaking' && <Volume2 className="w-1/2 h-1/2 animate-bounce mx-auto" />}
            {state === 'idle' && <Sparkles className="w-1/2 h-1/2 mx-auto" />}
          </div>
        </button>
      </div>

      {label && (
        <span className="text-xs font-medium tracking-wide text-slate-400 transition-colors">
          {label}
        </span>
      )}
    </div>
  );
};
