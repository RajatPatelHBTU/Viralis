'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, Phone, Wifi, Volume2, User, MapPin, Clock, Send, CheckCircle, Pause, Play, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface VoiceInterfaceProps {
  brand: any;
  brandId: string;
}

type ConnectionStatus = 'IDLE' | 'CONNECTING' | 'LIVE' | 'ERROR';

export default function VoiceInterface({ brand, brandId }: VoiceInterfaceProps) {
  const [currentBrand, setCurrentBrand] = useState(brand);
  const [status, setStatus] = useState<ConnectionStatus>('IDLE');
  const [micPermission, setMicPermission] = useState<boolean>(false);
  const [isTalking, setIsTalking] = useState(false);
  const [isListeningMode, setIsListeningMode] = useState<boolean>(true);
  const [showContact, setShowContact] = useState(false);

  // Auto-fetch fresh brand profile on client if needed
  useEffect(() => {
    if (brand?.needsClientFetch || !currentBrand?.name || currentBrand.name === 'AI Voice Assistant') {
      import('@/lib/api/client').then(({ default: api }) => {
        api.get(`/public/brand/${brandId}`)
          .then((res) => {
            if (res.data) setCurrentBrand(res.data);
          })
          .catch(() => {});
      });
    }
  }, [brandId]);

  // New State for Lead Capture
  const [showLeadForm, setShowLeadForm] = useState(false);
  const [userInterested, setUserInterested] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [leadSubmitted, setLeadSubmitted] = useState(false);
  const [leadFormData, setLeadFormData] = useState({ name: '', phone: '', email: '' });
  const [latestCaption, setLatestCaption] = useState<string>('');
  const [latestUserTranscript, setLatestUserTranscript] = useState<string>('');
  const [textInput, setTextInput] = useState<string>('');

  const sendQuestion = (text: string) => {
    const cleanText = text.trim();
    if (!cleanText || wsRef.current?.readyState !== WebSocket.OPEN) return;
    setLatestUserTranscript(cleanText);
    setLatestCaption(cleanText);
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setIsTalking(false);
    wsRef.current.send(JSON.stringify({ type: 'user_speech', text: cleanText }));
  };

  // Refs
  const wsRef = useRef<WebSocket | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<any>(null);
  const sourceRef = useRef<any>(null);
  const recognitionRef = useRef<any>(null);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const currentAudioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const fallbackTtsTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastAiTextRef = useRef<string>('');
  const isTalkingRef = useRef<boolean>(false);
  const isListeningModeRef = useRef<boolean>(true);
  const statusRef = useRef<ConnectionStatus>('IDLE');
  const callStartTimeRef = useRef<number>(0);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    isTalkingRef.current = isTalking;
  }, [isTalking]);

  useEffect(() => {
    isListeningModeRef.current = isListeningMode;
  }, [isListeningMode]);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  const handleStartListening = () => {
    if (statusRef.current === 'IDLE') {
      startCall();
      return;
    }
    if (statusRef.current !== 'LIVE') return;

    console.log('🎙️ Switching to Listening mode');
    // Stop any AI audio playback immediately
    if (currentAudioSourceRef.current) {
      try { currentAudioSourceRef.current.stop(); } catch {}
      currentAudioSourceRef.current = null;
    }
    if (currentAudioRef.current) {
      try { currentAudioRef.current.pause(); } catch {}
      currentAudioRef.current = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    if (fallbackTtsTimerRef.current) {
      clearTimeout(fallbackTtsTimerRef.current);
      fallbackTtsTimerRef.current = null;
    }

    setIsTalking(false);
    setIsListeningMode(true);
    setLatestUserTranscript('');

    if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume().catch(() => {});
    }

    if (recognitionRef.current) {
      try {
        recognitionRef.current.start();
      } catch {}
    }

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'start_listening' }));
    }
  };

  const handlePauseToReply = () => {
    if (statusRef.current !== 'LIVE') return;

    console.log('⏸️ Pause to Reply tapped');
    setIsListeningMode(false);

    // Stop recognition to seal the user's utterance
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
    }

    const textToReply = latestUserTranscript.trim() || latestCaption.trim();

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'pause_reply',
        text: textToReply
      }));
    }

    if (textToReply) {
      setLatestCaption(textToReply);
    }
  };

  const handleCenterToggle = () => {
    if (status === 'IDLE') {
      startCall();
    } else if (status === 'LIVE') {
      if (isListeningMode && !isTalking) {
        handlePauseToReply();
      } else {
        handleStartListening();
      }
    }
  };

  const speakWithBrowser = (text: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.onstart = () => {
        setIsTalking(true);
        setIsListeningMode(false);
      };
      utterance.onend = () => {
        setIsTalking(false);
        setIsListeningMode(true);
        if (recognitionRef.current) {
          try { recognitionRef.current.start(); } catch {}
        }
      };
      utterance.onerror = () => {
        setIsTalking(false);
        setIsListeningMode(true);
      };
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn('SpeechSynthesis error:', e);
      setIsTalking(false);
      setIsListeningMode(true);
    }
  };

  const endCall = () => {
    if (fallbackTtsTimerRef.current) {
      clearTimeout(fallbackTtsTimerRef.current);
      fallbackTtsTimerRef.current = null;
    }
    if (currentAudioSourceRef.current) {
      try { currentAudioSourceRef.current.stop(); } catch {}
      currentAudioSourceRef.current = null;
    }
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
      recognitionRef.current = null;
    }
    wsRef.current?.close();
    mediaStreamRef.current?.getTracks().forEach(track => track.stop());
    if (processorRef.current) {
      try {
        processorRef.current.disconnect();
      } catch {}
      processorRef.current = null;
    }
    if (sourceRef.current) {
      try {
        sourceRef.current.disconnect();
      } catch {}
      sourceRef.current = null;
    }
    audioContextRef.current?.close();
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
    }
    setIsTalking(false);
    setLatestCaption('');
    setLatestUserTranscript('');
    setStatus('IDLE');
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      endCall();
    };
  }, []);

  const startSpeechRecognition = () => {
    if (typeof window === 'undefined') return;
    const SpeechRecognitionClass = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognitionClass) {
      console.log('Browser SpeechRecognition not available; using binary Deepgram audio stream.');
      return;
    }

    try {
      const recognition = new SpeechRecognitionClass();
      recognitionRef.current = recognition;
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      let silenceTimer: any = null;

      recognition.onresult = (event: any) => {
        let finalTranscript = '';
        let interimTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const trans = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += trans;
          } else {
            interimTranscript += trans;
          }
        }

        const currentSpeech = (finalTranscript || interimTranscript).trim();
        if (currentSpeech) {
          setLatestUserTranscript(currentSpeech);
          setLatestCaption(currentSpeech);

          // If AI was speaking, user is barging in: stop AI audio
          if (currentAudioRef.current) {
            currentAudioRef.current.pause();
            currentAudioRef.current = null;
          }
          if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
            window.speechSynthesis.cancel();
          }
          setIsTalking(false);
        }

        const dispatchUtterance = (text: string) => {
          const cleanText = text.trim();
          if (cleanText && cleanText.length > 1) {
            console.log('🗣️ Local SpeechRecognition sending utterance:', cleanText);
            setLatestUserTranscript(cleanText);
            setLatestCaption(cleanText);
            if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
              wsRef.current.send(JSON.stringify({
                type: 'user_speech',
                text: cleanText
              }));
            }
          }
        };

        if (finalTranscript.trim()) {
          if (silenceTimer) clearTimeout(silenceTimer);
          dispatchUtterance(finalTranscript);
        } else if (interimTranscript.trim() && interimTranscript.trim().length > 3) {
          if (silenceTimer) clearTimeout(silenceTimer);
          silenceTimer = setTimeout(() => {
            dispatchUtterance(interimTranscript);
          }, 350);
        }
      };

      recognition.onerror = (event: any) => {
        if (event.error !== 'no-speech') {
          console.warn('SpeechRecognition error:', event.error);
        }
      };

      recognition.onend = () => {
        if (statusRef.current === 'LIVE' && recognitionRef.current) {
          try {
            recognition.start();
          } catch {}
        }
      };

      recognition.start();
    } catch (e) {
      console.warn('Could not initialize SpeechRecognition:', e);
    }
  };

  const startCall = async () => {
    setStatus('CONNECTING');
    setUserInterested(false);
    setShowLeadForm(false);
    setLeadSubmitted(false);
    setCallDuration(0);
    setLatestCaption('');
    setLatestUserTranscript('');

    try {
      // 1. Get Mic Permission
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      setMicPermission(true);

      // 2. Connect WebSocket
      let voiceUrl = process.env.NEXT_PUBLIC_VOICE_URL;
      const isRemoteBrowser = typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';

      // Always use secure Render WebSocket when browsing on a remote domain (like Vercel)
      if (!voiceUrl || (isRemoteBrowser && (voiceUrl.includes('localhost') || voiceUrl.includes('127.0.0.1')))) {
        voiceUrl = isRemoteBrowser
          ? 'wss://viralis-backend-1q05.onrender.com'
          : 'ws://localhost:5000';
      }

      console.log('🔌 Connecting to Voice Server:', voiceUrl);
      const wsUrl = `${voiceUrl}?brandId=${brandId}`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setStatus('LIVE');
        callStartTimeRef.current = Date.now();
        setupAudioProcessing(stream);
        startSpeechRecognition();

        // Start timer
        timerIntervalRef.current = setInterval(() => {
          setCallDuration(Math.floor((Date.now() - callStartTimeRef.current) / 1000));
        }, 1000);
      };

      ws.onmessage = async (event) => {
        if (event.data instanceof Blob) {
          // Received Audio Blob from AI
          playAudioBlob(event.data);
        } else if (typeof event.data === 'string') {
          try {
            const msg = JSON.parse(event.data);
            if (msg.type === 'transcript') {
              console.log(`[${msg.role || 'ai'}]:`, msg.text);
              if (msg.role === 'ai') {
                lastAiTextRef.current = msg.text;
                setLatestCaption(msg.text);
                setLatestUserTranscript('');

                // Schedule browser speech synthesis fallback if no audio blob arrives within 700ms
                if (fallbackTtsTimerRef.current) clearTimeout(fallbackTtsTimerRef.current);
                fallbackTtsTimerRef.current = setTimeout(() => {
                  speakWithBrowser(msg.text);
                }, 400);
              } else if (msg.role === 'user') {
                setLatestUserTranscript(msg.text);
                setLatestCaption(msg.text);
              }
            } else if (msg.type === 'speak_text' && msg.text) {
              lastAiTextRef.current = msg.text;
              setLatestCaption(msg.text);
              speakWithBrowser(msg.text);
            } else if (msg.type === 'interest_detected' && msg.interested) {
              console.log('📩 Interest detected by agent');
              setUserInterested(true);
            } else if (msg.type === 'lead_saved') {
              setLeadSubmitted(true);
              toast.success('Your request was logged!');
            }
          } catch {
            console.log('Received text:', event.data);
          }
        }
      };

      ws.onerror = (err) => {
        console.error('WebSocket Error', err);
        setStatus('ERROR');
        toast.error('Voice connection issue. Please check server status.');
      };

      ws.onclose = () => {
        if (timerIntervalRef.current) {
          clearInterval(timerIntervalRef.current);
        }
        if (status === 'LIVE' || status === 'CONNECTING') {
          if (userInterested) {
            toast.success('Conversation logged! Our team will reach out.');
          } else {
            toast.info('Call ended. Thank you for connecting!');
          }
          setStatus('IDLE');
        }
      };

    } catch (err) {
      console.error('Mic Error', err);
      setStatus('ERROR');
      toast.error('Microphone access denied or audio initialization error.');
    }
  };

  const setupAudioProcessing = async (stream: MediaStream) => {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    audioContextRef.current = audioContext;

    if (audioContext.state === 'suspended') {
      await audioContext.resume();
    }
    console.log(`🎤 Native Sample Rate: ${audioContext.sampleRate}`);

    const source = audioContext.createMediaStreamSource(stream);
    sourceRef.current = source;

    const processor = audioContext.createScriptProcessor(4096, 1, 1);
    processorRef.current = processor; // Store reference so GC does not collect it!

    // Connect through a mute gain node to prevent speaker feedback loop
    const muteGain = audioContext.createGain();
    muteGain.gain.value = 0;

    source.connect(processor);
    processor.connect(muteGain);
    muteGain.connect(audioContext.destination);

    processor.onaudioprocess = (e) => {
      if (wsRef.current?.readyState === WebSocket.OPEN && isListeningModeRef.current) {
        const inputData = e.inputBuffer.getChannelData(0);
        const downsampled = downsampleBuffer(inputData, audioContext.sampleRate, 16000);
        const buffer = convertFloat32ToInt16(downsampled);
        wsRef.current.send(buffer);
      }
    };
  };

  const downsampleBuffer = (buffer: Float32Array, sampleRate: number, outSampleRate: number) => {
    if (outSampleRate === sampleRate) return buffer;
    if (outSampleRate > sampleRate) return buffer;
    const sampleRateRatio = sampleRate / outSampleRate;
    const newLength = Math.round(buffer.length / sampleRateRatio);
    const result = new Float32Array(newLength);
    let offsetResult = 0;
    let offsetBuffer = 0;
    while (offsetResult < result.length) {
      const nextOffsetBuffer = Math.round((offsetResult + 1) * sampleRateRatio);
      let accum = 0, count = 0;
      for (let i = offsetBuffer; i < nextOffsetBuffer && i < buffer.length; i++) {
        accum += buffer[i];
        count++;
      }
      result[offsetResult] = accum / count;
      offsetResult++;
      offsetBuffer = nextOffsetBuffer;
    }
    return result;
  };

  const convertFloat32ToInt16 = (buffer: Float32Array) => {
    let l = buffer.length;
    const buf = new Int16Array(l);
    while (l--) {
      const s = Math.max(-1, Math.min(1, buffer[l]));
      buf[l] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    return buf.buffer;
  };

  const playAudioBlob = async (blob: Blob) => {
    // Clear any pending browser speech synthesis fallback
    if (fallbackTtsTimerRef.current) {
      clearTimeout(fallbackTtsTimerRef.current);
      fallbackTtsTimerRef.current = null;
    }

    try {
      if (currentAudioSourceRef.current) {
        try { currentAudioSourceRef.current.stop(); } catch {}
        currentAudioSourceRef.current = null;
      }
      if (currentAudioRef.current) {
        try { currentAudioRef.current.pause(); } catch {}
        currentAudioRef.current = null;
      }

      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }

      const arrayBuffer = await blob.arrayBuffer();
      // Decode audio data natively with Web Audio API for 0ms latency hardware playback
      const audioBuffer = await audioContextRef.current.decodeAudioData(arrayBuffer.slice(0));
      const source = audioContextRef.current.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContextRef.current.destination);

      currentAudioSourceRef.current = source;
      setIsTalking(true);
      setIsListeningMode(false);

      source.onended = () => {
        setIsTalking(false);
        currentAudioSourceRef.current = null;
        setIsListeningMode(true);
        if (recognitionRef.current) {
          try { recognitionRef.current.start(); } catch {}
        }
      };

      source.start(0);
    } catch (e) {
      console.warn('Web Audio decode failed, falling back to instant speech synthesis:', e);
      setIsTalking(false);
      if (lastAiTextRef.current) {
        speakWithBrowser(lastAiTextRef.current);
      }
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleLeadSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || (process.env.NODE_ENV === 'production' ? 'https://viralis-backend-1q05.onrender.com/api' : 'http://localhost:5000/api');
      const cleanUrl = apiUrl.replace(/\/+$/, '');
      const response = await fetch(`${cleanUrl}/voice/webhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brandId: brandId,
          businessId: brandId,
          callerNumber: leadFormData.phone || 'web-form',
          callerName: leadFormData.name || 'Web Visitor',
          email: leadFormData.email,
          transcript: 'Lead submitted via voice assistant interface',
          duration: callDuration,
          sentiment: 'positive',
          status: 'lead_captured',
          userInterested: true
        })
      });

      if (response.ok) {
        setLeadSubmitted(true);
        toast.success('Thank you! Details submitted successfully.');
      } else {
        toast.error('Failed to submit. Please try again.');
      }
    } catch (err) {
      console.error('Lead submit error:', err);
      toast.error('Connection error. Please try again.');
    }
  };

  return (
    <div className="flex flex-col h-[100dvh] bg-[#FDFCFF] text-gray-900 overflow-hidden relative font-sans selection:bg-purple-100">
      {/* Background Ambience */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-purple-200/40 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-blue-200/40 rounded-full blur-[120px]" />
      </div>

      {/* Header */}
      <header className="absolute top-0 w-full p-6 flex justify-between items-start z-10">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-gray-900">
            {currentBrand?.name || 'AI Assistant'}
          </h1>
          <div className="flex items-center gap-1.5 mt-1">
            <span className="flex h-2 w-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]"></span>
            <span className="text-xs text-gray-500 font-medium tracking-wider uppercase">Verified AI Agent</span>
          </div>
        </div>
        <div className="bg-white/80 backdrop-blur-md border border-gray-200 shadow-sm rounded-full px-3 py-1.5 flex items-center gap-2">
          <div className={cn("w-2 h-2 rounded-full transition-colors duration-300", status === 'LIVE' ? "bg-green-500 animate-pulse" : "bg-gray-300")} />
          <span className="text-xs font-mono text-gray-500 font-medium">
            {status === 'LIVE' ? formatDuration(callDuration) : status}
          </span>
        </div>
      </header>

      {/* Main Content (Orb & Middle Controls) */}
      <main className="flex-1 flex flex-col items-center justify-center relative z-0 py-4">

        {/* The Orb */}
        <div className="relative group cursor-pointer" onClick={handleCenterToggle}>
          {/* Ping Animations */}
          {status === 'LIVE' && (
            <>
              <motion.div
                animate={{ scale: isListeningMode && !isTalking ? [1, 2.4] : [1, 1.8], opacity: [0.35, 0] }}
                transition={{ repeat: Infinity, duration: isListeningMode && !isTalking ? 1.6 : 2.4, ease: "easeOut" }}
                className={cn("absolute inset-0 rounded-full blur-md", isListeningMode && !isTalking ? "bg-purple-500/15" : "bg-blue-500/15")}
              />
              <motion.div
                animate={{ scale: [1, 1.8], opacity: [0.4, 0] }}
                transition={{ repeat: Infinity, duration: 2, ease: "easeOut", delay: 0.5 }}
                className="absolute inset-0 bg-indigo-500/10 rounded-full blur-md"
              />
            </>
          )}

          {/* Core Orb Button */}
          <motion.button
            whileTap={{ scale: 0.95 }}
            className={cn(
              "w-48 h-48 rounded-full relative flex flex-col items-center justify-center transition-all duration-500 shadow-xl",
              status === 'IDLE' && "bg-white border text-gray-300 hover:border-purple-300 hover:shadow-2xl hover:scale-105",
              status === 'CONNECTING' && "bg-white border-2 border-purple-100 animate-pulse",
              status === 'LIVE' && (isListeningMode && !isTalking
                ? "bg-gradient-to-br from-white via-purple-50/50 to-purple-100/60 border-2 border-purple-200 shadow-[0_10px_45px_rgba(168,85,247,0.2)]"
                : "bg-gradient-to-br from-white via-blue-50/50 to-indigo-100/60 border-2 border-blue-200 shadow-[0_10px_45px_rgba(59,130,246,0.2)]")
            )}
          >
            {status === 'IDLE' && <Mic className="w-12 h-12 text-gray-300 group-hover:text-purple-600 transition-colors" />}
            {status === 'CONNECTING' && <Wifi className="w-12 h-12 text-purple-500 animate-bounce" />}

            {status === 'LIVE' && (
              <>
                <motion.div
                  animate={isTalking ? { height: [20, 42, 20] } : { height: 20 }}
                  transition={{ repeat: Infinity, duration: 0.5 }}
                  className="flex items-center gap-1.5"
                >
                  {[1, 2, 3, 4, 5].map(i => (
                    <motion.div
                      key={i}
                      animate={{ height: isTalking ? [16, 42, 16] : (isListeningMode ? [10, 24, 10] : [6, 12, 6]) }}
                      transition={{ repeat: Infinity, duration: isTalking ? 0.7 : 1.2, delay: i * 0.12 }}
                      className={cn(
                        "w-2 rounded-full",
                        isListeningMode && !isTalking
                          ? "bg-gradient-to-t from-purple-600 to-pink-500"
                          : "bg-gradient-to-t from-blue-600 to-indigo-500"
                      )}
                    />
                  ))}
                </motion.div>
                <span className="text-[10px] uppercase tracking-wider font-bold mt-3 text-gray-400 group-hover:text-purple-600 transition-colors">
                  {isListeningMode && !isTalking ? "Tap Orb to Reply" : (isTalking ? "Tap Orb to Interrupt" : "Tap Orb to Listen")}
                </span>
              </>
            )}
          </motion.button>
        </div>

        {/* Start / Pause Interactive Middle Controls */}
        <div className="mt-8 flex flex-col items-center gap-3 z-10 px-4">
          {status === 'IDLE' ? (
            <Button
              onClick={startCall}
              size="lg"
              className="bg-gradient-to-r from-purple-600 via-purple-700 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold px-8 py-6 rounded-full shadow-xl shadow-purple-500/25 hover:scale-105 active:scale-95 transition-all text-base gap-3"
            >
              <Mic className="w-5 h-5 animate-pulse" />
              Start Listening
            </Button>
          ) : status === 'CONNECTING' ? (
            <div className="flex items-center gap-2 px-6 py-3 bg-purple-50 text-purple-700 font-medium rounded-full border border-purple-200 shadow-sm animate-pulse">
              <Wifi className="w-4 h-4 animate-bounce" />
              Connecting to Voice Agent...
            </div>
          ) : (
            <div className="flex items-center gap-3 bg-white/95 backdrop-blur-md p-1.5 rounded-full border border-gray-200/80 shadow-lg">
              {/* Start Listening Button */}
              <button
                type="button"
                onClick={handleStartListening}
                className={cn(
                  "flex items-center gap-2 px-5 py-2.5 rounded-full text-xs sm:text-sm font-bold transition-all shadow-sm active:scale-95 cursor-pointer",
                  isListeningMode && !isTalking
                    ? "bg-purple-600 text-white shadow-purple-500/30 ring-2 ring-purple-300 scale-105"
                    : "bg-transparent text-gray-700 hover:bg-purple-50 hover:text-purple-700"
                )}
              >
                <Mic className="w-4 h-4" />
                Start Listening
              </button>

              {/* Pause to Reply Button */}
              <button
                type="button"
                onClick={handlePauseToReply}
                className={cn(
                  "flex items-center gap-2 px-5 py-2.5 rounded-full text-xs sm:text-sm font-bold transition-all shadow-sm active:scale-95 cursor-pointer",
                  !isListeningMode || isTalking
                    ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-blue-500/30 ring-2 ring-blue-300 scale-105"
                    : "bg-transparent text-gray-700 hover:bg-blue-50 hover:text-blue-700"
                )}
              >
                <Pause className="w-4 h-4" />
                Pause to Reply
              </button>
            </div>
          )}

          {/* Micro-helper text */}
          {status === 'LIVE' && (
            <p className="text-[11px] text-gray-400 font-medium text-center">
              {isTalking
                ? "🎙️ AI is speaking • Tap 'Start Listening' to speak or interrupt"
                : (isListeningMode
                  ? "👂 Listening to you • Tap 'Pause to Reply' when done speaking"
                  : "⚡ Generating immediate answer...")}
            </p>
          )}
        </div>

        {/* Status Text & Captions */}
        <div className="mt-4 px-8 text-center max-w-md min-h-[60px]">
          {status === 'IDLE' && (
            <p className="text-gray-400 text-sm font-medium animate-pulse">Tap Start Listening to begin</p>
          )}
          {status === 'CONNECTING' && (
            <p className="text-gray-500 text-sm font-medium">Connecting to secure agent...</p>
          )}
          {status === 'LIVE' && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-1.5"
            >
              <p className="text-gray-900 text-base font-semibold leading-relaxed">
                {isTalking
                  ? "Speaking..."
                  : (!isListeningMode
                    ? "Thinking..."
                    : (latestUserTranscript ? "Listening (typing...)" : "Listening..."))}
              </p>
              {latestCaption && (
                <motion.p
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-xs text-purple-700 font-medium px-2 line-clamp-2 italic bg-purple-50/70 py-1 rounded-md border border-purple-100"
                >
                  "{latestCaption}"
                </motion.p>
              )}
              <p className="text-[11px] text-gray-400 font-medium">Powered by Viralis AI</p>
            </motion.div>
          )}
        </div>

      </main>

      {/* Quick Action Chips & Text Input Bar */}
      {status === 'LIVE' && (
        <div className="w-full max-w-md mx-auto px-6 mb-1 flex flex-col gap-2 z-10">
          <div className="flex flex-wrap gap-1.5 justify-center">
            {[
              "What are your services?",
              "What are your opening hours?",
              "Where are you located?"
            ].map((chip) => (
              <button
                key={chip}
                type="button"
                onClick={() => sendQuestion(chip)}
                className="text-[11px] bg-white/90 hover:bg-purple-50 text-purple-700 border border-purple-200/80 hover:border-purple-300 rounded-full px-2.5 py-1 transition-all shadow-sm font-medium"
              >
                💬 {chip}
              </button>
            ))}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (textInput.trim()) {
                sendQuestion(textInput.trim());
                setTextInput('');
              }
            }}
            className="flex gap-1.5 items-center mt-0.5"
          >
            <Input
              placeholder="Or type a question for AI to speak..."
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              className="h-9 text-xs bg-white/90 border-gray-200 rounded-xl"
            />
            <Button
              type="submit"
              size="sm"
              className="h-9 px-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-semibold shrink-0"
            >
              <Send className="w-3.5 h-3.5" />
            </Button>
          </form>
        </div>
      )}

      {/* Footer Actions */}
      <footer className="p-6 pt-2 pb-8 flex flex-col gap-4 z-10 w-full max-w-md mx-auto">
        {status === 'LIVE' ? (
          <Button
            onClick={endCall}
            className="w-full bg-red-50 hover:bg-red-100 text-red-600 border border-red-100 py-6 text-lg rounded-2xl transition-all shadow-sm font-semibold"
          >
            <Phone className="w-5 h-5 mr-2 rotate-[135deg]" />
            End Conversation
          </Button>
        ) : (
          <Button
            variant="outline"
            onClick={() => setShowContact(true)}
            className="w-full border-gray-200 bg-white hover:bg-gray-50 text-gray-600 py-6 rounded-2xl shadow-sm transition-all font-semibold"
          >
            <User className="w-5 h-5 mr-2 text-gray-400" />
            Talk to Human
          </Button>
        )}
      </footer>

      {/* Lead Capture Form Dialog */}
      <Dialog open={showLeadForm && !leadSubmitted} onOpenChange={setShowLeadForm}>
        <DialogContent className="sm:max-w-md bg-white border-0 shadow-2xl rounded-3xl overflow-hidden">
          <div className="absolute inset-0 h-32 bg-gradient-to-br from-green-500/10 to-blue-500/10 z-0 pointer-events-none" />

          <DialogHeader className="relative z-10 pt-4 px-2">
            <DialogTitle className="text-2xl font-bold text-gray-900 text-center">Almost Done!</DialogTitle>
            <DialogDescription className="text-center text-gray-500">
              Thanks for connecting! Drop your details and we'll get back to you very soon.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleLeadSubmit} className="grid gap-4 py-4 relative z-10 px-2">
            <Input
              placeholder="Your Name"
              value={leadFormData.name}
              onChange={(e) => setLeadFormData({ ...leadFormData, name: e.target.value })}
              className="h-12 rounded-xl"
              required
            />
            <Input
              placeholder="Phone Number"
              type="tel"
              value={leadFormData.phone}
              onChange={(e) => setLeadFormData({ ...leadFormData, phone: e.target.value })}
              className="h-12 rounded-xl"
              required
            />
            <Input
              placeholder="Email (optional)"
              type="email"
              value={leadFormData.email}
              onChange={(e) => setLeadFormData({ ...leadFormData, email: e.target.value })}
              className="h-12 rounded-xl"
            />
            <Button type="submit" className="w-full bg-green-600 hover:bg-green-700 text-white py-6 rounded-xl font-semibold gap-2">
              <Send className="w-4 h-4" />
              Submit
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Success Dialog */}
      <Dialog open={leadSubmitted} onOpenChange={() => setLeadSubmitted(false)}>
        <DialogContent className="sm:max-w-sm bg-white border-0 shadow-2xl rounded-3xl text-center p-8">
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">Thank You!</h2>
            <p className="text-gray-500 text-sm">We've received your details. Our team will reach out soon.</p>
            <Button onClick={() => setLeadSubmitted(false)} className="mt-4 bg-gray-900 hover:bg-gray-800 text-white rounded-xl px-8">
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Contact Business Dialog (Original) */}
      <Dialog open={showContact} onOpenChange={setShowContact}>
        <DialogContent className="sm:max-w-md bg-white border-0 shadow-2xl rounded-3xl overflow-hidden">
          <div className="absolute inset-0 h-32 bg-gradient-to-br from-purple-500/10 to-blue-500/10 z-0 pointer-events-none" />

          <DialogHeader className="relative z-10 pt-4 px-2">
            <DialogTitle className="text-2xl font-bold text-gray-900 text-center">Contact {brand.name}</DialogTitle>
            <DialogDescription className="text-center text-gray-500">
              Prefer to speak with a real person? Details below.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-6 py-4 relative z-10 px-2">
            {/* Phone Card */}
            <div className="flex items-center gap-4 bg-green-50/50 p-4 rounded-2xl border border-green-100">
              <div className="w-12 h-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center shrink-0">
                <Phone className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-green-800">Direct Line</p>
                <a href={`tel:${brand.knowledgeBase?.contactPhone}`} className="text-lg font-bold text-gray-900 hover:underline">
                  {brand.knowledgeBase?.contactPhone || 'Not Available'}
                </a>
              </div>
            </div>

            {/* Address Card */}
            <div className="flex items-center gap-4 bg-gray-50 p-4 rounded-2xl border border-gray-100">
              <div className="w-12 h-12 bg-white text-gray-500 border border-gray-200 rounded-full flex items-center justify-center shrink-0">
                <MapPin className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Location</p>
                <p className="text-base font-semibold text-gray-900">
                  {brand.knowledgeBase?.address ||
                    [brand.location?.address, brand.location?.city, brand.location?.country].filter(Boolean).join(', ') ||
                    'Digital Only'}
                </p>
              </div>
            </div>

            {/* Hours Card */}
            <div className="flex items-center gap-4 bg-gray-50 p-4 rounded-2xl border border-gray-100">
              <div className="w-12 h-12 bg-white text-gray-500 border border-gray-200 rounded-full flex items-center justify-center shrink-0">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Business Hours</p>
                <p className="text-base font-semibold text-gray-900">
                  {brand.knowledgeBase?.businessHours || 'Open 24/7'}
                </p>
              </div>
            </div>
          </div>

          <div className="flex justify-center pb-2">
            <Button variant="ghost" onClick={() => setShowContact(false)} className="text-gray-400 hover:text-gray-600">
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
