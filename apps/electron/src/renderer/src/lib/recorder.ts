const TARGET_RATE = 16000;

export class Recorder {
  private stream: MediaStream | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private mimeType = "";

  /**
   * Acquire the microphone stream without starting a MediaRecorder.
   * Use this when the Streamer handles audio capture and you only
   * need the stream for visualization.
   */
  async acquireStream(deviceId?: string | null): Promise<MediaStream> {
    const processing = {
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
    };
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: deviceId
          ? { deviceId: { exact: deviceId }, ...processing }
          : processing,
      });
    } catch (e) {
      const name = e instanceof Error ? e.name : "";
      if (
        deviceId &&
        (name === "OverconstrainedError" || name === "NotFoundError")
      ) {
        this.stream = await navigator.mediaDevices.getUserMedia({
          audio: processing,
        });
      } else {
        throw e;
      }
    }
    return this.stream;
  }

  /**
   * Acquire the mic AND start a MediaRecorder for the REST fallback
   * path (when streaming is unavailable).
   */
  async start(deviceId?: string | null): Promise<MediaStream> {
    this.chunks = [];
    const stream = await this.acquireStream(deviceId);
    this.mimeType = pickSupportedMime();
    this.mediaRecorder = new MediaRecorder(
      stream,
      this.mimeType ? { mimeType: this.mimeType } : undefined,
    );
    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.chunks.push(e.data);
    };
    this.mediaRecorder.start();
    return stream;
  }

  getStream(): MediaStream | null {
    return this.stream;
  }

  isRecording(): boolean {
    return this.mediaRecorder?.state === "recording";
  }

  async stop(): Promise<Blob> {
    const mr = this.mediaRecorder;
    if (!mr) throw new Error("Recorder not started");

    const done = new Promise<void>((resolve) => {
      mr.onstop = (): void => resolve();
    });
    mr.stop();
    await done;

    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.mediaRecorder = null;

    const blob = new Blob(this.chunks, {
      type: this.mimeType || "audio/webm",
    });
    const wav = await blobToWav16k(blob);
    return wav;
  }

  cancel(): void {
    if (this.mediaRecorder?.state === "recording") {
      this.mediaRecorder.stop();
    }
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.mediaRecorder = null;
    this.chunks = [];
  }
}

function pickSupportedMime(): string {
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg;codecs=opus",
  ];
  for (const c of candidates) {
    if (
      typeof MediaRecorder !== "undefined" &&
      MediaRecorder.isTypeSupported(c)
    ) {
      return c;
    }
  }
  return "";
}

async function blobToWav16k(blob: Blob): Promise<Blob> {
  const arrayBuf = await blob.arrayBuffer();
  const audioCtx = new AudioContext();
  let decoded: AudioBuffer;
  try {
    decoded = await audioCtx.decodeAudioData(arrayBuf.slice(0));
  } finally {
    audioCtx.close();
  }

  const mono = mixToMono(decoded);
  const resampled = await resample(mono, decoded.sampleRate, TARGET_RATE);
  const wavBuf = encodeWav16(resampled, TARGET_RATE);
  return new Blob([wavBuf], { type: "audio/wav" });
}

function mixToMono(buf: AudioBuffer): Float32Array {
  if (buf.numberOfChannels === 1) return buf.getChannelData(0);
  const len = buf.length;
  const out = new Float32Array(len);
  for (let ch = 0; ch < buf.numberOfChannels; ch++) {
    const data = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) out[i] += data[i] / buf.numberOfChannels;
  }
  return out;
}

async function resample(
  data: Float32Array,
  fromRate: number,
  toRate: number,
): Promise<Float32Array> {
  if (fromRate === toRate) return data;
  const ratio = toRate / fromRate;
  const outLen = Math.round(data.length * ratio);
  const offline = new OfflineAudioContext(1, outLen, toRate);
  const src = offline.createBuffer(1, data.length, fromRate);
  src.getChannelData(0).set(data);
  const node = offline.createBufferSource();
  node.buffer = src;
  node.connect(offline.destination);
  node.start(0);
  const rendered = await offline.startRendering();
  return rendered.getChannelData(0);
}

function encodeWav16(samples: Float32Array, sampleRate: number): ArrayBuffer {
  const bytesPerSample = 2;
  const blockAlign = 1 * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = samples.length * bytesPerSample;
  const buf = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buf);

  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, "WAVE");
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, "data");
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return buf;
}

function writeString(view: DataView, offset: number, s: string): void {
  for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
}
