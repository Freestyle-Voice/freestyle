/**
 * WebSocket-based audio streamer for real-time STT.
 * Sends raw PCM16 audio chunks to the server, receives partial/final transcripts.
 */

import { getPCMProcessorUrl } from "./pcm-processor";

const TARGET_RATE = 16000;

export interface StreamerCallbacks {
  onPartial: (text: string) => void;
  onFinal: (text: string) => void;
  onError: (message: string) => void;
  onReady: (model: string) => void;
  onConfig: (config: { streaming: boolean; model: string }) => void;
}

export class Streamer {
  private ws: WebSocket | null = null;
  private stream: MediaStream | null = null;
  private ctx: AudioContext | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private sessionReady = false;
  private pendingChunks: ArrayBuffer[] = [];
  private closed = false;
  private readonly callbacks: StreamerCallbacks;
  private readonly wsUrl: string;

  constructor(baseUrl: string, callbacks: StreamerCallbacks) {
    this.wsUrl = `${baseUrl.replace(/^http/, "ws")}/stream`;
    this.callbacks = callbacks;
  }

  setContext(context: string): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: "context", context }));
    }
  }

  async start(deviceId?: string | null): Promise<MediaStream> {
    // Open WebSocket
    this.openWebSocket();

    // Acquire mic
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

    // Set up audio processing: downsample to 16kHz mono PCM16
    this.ctx = new AudioContext();
    this.source = this.ctx.createMediaStreamSource(this.stream);

    await this.ctx.audioWorklet.addModule(getPCMProcessorUrl());
    this.workletNode = new AudioWorkletNode(this.ctx, "pcm-processor");
    this.workletNode.port.onmessage = (e: MessageEvent) => {
      if (this.closed) return;
      const input = new Float32Array(e.data);
      const pcm16 = downsampleAndEncode(
        input,
        this.ctx!.sampleRate,
        TARGET_RATE,
      );
      this.sendAudio(pcm16.buffer as ArrayBuffer);
    };

    this.source.connect(this.workletNode);
    this.workletNode.connect(this.ctx.destination);

    return this.stream;
  }

  commit(): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: "commit" }));
    }
  }

  cancel(): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: "cancel" }));
    }
    this.close();
  }

  close(): void {
    this.closed = true;
    this.stopCapture();
    if (this.ws && this.ws.readyState <= WebSocket.OPEN) this.ws.close();
    this.ws = null;
  }

  getStream(): MediaStream | null {
    return this.stream;
  }

  private sendAudio(chunk: ArrayBuffer): void {
    if (this.ws?.readyState === WebSocket.OPEN && this.sessionReady) {
      this.ws.send(chunk);
    } else {
      this.pendingChunks.push(chunk);
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
          // If not streaming, server closed the WS -- client should use REST
          if (!msg.streaming) {
            this.close();
          }
          break;
        case "session.ready":
          this.sessionReady = true;
          this.flushPendingChunks();
          this.callbacks.onReady(msg.model ?? "");
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

    ws.addEventListener("error", () => {
      this.callbacks.onError("WebSocket connection failed");
    });

    ws.addEventListener("close", () => {
      if (!this.closed) {
        this.sessionReady = false;
        this.pendingChunks = [];
        setTimeout(() => {
          if (!this.closed) this.openWebSocket();
        }, 1000);
      }
    });
  }

  private stopCapture(): void {
    try {
      this.workletNode?.disconnect();
    } catch {}
    try {
      this.source?.disconnect();
    } catch {}
    this.workletNode = null;
    this.source = null;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    if (this.ctx) {
      try {
        this.ctx.close();
      } catch {}
      this.ctx = null;
    }
  }
}

/**
 * Downsample float32 audio to target rate and encode as PCM16.
 */
function downsampleAndEncode(
  input: Float32Array,
  fromRate: number,
  toRate: number,
): Int16Array {
  const ratio = fromRate / toRate;
  const outLength = Math.round(input.length / ratio);
  const output = new Int16Array(outLength);

  for (let i = 0; i < outLength; i++) {
    const srcIndex = Math.round(i * ratio);
    const sample = Math.max(-1, Math.min(1, input[srcIndex] ?? 0));
    output[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
  }

  return output;
}
