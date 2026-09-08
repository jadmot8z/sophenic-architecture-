type CaptureCallbacks = {
  onAudio: (pcm: Uint8Array) => void;
  onLevel: (level: number) => void;
  onSpeechStart: () => void;
  onSpeechEnd: () => void;
};

const workletSource = `
class SophenicPcmProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.parts = [];
    this.length = 0;
    this.target = 1024;
  }
  process(inputs) {
    const input = inputs[0] && inputs[0][0];
    if (!input) return true;
    this.parts.push(new Float32Array(input));
    this.length += input.length;
    if (this.length >= this.target) {
      const merged = new Float32Array(this.length);
      let offset = 0;
      for (const part of this.parts) { merged.set(part, offset); offset += part.length; }
      this.parts = [];
      this.length = 0;
      this.port.postMessage(merged, [merged.buffer]);
    }
    return true;
  }
}
registerProcessor('sophenic-pcm-processor', SophenicPcmProcessor);
`;

function toPcm16(input: Float32Array): Uint8Array {
  const output = new Uint8Array(input.length * 2);
  const view = new DataView(output.buffer);
  for (let index = 0; index < input.length; index += 1) {
    const sample = Math.max(-1, Math.min(1, input[index]));
    view.setInt16(index * 2, sample < 0 ? sample * 32768 : sample * 32767, true);
  }
  return output;
}

function rms(input: Float32Array): number {
  let sum = 0;
  for (let index = 0; index < input.length; index += 1) sum += input[index] * input[index];
  return Math.sqrt(sum / Math.max(1, input.length));
}

export class FullDuplexAudioCapture {
  private stream: MediaStream | null = null;
  private context: AudioContext | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private processor: AudioWorkletNode | ScriptProcessorNode | null = null;
  private sink: GainNode | null = null;
  private workletUrl = "";
  private stopped = false;
  private muted = false;
  private assistantSpeaking = false;
  private speechActive = false;
  private candidateMs = 0;
  private releaseMs = 0;
  private noiseFloor = 0.0035;
  private lastPacketAt = 0;

  constructor(
    private readonly callbacks: CaptureCallbacks,
    private readonly sensitivity = 0.55,
  ) {}

  get sampleRate(): number {
    return this.context?.sampleRate || 48_000;
  }

  get isMuted(): boolean {
    return this.muted;
  }

  setMuted(value: boolean): void {
    this.muted = value;
    if (value && this.speechActive) {
      this.speechActive = false;
      this.callbacks.onSpeechEnd();
    }
  }

  setAssistantSpeaking(value: boolean): void {
    this.assistantSpeaking = value;
  }

  async start(): Promise<number> {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("Aucun microphone compatible n’est disponible.");
    }
    this.stopped = false;
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: { ideal: true },
        noiseSuppression: { ideal: true },
        autoGainControl: { ideal: true },
        channelCount: { ideal: 1 },
        sampleRate: { ideal: 48_000 },
      },
      video: false,
    });
    this.context = new AudioContext({ latencyHint: "interactive", sampleRate: 48_000 });
    if (this.context.state === "suspended") await this.context.resume();
    this.source = this.context.createMediaStreamSource(this.stream);
    this.sink = this.context.createGain();
    this.sink.gain.value = 0;
    this.sink.connect(this.context.destination);

    if (this.context.audioWorklet && typeof AudioWorkletNode !== "undefined") {
      const blob = new Blob([workletSource], { type: "text/javascript" });
      this.workletUrl = URL.createObjectURL(blob);
      await this.context.audioWorklet.addModule(this.workletUrl);
      const node = new AudioWorkletNode(this.context, "sophenic-pcm-processor", {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        outputChannelCount: [1],
      });
      node.port.onmessage = (event: MessageEvent<Float32Array>) => this.process(event.data);
      this.processor = node;
    } else {
      // Electron versions without AudioWorklet still keep a low-latency local
      // path. This is a compatibility path, not a browser speech API fallback.
      const node = this.context.createScriptProcessor(1024, 1, 1);
      node.onaudioprocess = (event) => this.process(new Float32Array(event.inputBuffer.getChannelData(0)));
      this.processor = node;
    }
    this.source.connect(this.processor);
    this.processor.connect(this.sink);
    return this.context.sampleRate;
  }

  private process(samples: Float32Array): void {
    if (this.stopped || !samples.length) return;
    const level = rms(samples);
    this.callbacks.onLevel(Math.min(1, level * 12));
    const now = performance.now();
    const durationMs = this.lastPacketAt ? Math.min(80, now - this.lastPacketAt) : samples.length / this.sampleRate * 1000;
    this.lastPacketAt = now;

    if (!this.speechActive && level < 0.025) {
      const rate = level > this.noiseFloor ? 0.012 : 0.045;
      this.noiseFloor = this.noiseFloor * (1 - rate) + level * rate;
    }
    const clampedSensitivity = Math.max(0, Math.min(1, this.sensitivity));
    const base = 0.016 - clampedSensitivity * 0.008;
    const echoMultiplier = this.assistantSpeaking ? 4.3 : 2.8;
    const threshold = Math.max(base * (this.assistantSpeaking ? 1.55 : 1), this.noiseFloor * echoMultiplier);
    const voiced = !this.muted && level >= threshold;

    if (!this.speechActive) {
      this.candidateMs = voiced ? this.candidateMs + durationMs : Math.max(0, this.candidateMs - durationMs * 1.7);
      if (this.candidateMs >= (this.assistantSpeaking ? 170 : 105)) {
        this.speechActive = true;
        this.releaseMs = 0;
        this.callbacks.onSpeechStart();
      }
    } else {
      this.releaseMs = voiced ? 0 : this.releaseMs + durationMs;
      if (this.releaseMs >= 560) {
        this.speechActive = false;
        this.candidateMs = 0;
        this.releaseMs = 0;
        this.callbacks.onSpeechEnd();
      }
    }

    if (!this.muted) this.callbacks.onAudio(toPcm16(samples));
  }

  async stop(): Promise<void> {
    if (this.stopped) return;
    this.stopped = true;
    if (typeof AudioWorkletNode !== "undefined" && this.processor instanceof AudioWorkletNode) this.processor.port.onmessage = null;
    if (this.processor && "onaudioprocess" in this.processor) (this.processor as ScriptProcessorNode).onaudioprocess = null;
    try { this.source?.disconnect(); this.processor?.disconnect(); this.sink?.disconnect(); } catch {}
    this.stream?.getTracks().forEach((track) => track.stop());
    if (this.context && this.context.state !== "closed") await this.context.close().catch(() => undefined);
    if (this.workletUrl) URL.revokeObjectURL(this.workletUrl);
    this.stream = null;
    this.context = null;
    this.source = null;
    this.processor = null;
    this.sink = null;
  }
}
