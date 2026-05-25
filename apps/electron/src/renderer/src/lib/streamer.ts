/**
 * Persistent WebSocket-based audio streamer for real-time STT.
 *
 * A single Streamer instance stays alive across recording sessions.
 * The WebSocket to the server (and through it the OpenAI Realtime
 * upstream) remains open, eliminating reconnection overhead on each
 * hotkey press.  Recording sessions are delimited by startCapture /
 * commit / cancel rather than connect / disconnect.
 */

import { getPCMProcessorUrl } from "./pcm-processor";

const TARGET_RATE = 16000;
const WAV_HEADER_SIZE = 44;

export interface StreamerCallbacks {
  onPartial: (text: string) => void;
  onFinal: (text: string) => void;
  onError: (message: string) => void;
  onReady: () => void;
  onConfig: (config: { streaming: boolean; model: string }) => void;
}

export class Streamer {
  private ws: WebSocket | null = null;
  private sessionReady = false;
  private pendingChunks: ArrayBuffer[] = [];
  private destroyed = false;
  private readonly callbacks: StreamerCallbacks;
  private readonly wsUrl: string;

  // Capture pipeline — reused across sessions when possible
  private ctx: AudioContext | null = null;
  private workletReady = false;
  private source: MediaStreamAudioSourceNode | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private capturing = false;

  // PCM accumulator for REST fallback WAV generation
  private pcmChunks: Int16Array[] = [];
  private pcmSampleCount = 0;

  constructor(baseUrl: string, callbacks: StreamerCallbacks) {
    this.wsUrl = `${baseUrl.replace(/^http/, "ws")}/stream`;
    this.callbacks = callbacks;
    this.openWebSocket();
  }

  // ------- public API -------

  setContext(context: string): void {
    this.sendJSON({ type: "context", context });
  }

  async startCapture(
    stream: MediaStream,
    sharedCtx?: AudioContext,
  ): Promise<void> {
    this.capturing = true;
    this.pendingChunks = [];
    this.pcmChunks = [];
    this.pcmSampleCount = 0;
    this.sendJSON({ type: "start" });

    if (sharedCtx && sharedCtx.state !== "closed") {
      if (this.ctx && this.ctx !== sharedCtx) {
        try {
          this.ctx.close();
        } catch {}
      }
      this.ctx = sharedCtx;
    }
    if (!this.ctx || this.ctx.state === "closed") {
      this.ctx = new AudioContext();
    }
    if (this.ctx.state === "suspended") await this.ctx.resume();

    if (!this.workletReady) {
      await this.ctx.audioWorklet.addModule(getPCMProcessorUrl());
      this.workletReady = true;
    }

    this.source = this.ctx.createMediaStreamSource(stream);
    this.workletNode = new AudioWorkletNode(this.ctx, "pcm-processor");

    // Tell the worklet the native sample rate so it can compute the
    // downsampling ratio.
    this.workletNode.port.postMessage({
      type: "init",
      sampleRate: this.ctx.sampleRate,
    });

    this.workletNode.port.onmessage = (e: MessageEvent) => {
      if (!this.capturing) return;
      const chunk = e.data as ArrayBuffer;
      this.sendAudio(chunk);

      // Accumulate for REST fallback
      const pcm16 = new Int16Array(chunk);
      this.pcmChunks.push(pcm16);
      this.pcmSampleCount += pcm16.length;
    };
    this.source.connect(this.workletNode);
    this.workletNode.connect(this.ctx.destination);
  }

  commit(): void {
    this.stopCapture();
    this.sendJSON({ type: "commit" });
  }

  cancel(): void {
    this.stopCapture();
    this.sendJSON({ type: "cancel" });
  }

  /**
   * Build a WAV blob from the PCM16 chunks accumulated during capture.
   * This bypasses the expensive MediaRecorder → decode → resample chain.
   */
  getWavBlob(): Blob | null {
    if (this.pcmSampleCount === 0) return null;

    const dataSize = this.pcmSampleCount * 2;
    const buf = new ArrayBuffer(WAV_HEADER_SIZE + dataSize);
    const view = new DataView(buf);

    // RIFF/WAVE header
    writeStr(view, 0, "RIFF");
    view.setUint32(4, 36 + dataSize, true);
    writeStr(view, 8, "WAVE");
    writeStr(view, 12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); // PCM
    view.setUint16(22, 1, true); // mono
    view.setUint32(24, TARGET_RATE, true);
    view.setUint32(28, TARGET_RATE * 2, true); // byte rate
    view.setUint16(32, 2, true); // block align
    view.setUint16(34, 16, true); // bits per sample
    writeStr(view, 36, "data");
    view.setUint32(40, dataSize, true);

    // Copy PCM samples
    let offset = WAV_HEADER_SIZE;
    for (const chunk of this.pcmChunks) {
      for (let i = 0; i < chunk.length; i++, offset += 2) {
        view.setInt16(offset, chunk[i], true);
      }
    }

    this.pcmChunks = [];
    this.pcmSampleCount = 0;
    return new Blob([buf], { type: "audio/wav" });
  }

  destroy(): void {
    this.destroyed = true;
    this.stopCapture();
    if (this.ws && this.ws.readyState <= WebSocket.OPEN) this.ws.close();
    this.ws = null;
    if (this.ctx) {
      try {
        this.ctx.close();
      } catch {}
      this.ctx = null;
      this.workletReady = false;
    }
  }

  getAudioContext(): AudioContext | null {
    return this.ctx;
  }

  // ------- internals -------

  private stopCapture(): void {
    this.capturing = false;
    try {
      this.workletNode?.disconnect();
    } catch {}
    try {
      this.source?.disconnect();
    } catch {}
    this.workletNode = null;
    this.source = null;
  }

  private sendAudio(chunk: ArrayBuffer): void {
    if (this.ws?.readyState === WebSocket.OPEN && this.sessionReady) {
      this.ws.send(chunk);
    } else {
      this.pendingChunks.push(chunk);
    }
  }

  private sendJSON(obj: Record<string, unknown>): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(obj));
    }
  }

  private flushPendingChunks(): void {
    if (!this.sessionReady || this.ws?.readyState !== WebSocket.OPEN) return;
    for (const chunk of this.pendingChunks) {
      this.ws!.send(chunk);
    }
    this.pendingChunks = [];
  }

  private openWebSocket(): void {
    if (this.destroyed) return;
    const ws = new WebSocket(this.wsUrl);
    ws.binaryType = "arraybuffer";
    this.ws = ws;

    ws.addEventListener("message", (e) => {
      if (typeof e.data !== "string") return;
      let msg: {
        type: string;
        text?: string;
        message?: string;
        model?: string;
        streaming?: boolean;
      };
      try {
        msg = JSON.parse(e.data);
      } catch {
        return;
      }
      switch (msg.type) {
        case "config":
          this.callbacks.onConfig({
            streaming: msg.streaming ?? false,
            model: msg.model ?? "",
          });
          if (!msg.streaming) {
            this.destroy();
          }
          break;
        case "session.ready":
          this.sessionReady = true;
          this.flushPendingChunks();
          this.callbacks.onReady();
          break;
        case "partial":
          this.callbacks.onPartial(msg.text ?? "");
          break;
        case "final":
          this.callbacks.onFinal(msg.text ?? "");
          break;
        case "error":
          this.callbacks.onError(msg.message ?? "Unknown error");
          break;
      }
    });

    ws.addEventListener("error", () => {});

    ws.addEventListener("close", () => {
      this.sessionReady = false;
      this.pendingChunks = [];
      if (!this.destroyed) {
        setTimeout(() => {
          if (!this.destroyed) this.openWebSocket();
        }, 1000);
      }
    });
  }
}

function writeStr(view: DataView, offset: number, s: string): void {
  for (let i = 0; i < s.length; i++) {
    view.setUint8(offset + i, s.charCodeAt(i));
  }
}
