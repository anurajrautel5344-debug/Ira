import React, { useState, useEffect, useRef } from 'react';
import { VoiceOrb, AssistantState } from './VoiceOrb';
import { X, Mic, MicOff, Volume2, Sparkles, AlertCircle } from 'lucide-react';

interface VoiceModeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSendMessage: (text: string) => Promise<{ reply: string }>;
}

export const VoiceModeModal: React.FC<VoiceModeModalProps> = ({
  isOpen,
  onClose,
  onSendMessage,
}) => {
  const [state, setState] = useState<AssistantState>('idle');
  const [transcript, setTranscript] = useState('');
  const [assistantReply, setAssistantReply] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const speechRecognitionRef = useRef<any>(null);
  const recognitionTextRef = useRef<string>('');

  useEffect(() => {
    if (isOpen) {
      startListening();
    } else {
      stopAllAudio();
    }
    return () => {
      stopAllAudio();
    };
  }, [isOpen]);

  const stopAllAudio = () => {
    if (speechRecognitionRef.current) {
      try {
        speechRecognitionRef.current.abort();
      } catch {}
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
        mediaRecorderRef.current.stream.getTracks().forEach((t) => t.stop());
      } catch {}
    }
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
    }
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setState('idle');
  };

  const startListening = async () => {
    try {
      setErrorMessage('');
      setState('listening');
      setTranscript('Listening to your voice...');
      audioChunksRef.current = [];
      recognitionTextRef.current = '';

      // Check for native browser SpeechRecognition (zero API quota, native on Android)
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
              setTranscript(`"${current.trim()}"`);
            }
          };

          recognition.onerror = () => {
            // Silently fall back to media recorder
          };

          recognition.onend = () => {
            if (recognitionTextRef.current.trim()) {
              handleUserSpeech(recognitionTextRef.current.trim());
            }
          };

          speechRecognitionRef.current = recognition;
          recognition.start();
        } catch {}
      }

      // Also start MediaRecorder as companion fallback
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        // If native recognition didn't yield text, process audio blob
        if (!recognitionTextRef.current.trim()) {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          await processVoiceInput(audioBlob);
        }
      };

      mediaRecorder.start();
    } catch (err: any) {
      setErrorMessage('Microphone access is needed for voice assistant. Please enable mic permissions.');
      setState('idle');
    }
  };

  const stopListeningAndProcess = () => {
    if (speechRecognitionRef.current) {
      try {
        speechRecognitionRef.current.stop();
      } catch {}
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      setState('thinking');
      mediaRecorderRef.current.stop();
    } else if (recognitionTextRef.current.trim()) {
      handleUserSpeech(recognitionTextRef.current.trim());
    }
  };

  const processVoiceInput = async (blob: Blob) => {
    try {
      setState('thinking');
      setTranscript('Ira is understanding your voice...');

      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onloadend = () => {
          const res = reader.result as string;
          resolve(res.split(',')[1]);
        };
        reader.onerror = reject;
      });
      reader.readAsDataURL(blob);
      const audioBase64 = await base64Promise;

      // Call resilient backend transcribe endpoint
      const transcribeRes = await fetch('/api/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audioData: audioBase64, mimeType: 'audio/webm' }),
      });

      const transcribeData = await transcribeRes.json();
      const userText = transcribeData.text?.trim();

      if (!userText) {
        setTranscript("Didn't catch that. Tap the orb to try again.");
        setState('idle');
        return;
      }

      await handleUserSpeech(userText);
    } catch (err: any) {
      setErrorMessage('Voice processing paused. Tap orb to try again.');
      setState('idle');
    }
  };

  const handleUserSpeech = async (userText: string) => {
    try {
      setState('thinking');
      setTranscript(`"${userText}"`);

      // Chat with Ira
      const chatRes = await onSendMessage(userText);
      const reply = chatRes.reply;
      setAssistantReply(reply);

      // Playback voice response (Gemini TTS with fallback to browser SpeechSynthesis)
      await speakReply(reply);
    } catch (err: any) {
      setErrorMessage('Could not complete request. Please try again.');
      setState('idle');
    }
  };

  const speakReply = async (reply: string) => {
    setState('speaking');

    // Clean text for speech
    const cleanSpeech = reply.replace(/[*#_`]/g, '').slice(0, 1000);

    try {
      const speechRes = await fetch('/api/speech', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: cleanSpeech }),
      });

      if (speechRes.ok) {
        const speechData = await speechRes.json();
        if (speechData.audioUrl) {
          const audio = new Audio(speechData.audioUrl);
          audioPlayerRef.current = audio;
          audio.onended = () => setState('idle');
          audio.onerror = () => fallbackBrowserSpeech(cleanSpeech);
          await audio.play();
          return;
        }
      }
    } catch {}

    // Fallback: Browser native speech synthesis
    fallbackBrowserSpeech(cleanSpeech);
  };

  const fallbackBrowserSpeech = (text: string) => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.05;
      utterance.onend = () => setState('idle');
      utterance.onerror = () => setState('idle');
      window.speechSynthesis.speak(utterance);
    } else {
      setState('idle');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-xl p-4 animate-fade-in">
      <div className="w-full max-w-lg flex flex-col items-center justify-between min-h-[500px] h-[85vh] max-h-[700px] p-6 rounded-3xl bg-gradient-to-b from-slate-900 via-slate-950 to-slate-900 border border-slate-800 shadow-2xl relative text-white">
        {/* Top Bar */}
        <div className="w-full flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" />
            <h2 className="text-sm font-semibold tracking-wider uppercase text-cyan-300">
              Ira Voice Assistant
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Center Orb & Visualizer */}
        <div className="flex flex-col items-center justify-center my-auto w-full gap-6">
          <VoiceOrb
            state={state}
            size="lg"
            label={
              state === 'listening'
                ? 'Listening to you... (Tap to finish)'
                : state === 'thinking'
                ? 'Ira is thinking...'
                : state === 'speaking'
                ? 'Ira is speaking...'
                : 'Tap to speak'
            }
            onClick={() => {
              if (state === 'listening') {
                stopListeningAndProcess();
              } else if (state === 'idle') {
                startListening();
              }
            }}
          />

          {/* Transcript / Reply Display */}
          <div className="w-full max-w-md px-4 py-3 rounded-2xl bg-slate-900/60 border border-slate-800/80 text-center min-h-[90px] flex flex-col items-center justify-center">
            {transcript && (
              <p className="text-xs text-slate-400 mb-1 italic">
                {transcript}
              </p>
            )}
            {assistantReply && state === 'speaking' && (
              <p className="text-sm text-cyan-200 line-clamp-3 font-medium">
                {assistantReply}
              </p>
            )}
            {!transcript && !assistantReply && (
              <p className="text-xs text-slate-500">
                Speak naturally in Hindi or English. Ira understands both.
              </p>
            )}
          </div>

          {errorMessage && (
            <div className="flex items-center gap-2 text-rose-400 text-xs px-3 py-2 rounded-xl bg-rose-500/10 border border-rose-500/20">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}
        </div>

        {/* Bottom Voice Controls */}
        <div className="w-full flex items-center justify-around pt-4 border-t border-slate-800/60">
          <button
            onClick={() => {
              if (state === 'listening') {
                stopListeningAndProcess();
              } else {
                startListening();
              }
            }}
            className={`p-4 rounded-full transition shadow-lg ${
              state === 'listening'
                ? 'bg-rose-500 hover:bg-rose-600 text-white shadow-rose-900/40'
                : 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-cyan-900/40 font-bold'
            }`}
          >
            {state === 'listening' ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
          </button>
        </div>
      </div>
    </div>
  );
};
