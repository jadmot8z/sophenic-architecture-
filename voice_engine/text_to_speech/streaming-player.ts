function decodePcm16(value: string): Int16Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return new Int16Array(bytes.buffer);
}

export class StreamingPcmPlayer {
  private context: AudioContext | null = null;
  private gain: GainNode | null = null;
  private nextStartAt = 0;
  private sources = new Set<AudioBufferSourceNode>();
  private idleResolvers = new Set<() => void>();
  private pendingEnqueues = 0;
  private generation = 0;
  private disposed = false;

  constructor(
    private volume = 1,
    private readonly onLevel?: (value: number) => void,
  ) {}

  private ensureContext(): AudioContext {
    if (this.disposed) throw new Error("Le lecteur vocal est fermé.");
    if (!this.context || this.context.state === "closed") {
      this.context = new AudioContext({ latencyHint: "interactive" });
      this.gain = this.context.createGain();
      this.gain.gain.value = Math.max(0, Math.min(1, this.volume));
      this.gain.connect(this.context.destination);
      this.nextStartAt = this.context.currentTime;
    }
    if (this.context.state === "suspended") void this.context.resume();
    return this.context;
  }

  setVolume(value: number): void {
    this.volume = Math.max(0, Math.min(1, value));
    if (this.gain && this.context) this.gain.gain.setTargetAtTime(this.volume, this.context.currentTime, 0.015);
  }

  async enqueueBase64Pcm(value: string, sampleRate: number): Promise<void> {
    if (!value) return;
    const samples = decodePcm16(value);
    if (!samples.length) return;
    const generation = this.generation;
    this.pendingEnqueues += 1;
    try {
      const context = this.ensureContext();
      if (generation !== this.generation) return;
      const buffer = context.createBuffer(1, samples.length, Math.max(8_000, Math.min(96_000, sampleRate)));
      const channel = buffer.getChannelData(0);
      let sum = 0;
      for (let index = 0; index < samples.length; index += 1) {
        const sample = samples[index] / 32768;
        channel[index] = sample;
        sum += sample * sample;
      }
      this.onLevel?.(Math.min(1, Math.sqrt(sum / samples.length) * 6));

      const source = context.createBufferSource();
      source.buffer = buffer;
      source.connect(this.gain || context.destination);
      const startsAt = Math.max(this.nextStartAt, context.currentTime + 0.018);
      this.nextStartAt = startsAt + buffer.duration;
      this.sources.add(source);
      source.onended = () => {
        this.sources.delete(source);
        if (!this.sources.size && !this.pendingEnqueues && context.currentTime >= this.nextStartAt - 0.03) this.resolveIdle();
      };
      source.start(startsAt);
    } finally {
      this.pendingEnqueues -= 1;
      if (!this.pendingEnqueues && !this.sources.size) this.resolveIdle();
    }
  }

  private resolveIdle(): void {
    this.onLevel?.(0);
    for (const resolve of this.idleResolvers) resolve();
    this.idleResolvers.clear();
  }

  async whenIdle(): Promise<void> {
    const context = this.context;
    if (!this.pendingEnqueues && (!context || (!this.sources.size && context.currentTime >= this.nextStartAt - 0.03))) return;
    await new Promise<void>((resolve) => this.idleResolvers.add(resolve));
  }

  stop(fadeMs = 35): void {
    this.generation += 1;
    const context = this.context;
    if (context && this.gain) {
      const now = context.currentTime;
      this.gain.gain.cancelScheduledValues(now);
      this.gain.gain.setValueAtTime(this.gain.gain.value, now);
      this.gain.gain.linearRampToValueAtTime(0, now + fadeMs / 1000);
    }
    const stopAt = context ? context.currentTime + fadeMs / 1000 : 0;
    for (const source of this.sources) {
      try { source.stop(stopAt); } catch {}
    }
    this.sources.clear();
    this.nextStartAt = context?.currentTime || 0;
    if (context && this.gain) {
      this.gain.gain.setValueAtTime(0, stopAt);
      this.gain.gain.linearRampToValueAtTime(this.volume, stopAt + 0.02);
    }
    this.resolveIdle();
  }

  async dispose(): Promise<void> {
    if (this.disposed) return;
    this.stop(0);
    this.disposed = true;
    if (this.context && this.context.state !== "closed") await this.context.close().catch(() => undefined);
    this.context = null;
    this.gain = null;
  }
}
