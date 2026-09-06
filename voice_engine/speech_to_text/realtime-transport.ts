import type { VoiceBridge, VoiceEngineEvent } from "../types";

function id(prefix: string): string {
  const suffix = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}-${suffix}`;
}

export class RealtimeVoiceTransport {
  readonly sessionId = id("conversation");
  private unsubscribe: (() => void) | null = null;
  private listeners = new Set<(event: VoiceEngineEvent) => void>();
  private ready: Promise<void> | null = null;
  private resolveReady: (() => void) | null = null;
  private rejectReady: ((error: Error) => void) | null = null;
  private closed = false;

  constructor(private readonly bridge: VoiceBridge) {}

  onEvent(listener: (event: VoiceEngineEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(event: VoiceEngineEvent): void {
    for (const listener of this.listeners) listener(event);
  }

  async start(language: string, sampleRate: number): Promise<void> {
    if (this.closed) throw new Error("La session vocale est déjà fermée.");
    if (this.ready) return this.ready;
    this.ready = new Promise<void>((resolve, reject) => {
      this.resolveReady = resolve;
      this.rejectReady = reject;
    });
    this.unsubscribe = this.bridge.onEvent((raw) => {
      if (raw.sessionId !== this.sessionId) return;
      const event = raw as VoiceEngineEvent;
      if (event.type === "ready") this.resolveReady?.();
      if (event.type === "error" && this.rejectReady) {
        this.rejectReady(new Error(typeof event.message === "string" ? event.message : "Le moteur vocal ne répond pas."));
      }
      this.emit(event);
    });
    await this.bridge.sessionStart({ sessionId: this.sessionId, language, sampleRate });
    const timeout = window.setTimeout(() => this.rejectReady?.(new Error("Le moteur vocal local met trop de temps à répondre.")), 8_000);
    try {
      await this.ready;
      this.resolveReady = null;
      this.rejectReady = null;
    } finally {
      window.clearTimeout(timeout);
    }
  }

  pushAudio(bytes: Uint8Array): void {
    if (this.closed || !bytes.byteLength) return;
    void this.bridge.sessionAudio(this.sessionId, bytes).catch(() => false);
  }

  setAssistantSpeaking(speaking: boolean): void {
    if (this.closed) return;
    void this.bridge.sessionAssistantState(this.sessionId, speaking).catch(() => false);
  }

  async synthesize(input: {
    requestId: string;
    text: string;
    language: string;
    voiceId: string;
    speed: number;
    expressiveness: number;
    natural: boolean;
    context?: string;
  }): Promise<void> {
    if (this.closed) throw new Error("La session vocale est fermée.");
    await this.bridge.sessionSynthesize(this.sessionId, input);
  }

  async cancelOutput(requestId?: string): Promise<void> {
    if (this.closed) return;
    await this.bridge.sessionCancelOutput(this.sessionId, requestId).catch(() => false);
  }

  resetInput(): void {
    if (this.closed) return;
    void this.bridge.sessionResetInput(this.sessionId).catch(() => false);
  }

  async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.listeners.clear();
    await this.bridge.sessionStop(this.sessionId).catch(() => false);
  }
}
