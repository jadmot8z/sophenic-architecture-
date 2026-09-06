"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { AudioLines, LockKeyhole, Mic, MicOff, Radio, X } from "lucide-react";

import { FullDuplexAudioCapture } from "../audio_stream/full-duplex-audio";
import { normalizeEmotion, emotionGlow, type VoiceEmotion } from "../emotion_engine/context-emotion";
import { BargeInCoordinator } from "../interruption_handler/barge-in";
import { NaturalSilenceDetector, type SilencePrompt } from "../silence_detector/natural-silence";
import { RealtimeVoiceTransport } from "../speech_to_text/realtime-transport";
import { StreamingPcmPlayer } from "../text_to_speech/streaming-player";
import type { VoiceBridge, VoiceEngineEvent, VoicePhase, VoiceSettings, VoiceTranscript } from "../types";

export type VoiceModeHandle = {
  queueSpeech: (text: string, context?: string) => void;
  finishResponse: () => void;
  notifyError: (message: string) => void;
  stopSpeaking: () => Promise<void>;
};

type VoiceModeProps = {
  bridge: VoiceBridge;
  settings: VoiceSettings;
  onTranscript: (transcript: VoiceTranscript) => void | Promise<void>;
  onInterrupt: () => void | Promise<void>;
  onClose: () => void;
};

const phaseCopy: Record<VoicePhase, { eyebrow: string; label: string; hint: string }> = {
  connecting: { eyebrow: "INITIALISATION LOCALE", label: "Connexion…", hint: "Chargement du moteur vocal natif" },
  listening: { eyebrow: "MICRO ACTIF", label: "Je t’écoute", hint: "Parle naturellement, sans appuyer à nouveau" },
  "user-speaking": { eyebrow: "TU PARLES", label: "Je t’écoute…", hint: "Prends ton temps, je ne te couperai pas" },
  thinking: { eyebrow: "SOPHENIC RÉFLÉCHIT", label: "Un instant…", hint: "Le contexte de la conversation est conservé" },
  speaking: { eyebrow: "SOPHENIC PARLE", label: "En conversation", hint: "Tu peux m’interrompre à tout moment" },
  muted: { eyebrow: "MICRO EN PAUSE", label: "Micro coupé", hint: "Réactive le micro pour continuer" },
  error: { eyebrow: "MOTEUR VOCAL", label: "Connexion interrompue", hint: "Ferme puis relance le mode vocal" },
};

function requestId(): string {
  return `speech-${typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`}`;
}

export const VoiceMode = forwardRef<VoiceModeHandle, VoiceModeProps>(function VoiceMode(
  { bridge, settings, onTranscript, onInterrupt, onClose },
  ref,
) {
  const [phase, setPhaseState] = useState<VoicePhase>("connecting");
  const [level, setLevel] = useState(0);
  const [partial, setPartial] = useState("");
  const [lastUserText, setLastUserText] = useState("");
  const [emotion, setEmotion] = useState<VoiceEmotion>("calm");
  const [errorDetail, setErrorDetail] = useState("");
  const [muted, setMuted] = useState(false);
  const [connected, setConnected] = useState(false);

  const mounted = useRef(true);
  const phaseRef = useRef<VoicePhase>("connecting");
  const transport = useRef<RealtimeVoiceTransport | null>(null);
  const capture = useRef<FullDuplexAudioCapture | null>(null);
  const player = useRef<StreamingPcmPlayer | null>(null);
  const silence = useRef<NaturalSilenceDetector | null>(null);
  const bargeIn = useRef(new BargeInCoordinator());
  const activeOutput = useRef("");
  const outputResolvers = useRef(new Map<string, () => void>());
  const speechChain = useRef<Promise<void>>(Promise.resolve());
  const speechGeneration = useRef(0);
  const turnSerial = useRef(0);
  const lastContext = useRef("");
  const detectedLanguage = useRef(settings.language === "auto" ? "en" : settings.language);
  const callbacks = useRef({ onTranscript, onInterrupt });
  callbacks.current = { onTranscript, onInterrupt };

  const setPhase = useCallback((value: VoicePhase) => {
    phaseRef.current = value;
    if (mounted.current) setPhaseState(value);
  }, []);

  const settleOutput = useCallback((id: string) => {
    const resolve = outputResolvers.current.get(id);
    outputResolvers.current.delete(id);
    if (activeOutput.current === id) activeOutput.current = "";
    resolve?.();
  }, []);

  const interruptOutput = useCallback(async () => {
    await bargeIn.current.interrupt(async () => {
      speechGeneration.current += 1;
      speechChain.current = Promise.resolve();
      const current = activeOutput.current;
      activeOutput.current = "";
      player.current?.stop(28);
      capture.current?.setAssistantSpeaking(false);
      transport.current?.setAssistantSpeaking(false);
      for (const resolve of outputResolvers.current.values()) resolve();
      outputResolvers.current.clear();
      await transport.current?.cancelOutput(current || undefined);
      await callbacks.current.onInterrupt();
    });
  }, []);

  const handleSpeechStart = useCallback(() => {
    if (!mounted.current || muted) return;
    silence.current?.activity();
    silence.current?.setSuspended(true);
    const previous = phaseRef.current;
    if (previous === "speaking" || previous === "thinking") turnSerial.current += 1;
    setPhase("user-speaking");
    if (previous === "speaking" || previous === "thinking") void interruptOutput();
  }, [interruptOutput, muted, setPhase]);

  const handleTranscript = useCallback(async (event: VoiceEngineEvent) => {
    const text = typeof event.text === "string" ? event.text.trim() : "";
    if (!text) return;
    const serial = ++turnSerial.current;
    setPartial("");
    setLastUserText(text);
    lastContext.current = text;
    if (typeof event.language === "string" && event.language && event.language !== "auto") detectedLanguage.current = event.language;
    setPhase("thinking");
    silence.current?.setSuspended(true);
    await callbacks.current.onTranscript({
      text,
      language: typeof event.language === "string" ? event.language : settings.language,
      languageProbability: typeof event.language_probability === "number" ? event.language_probability : undefined,
      utteranceId: typeof event.utterance_id === "number" ? event.utterance_id : undefined,
    });
    // Tool/permission routes can complete without a spoken answer. Do not leave
    // the full-screen UI stuck in “thinking”, but never override a newer turn.
    window.setTimeout(() => {
      if (mounted.current && serial === turnSerial.current && phaseRef.current === "thinking") {
        setPhase("listening");
        silence.current?.setSuspended(false);
        silence.current?.activity();
      }
    }, 350);
  }, [setPhase, settings.language]);

  const onEngineEvent = useCallback((event: VoiceEngineEvent) => {
    if (event.type === "transcript_partial" && typeof event.text === "string") {
      setPartial(event.text);
      return;
    }
    if (event.type === "transcript_final") {
      void handleTranscript(event);
      return;
    }
    if (event.type === "speech_started") {
      // Local VAD normally reacts first. This event is a server-side safety net.
      if (phaseRef.current === "speaking" || phaseRef.current === "thinking") handleSpeechStart();
      return;
    }
    if (event.type === "output_started") {
      setEmotion(normalizeEmotion(event.emotion));
      setPhase("speaking");
      capture.current?.setAssistantSpeaking(true);
      transport.current?.setAssistantSpeaking(true);
      return;
    }
    if (event.type === "output_audio" && typeof event.data === "string") {
      const sampleRate = typeof event.sample_rate === "number" ? event.sample_rate : 48_000;
      void player.current?.enqueueBase64Pcm(event.data, sampleRate);
      return;
    }
    if (event.type === "output_done") {
      const id = typeof event.requestId === "string" ? event.requestId : "";
      void player.current?.whenIdle().then(() => settleOutput(id));
      return;
    }
    if (event.type === "output_cancelled") {
      settleOutput(typeof event.requestId === "string" ? event.requestId : "");
      return;
    }
    if (event.type === "error") {
      if (typeof event.requestId === "string") settleOutput(event.requestId);
      const message = typeof event.message === "string" ? event.message : "Le moteur vocal local a rencontré une erreur.";
      setErrorDetail(message);
      if (event.scope !== "output") setPhase("error");
    }
  }, [handleSpeechStart, handleTranscript, setPhase, settleOutput]);

  const speakOne = useCallback(async (text: string, language: string, context: string, generation: number) => {
    const value = text.replace(/\s+/g, " ").trim();
    if (!value || generation !== speechGeneration.current || !transport.current) return;
    const id = requestId();
    activeOutput.current = id;
    setPhase("speaking");
    silence.current?.setSuspended(true);
    const complete = new Promise<void>((resolve) => outputResolvers.current.set(id, resolve));
    try {
      await transport.current.synthesize({
        requestId: id,
        text: value,
        language,
        voiceId: settings.voiceId,
        speed: settings.speed,
        expressiveness: settings.expressiveness,
        natural: settings.naturalConversation,
        context,
      });
      await complete;
    } catch (cause) {
      settleOutput(id);
      if (mounted.current) {
        setErrorDetail(cause instanceof Error ? cause.message : String(cause));
        setPhase("error");
      }
    }
  }, [setPhase, settings.expressiveness, settings.naturalConversation, settings.speed, settings.voiceId, settleOutput]);

  const queueSpeech = useCallback((text: string, context = lastContext.current, language = settings.language) => {
    if (!text.trim() || phaseRef.current === "error") return;
    const generation = speechGeneration.current;
    const spokenLanguage = language === "auto" ? detectedLanguage.current : language;
    speechChain.current = speechChain.current
      .then(() => speakOne(text, spokenLanguage, context, generation))
      .catch(() => undefined);
  }, [settings.language, speakOne]);

  const finishResponse = useCallback(() => {
    const generation = speechGeneration.current;
    const chain = speechChain.current;
    void chain.then(() => {
      if (!mounted.current || generation !== speechGeneration.current || phaseRef.current === "user-speaking") return;
      capture.current?.setAssistantSpeaking(false);
      transport.current?.setAssistantSpeaking(false);
      setPhase(muted ? "muted" : "listening");
      silence.current?.setSuspended(muted);
      if (!muted) silence.current?.activity();
    });
  }, [muted, setPhase]);

  const speakSilencePrompt = useCallback(async (prompt: SilencePrompt) => {
    if (phaseRef.current !== "listening" || muted) return;
    queueSpeech(prompt.text, "", prompt.language);
    finishResponse();
  }, [finishResponse, muted, queueSpeech]);

  useImperativeHandle(ref, () => ({
    queueSpeech: (text, context) => queueSpeech(text, context),
    finishResponse,
    notifyError: (message) => {
      setErrorDetail(message);
      setPhase("error");
    },
    stopSpeaking: interruptOutput,
  }), [finishResponse, interruptOutput, queueSpeech, setPhase]);

  useEffect(() => {
    mounted.current = true;
    let disposed = false;
    const realtime = new RealtimeVoiceTransport(bridge);
    transport.current = realtime;
    const audioPlayer = new StreamingPcmPlayer(settings.volume, (outputLevel) => {
      if (phaseRef.current === "speaking" && mounted.current) setLevel(outputLevel);
    });
    player.current = audioPlayer;
    const unsubscribe = realtime.onEvent(onEngineEvent);
    const resolvers = outputResolvers.current;

    const start = async () => {
      try {
        const health = await bridge.health();
        if (!health.ready || !health.local || !health.realtime) {
          throw new Error("Le moteur vocal local n’est pas prêt. Lance START-SOPHENIC-VOICE.ps1 puis réessaie.");
        }
        const audioCapture = new FullDuplexAudioCapture({
          onAudio: (bytes) => realtime.pushAudio(bytes),
          onLevel: (inputLevel) => {
            if (phaseRef.current !== "speaking" && mounted.current) setLevel(inputLevel);
          },
          onSpeechStart: handleSpeechStart,
          onSpeechEnd: () => {
            if (phaseRef.current === "user-speaking") {
              setPhase("listening");
              silence.current?.setSuspended(false);
              silence.current?.activity();
            }
          },
        }, settings.inputSensitivity);
        capture.current = audioCapture;
        const sampleRate = await audioCapture.start();
        if (disposed) return;
        await realtime.start(settings.language, sampleRate);
        if (disposed) return;
        setConnected(true);
        setPhase("listening");
        const idleDetector = new NaturalSilenceDetector(settings.language, speakSilencePrompt);
        silence.current = idleDetector;
        if (settings.silencePrompts) idleDetector.start();
      } catch (cause) {
        if (disposed) return;
        setErrorDetail(cause instanceof Error ? cause.message : String(cause));
        setPhase("error");
      }
    };
    void start();

    return () => {
      disposed = true;
      mounted.current = false;
      speechGeneration.current += 1;
      silence.current?.stop();
      silence.current = null;
      unsubscribe();
      player.current?.stop(0);
      for (const resolve of resolvers.values()) resolve();
      resolvers.clear();
      void Promise.all([audioCaptureStop(capture.current), audioPlayer.dispose(), realtime.close()]);
      capture.current = null;
      player.current = null;
      transport.current = null;
    };
  // The session is intentionally stable for the lifetime of the full-screen mode.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  useEffect(() => { player.current?.setVolume(settings.volume); }, [settings.volume]);

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    capture.current?.setMuted(next);
    if (next) {
      silence.current?.setSuspended(true);
      setPhase("muted");
    } else {
      setPhase("listening");
      silence.current?.setSuspended(false);
      silence.current?.activity();
    }
  };

  const copy = phaseCopy[phase];
  const bars = useMemo(() => Array.from({ length: 44 }, (_, index) => {
    const center = 1 - Math.abs(index - 21.5) / 21.5;
    return { index, center: 0.3 + center * 0.7 };
  }), []);
  const glow = emotionGlow[emotion];

  return <motion.section
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    className="fixed inset-0 z-[220] overflow-hidden bg-[#07100e] text-white"
    role="dialog"
    aria-modal="true"
    aria-label="Conversation vocale SOPHENIC"
  >
    <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_42%,rgba(16,185,129,.17),transparent_36%),radial-gradient(circle_at_12%_10%,rgba(217,171,94,.10),transparent_30%),linear-gradient(145deg,#08120f_0%,#06100e_52%,#030908_100%)]" />
    <motion.div className="absolute left-1/2 top-[43%] h-[520px] w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-[90px]" animate={{ backgroundColor: glow, scale: phase === "speaking" || phase === "user-speaking" ? [0.85, 1.08, 0.9] : [0.8, 0.94, 0.8], opacity: [0.18, 0.38, 0.18] }} transition={{ duration: phase === "speaking" ? 2.1 : 4.5, repeat: Infinity, ease: "easeInOut" }} />
    <div className="absolute inset-0 opacity-[.045]" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,.8) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.8) 1px, transparent 1px)", backgroundSize: "54px 54px", maskImage: "linear-gradient(to bottom, black, transparent 80%)" }} />

    <header className="relative z-10 flex items-center justify-between px-5 py-5 sm:px-8 sm:py-7">
      <div className="flex items-center gap-3">
        <div className="grid size-9 place-items-center rounded-full border border-emerald-300/20 bg-emerald-300/10"><AudioLines className="size-4 text-emerald-200" /></div>
        <div><div className="text-[11px] font-semibold tracking-[.24em] text-white/85">SOPHENIC VOICE</div><div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-emerald-100/45"><LockKeyhole className="size-3" />Local · privé · temps réel</div></div>
      </div>
      <button type="button" onClick={onClose} className="grid size-11 place-items-center rounded-full border border-white/10 bg-white/[.06] text-white/70 transition hover:scale-105 hover:bg-white/[.11] hover:text-white" title="Fermer le mode vocal" aria-label="Fermer le mode vocal"><X className="size-5" /></button>
    </header>

    <div className="relative z-10 mx-auto flex h-[calc(100%-180px)] max-w-5xl flex-col items-center justify-center px-6 pb-16 text-center">
      <motion.div key={copy.eyebrow} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} className="mb-8 flex items-center gap-2 text-[10px] font-semibold tracking-[.28em] text-emerald-200/55"><span className={`size-1.5 rounded-full ${connected ? "bg-emerald-300" : "bg-amber-300"} shadow-[0_0_14px_currentColor]`} />{copy.eyebrow}</motion.div>

      <div className="relative grid size-[238px] place-items-center sm:size-[286px]">
        {[1, 2, 3].map((ring) => <motion.div key={ring} className="absolute rounded-full border border-emerald-200/10" style={{ inset: ring * 17 }} animate={{ scale: phase === "user-speaking" || phase === "speaking" ? [1, 1.06 + ring * .018, 1] : [1, 1.018, 1], opacity: [0.2, 0.56 / ring, 0.2] }} transition={{ duration: 1.35 + ring * .45, repeat: Infinity, ease: "easeInOut", delay: ring * .12 }} />)}
        <motion.div className="absolute inset-[52px] rounded-full bg-gradient-to-br from-emerald-300/28 via-emerald-600/15 to-amber-200/10 shadow-[inset_0_1px_1px_rgba(255,255,255,.18),0_0_80px_rgba(16,185,129,.24)] backdrop-blur-xl" animate={{ scale: 1 + Math.min(.11, level * .16), boxShadow: `inset 0 1px 1px rgba(255,255,255,.18), 0 0 ${55 + level * 90}px ${glow}` }} transition={{ type: "spring", stiffness: 180, damping: 18 }} />
        <motion.div animate={{ scale: phase === "thinking" ? [1, .9, 1] : 1, rotate: phase === "thinking" ? [0, 4, -4, 0] : 0 }} transition={{ duration: 2.2, repeat: phase === "thinking" ? Infinity : 0 }} className="relative grid size-[94px] place-items-center rounded-full border border-white/15 bg-white/[.07] shadow-xl">{phase === "muted" ? <MicOff className="size-9 text-white/70" /> : <Mic className="size-9 text-emerald-50" />}</motion.div>
      </div>

      <motion.h1 key={copy.label} initial={{ opacity: 0, y: 7 }} animate={{ opacity: 1, y: 0 }} className="mt-8 text-2xl font-medium tracking-[-.02em] text-white/95 sm:text-3xl">{copy.label}</motion.h1>
      <p className="mt-2 text-sm text-white/42">{phase === "error" && errorDetail ? errorDetail : copy.hint}</p>

      <div className="mt-9 flex h-16 items-center justify-center gap-[3px]" aria-label="Visualisation de l’onde audio">
        {bars.map(({ index, center }) => {
          const activity = phase === "thinking" ? .18 : Math.max(.08, level);
          const varied = .34 + ((index * 17) % 11) / 15;
          const height = 5 + activity * 54 * center * varied;
          return <motion.span key={index} className="block w-[3px] rounded-full bg-gradient-to-t from-emerald-500/35 to-emerald-100/90" animate={{ height, opacity: .26 + activity * .72 }} transition={{ type: "spring", stiffness: 240, damping: 20, delay: (index % 5) * .008 }} />;
        })}
      </div>

      <div className="mt-5 min-h-[70px] w-full max-w-2xl">
        {partial ? <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="line-clamp-2 text-base leading-7 text-white/72">“{partial}”</motion.p> : lastUserText ? <p className="line-clamp-2 text-sm leading-6 text-white/32">“{lastUserText}”</p> : <p className="text-xs text-white/25">La transcription apparaît ici pendant que tu parles.</p>}
      </div>
    </div>

    <footer className="absolute inset-x-0 bottom-0 z-20 flex items-end justify-between px-5 pb-6 sm:px-8 sm:pb-8">
      <div className="hidden items-center gap-2 text-[10px] text-white/28 sm:flex"><Radio className="size-3.5 text-emerald-300/50" />{connected ? "Moteurs STT + TTS prêts" : "Connexion au moteur local"}</div>
      <button type="button" onClick={toggleMute} className={`mx-auto grid size-12 place-items-center rounded-full border transition sm:mx-0 ${muted ? "border-red-300/25 bg-red-400/15 text-red-100" : "border-white/10 bg-white/[.06] text-white/70 hover:bg-white/[.11]"}`} title={muted ? "Réactiver le microphone" : "Couper le microphone"} aria-label={muted ? "Réactiver le microphone" : "Couper le microphone"}>{muted ? <MicOff className="size-5" /> : <Mic className="size-5" />}</button>
    </footer>
  </motion.section>;
});

async function audioCaptureStop(value: FullDuplexAudioCapture | null): Promise<void> {
  await value?.stop().catch(() => undefined);
}
