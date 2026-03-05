
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { UserProfile } from '../types';
import { geminiService } from '../services/geminiService';
import { LiveServerMessage } from '@google/genai';

interface CallRoomProps {
  partner: UserProfile;
  onClose: () => void;
}

const CallRoom: React.FC<CallRoomProps> = ({ partner, onClose }) => {
  const [status, setStatus] = useState<'connecting' | 'active' | 'ended'>('connecting');
  const [callTime, setCallTime] = useState(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  // Fix: Use number for browser setInterval instead of NodeJS.Timeout
  const timerRef = useRef<number | null>(null);

  // Audio utility functions
  const decode = (base64: string) => {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  };

  const encode = (bytes: Uint8Array) => {
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  };

  const decodeAudioData = async (data: Uint8Array, ctx: AudioContext, sampleRate: number, numChannels: number): Promise<AudioBuffer> => {
    const dataInt16 = new Int16Array(data.buffer);
    const frameCount = dataInt16.length / numChannels;
    const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
    for (let channel = 0; channel < numChannels; channel++) {
      const channelData = buffer.getChannelData(channel);
      for (let i = 0; i < frameCount; i++) {
        channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
      }
    }
    return buffer;
  };

  const createBlob = (data: Float32Array) => {
    const l = data.length;
    const int16 = new Int16Array(l);
    for (let i = 0; i < l; i++) {
      int16[i] = data[i] * 32768;
    }
    return {
      data: encode(new Uint8Array(int16.buffer)),
      mimeType: 'audio/pcm;rate=16000',
    };
  };

  useEffect(() => {
    let activeSession: any = null;
    let stream: MediaStream | null = null;

    const startCall = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
        outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });

        const sessionPromise = geminiService.connectVoice(partner, {
          onopen: () => {
            setStatus('active');
            // Fix: window.setInterval returns a number in browsers
            timerRef.current = window.setInterval(() => setCallTime(t => t + 1), 1000);

            const source = audioContextRef.current!.createMediaStreamSource(stream!);
            const scriptProcessor = audioContextRef.current!.createScriptProcessor(4096, 1, 1);
            
            scriptProcessor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              const pcmBlob = createBlob(inputData);
              // CRITICAL: Solely rely on sessionPromise resolves and then call `session.sendRealtimeInput`
              sessionPromise.then(session => {
                session.sendRealtimeInput({ media: pcmBlob });
              });
            };

            source.connect(scriptProcessor);
            scriptProcessor.connect(audioContextRef.current!.destination);
          },
          onmessage: async (message: LiveServerMessage) => {
            const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (base64Audio && outputAudioContextRef.current) {
              const ctx = outputAudioContextRef.current;
              // Schedule next chunk for smooth, gapless playback
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);
              const audioBuffer = await decodeAudioData(decode(base64Audio), ctx, 24000, 1);
              const source = ctx.createBufferSource();
              source.buffer = audioBuffer;
              source.connect(ctx.destination);
              source.addEventListener('ended', () => sourcesRef.current.delete(source));
              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += audioBuffer.duration;
              sourcesRef.current.add(source);
            }

            if (message.serverContent?.interrupted) {
              sourcesRef.current.forEach(s => {
                try { s.stop(); } catch (e) {}
              });
              sourcesRef.current.clear();
              nextStartTimeRef.current = 0;
            }
          },
          onerror: (e: any) => console.error("Call error", e),
          onclose: () => setStatus('ended')
        });

        activeSession = await sessionPromise;
      } catch (err) {
        console.error("Failed to start call", err);
        setStatus('ended');
      }
    };

    startCall();

    return () => {
      if (activeSession) activeSession.close();
      if (timerRef.current) clearInterval(timerRef.current);
      if (stream) stream.getTracks().forEach(track => track.stop());
      if (audioContextRef.current) audioContextRef.current.close();
      if (outputAudioContextRef.current) outputAudioContextRef.current.close();
    };
  }, [partner]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-between bg-[#075e54] p-8 text-white">
      <div className="text-center mt-12">
        <img src={partner.avatar} className="w-32 h-32 rounded-full border-4 border-[#25d366] mx-auto shadow-2xl animate-pulse" />
        <h2 className="text-2xl font-bold mt-6">{partner.name}</h2>
        <p className="text-[#25d366] font-medium mt-1">
          {status === 'connecting' ? 'Calling...' : status === 'active' ? formatTime(callTime) : 'Call Ended'}
        </p>
      </div>

      <div className="w-full max-w-xs space-y-4">
        {status === 'active' && (
           <div className="bg-white/10 backdrop-blur-md p-4 rounded-2xl text-center text-sm border border-white/20">
             <p className="opacity-80">Practice your {partner.nativeLanguage} skills</p>
             <p className="font-bold text-[#25d366] mt-1 italic">"Speak naturally!"</p>
           </div>
        )}
      </div>

      <div className="mb-12 flex space-x-8">
        <button className="p-4 bg-white/10 hover:bg-white/20 rounded-full transition-colors">
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
          </svg>
        </button>
        <button 
          onClick={onClose}
          className="p-4 bg-red-500 hover:bg-red-600 rounded-full shadow-lg transform active:scale-90 transition-all"
        >
          <svg className="w-8 h-8 rotate-135" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08a.994.994 0 01-.29-.7c0-.28.11-.53.29-.71C3.34 8.78 7.46 7 12 7s8.66 1.78 11.71 4.67c.18.18.29.43.29.71 0 .28-.11.53-.29.71l-2.48 2.48c-.18.18-.43.29-.71.29-.27 0-.52-.11-.7-.28-.79-.74-1.69-1.36-2.67-1.85-.33-.16-.56-.5-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z" />
          </svg>
        </button>
        <button className="p-4 bg-white/10 hover:bg-white/20 rounded-full transition-colors">
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default CallRoom;
