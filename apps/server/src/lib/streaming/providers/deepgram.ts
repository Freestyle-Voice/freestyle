import { createDeepgram } from "@ai-sdk/deepgram";
import { experimental_transcribe as transcribe } from "ai";
import WebSocket from "ws";
import type {
  StreamingSessionOptions,
  StreamSession,
  TranscribeOptions,
  TranscribeResult,
  TranscriptionProvider,
} from "../types.js";

const DEEPGRAM_LISTEN_URL = "wss://api.deepgram.com/v1/listen";

export class DeepgramTranscriptionProvider implements TranscriptionProvider {
  readonly providerId = "deepgram";

  async transcribe(opts: TranscribeOptions): Promise<TranscribeResult> {
    const provider = createDeepgram({ apiKey: opts.apiKey });
    const short = opts.model.includes("/")
      ? opts.model.slice(opts.model.indexOf("/") + 1)
      : opts.model;
    const model = provider.transcription(short);
    const result = await transcribe({
      model,
      audio: opts.audio,
      ...(opts.language && opts.language !== "auto"
        ? { language: opts.language }
        : {}),
    });
    return {
      text: result.text,
      segments: result.segments,
      durationInSeconds: result.durationInSeconds,
    };
  }

  supportsStreaming(_modelId: string): boolean {
    return true;
  }

  openStreamingSession(opts: StreamingSessionOptions): StreamSession {
    const { apiKey, model, callbacks } = opts;
    let partialText = "";

    const short = model.includes("/") ? model.split("/").pop()! : model;

    const params = new URLSearchParams({
      model: short,
      encoding: "linear16",
      sample_rate: "16000",
      channels: "1",
      interim_results: "true",
      punctuate: "true",
      endpointing: "false",
      vad_events: "false",
    });

    const ws = new WebSocket(`${DEEPGRAM_LISTEN_URL}?${params}`, {
      headers: { Authorization: `Token ${apiKey}` },
    });

    ws.on("open", () => {
      callbacks.onReady(short);
    });

    ws.on("message", (raw) => {
      let msg: {
        type?: string;
        is_final?: boolean;
        speech_final?: boolean;
        channel?: {
          alternatives?: Array<{ transcript?: string }>;
        };
      };
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return;
      }

      if (msg.type !== "Results") return;

      const transcript = msg.channel?.alternatives?.[0]?.transcript ?? "";
      if (!transcript) return;

      if (msg.is_final) {
        callbacks.onFinal(transcript.trim());
        partialText = "";
      } else {
        partialText = transcript;
        callbacks.onPartial(partialText);
      }
    });

    ws.on("error", (err) => {
      callbacks.onError(err instanceof Error ? err.message : String(err));
    });

    ws.on("close", () => {
      callbacks.onClose();
    });

    return {
      sendAudio(chunk: ArrayBuffer): void {
        if (ws.readyState !== WebSocket.OPEN) return;
        ws.send(chunk);
      },
      commit(): void {
        if (ws.readyState !== WebSocket.OPEN) return;
        ws.send(JSON.stringify({ type: "CloseStream" }));
      },
      cancel(): void {
        if (ws.readyState !== WebSocket.OPEN) return;
        ws.send(JSON.stringify({ type: "CloseStream" }));
        partialText = "";
      },
      close(): void {
        if (ws.readyState <= WebSocket.OPEN) ws.close();
      },
    };
  }
}
