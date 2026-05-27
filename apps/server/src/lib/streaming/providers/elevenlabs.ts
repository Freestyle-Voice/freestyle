import { Buffer } from "node:buffer";
import { createElevenLabs } from "@ai-sdk/elevenlabs";
import { experimental_transcribe as transcribe } from "ai";
import WebSocket from "ws";
import type {
  StreamingSessionOptions,
  StreamSession,
  TranscribeOptions,
  TranscribeResult,
  TranscriptionProvider,
} from "../types.js";

const ELEVENLABS_STT_URL = "wss://api.elevenlabs.io/v1/speech-to-text/realtime";
const ELEVENLABS_TOKEN_URL =
  "https://api.elevenlabs.io/v1/speech-to-text/realtime/token";

async function getSingleUseToken(apiKey: string): Promise<string> {
  const res = await fetch(ELEVENLABS_TOKEN_URL, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model_id: "scribe_v2_realtime" }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`ElevenLabs token request failed (${res.status}): ${text}`);
  }
  const data = (await res.json()) as { token?: string };
  if (!data.token) {
    throw new Error("ElevenLabs token response missing token field");
  }
  return data.token;
}

export class ElevenLabsTranscriptionProvider implements TranscriptionProvider {
  readonly providerId = "elevenlabs";

  async transcribe(opts: TranscribeOptions): Promise<TranscribeResult> {
    const provider = createElevenLabs({ apiKey: opts.apiKey });
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

  supportsStreaming(modelId: string): boolean {
    const short = modelId.includes("/") ? modelId.split("/").pop()! : modelId;
    return short.includes("realtime");
  }

  openStreamingSession(opts: StreamingSessionOptions): StreamSession {
    const { apiKey, model, callbacks } = opts;
    let partialText = "";
    let ws: WebSocket | null = null;

    const short = model.includes("/") ? model.split("/").pop()! : model;

    getSingleUseToken(apiKey)
      .then((token) => {
        const params = new URLSearchParams({
          model_id: short,
          token,
          audio_format: "pcm_16000",
          sample_rate: "16000",
        });

        ws = new WebSocket(`${ELEVENLABS_STT_URL}?${params}`);

        ws.on("open", () => {
          callbacks.onReady(short);
        });

        ws.on("message", (raw) => {
          let msg: { type?: string; text?: string };
          try {
            msg = JSON.parse(raw.toString());
          } catch {
            return;
          }

          switch (msg.type) {
            case "partial_transcript":
              partialText = msg.text ?? "";
              if (partialText) callbacks.onPartial(partialText);
              return;
            case "committed_transcript": {
              const text = msg.text ?? partialText;
              callbacks.onFinal(text.trim());
              partialText = "";
              return;
            }
            case "error": {
              const message =
                (msg as { message?: string }).message ?? "ElevenLabs error";
              callbacks.onError(message);
              return;
            }
          }
        });

        ws.on("error", (err) => {
          callbacks.onError(err instanceof Error ? err.message : String(err));
        });

        ws.on("close", () => {
          callbacks.onClose();
        });
      })
      .catch((err) => {
        callbacks.onError(err instanceof Error ? err.message : String(err));
        callbacks.onClose();
      });

    return {
      sendAudio(chunk: ArrayBuffer): void {
        if (!ws || ws.readyState !== WebSocket.OPEN) return;
        const b64 = Buffer.from(chunk).toString("base64");
        ws.send(JSON.stringify({ audio_base64: b64 }));
      },
      commit(): void {
        if (!ws || ws.readyState !== WebSocket.OPEN) return;
        ws.send(JSON.stringify({ type: "commit" }));
      },
      cancel(): void {
        if (!ws || ws.readyState !== WebSocket.OPEN) return;
        ws.close();
        partialText = "";
      },
      close(): void {
        if (ws && ws.readyState <= WebSocket.OPEN) ws.close();
      },
    };
  }
}
