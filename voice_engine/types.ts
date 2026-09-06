export type VoicePhase = "connecting" | "listening" | "user-speaking" | "thinking" | "speaking" | "muted" | "error";

export type VoiceSettings = {
  enabled: boolean;
  language: string;
  voiceId: string;
  speed: number;
  expressiveness: number;
  volume: number;
  naturalConversation: boolean;
  silencePrompts: boolean;
  inputSensitivity: number;
  serviceUrl: string;
};

export type VoiceTranscript = {
  text: string;
  language: string;
  languageProbability?: number;
  utteranceId?: number;
};

export type VoiceEngineEvent = Record<string, unknown> & {
  sessionId: string;
  type: string;
  requestId?: string;
};

export type VoiceBridge = NonNullable<NonNullable<Window["sophenicDesktop"]>["voice"]>;
