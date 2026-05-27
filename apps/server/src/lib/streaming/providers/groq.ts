import { createGroq } from "@ai-sdk/groq";
import { experimental_transcribe as transcribe } from "ai";
import type {
  TranscribeOptions,
  TranscribeResult,
  TranscriptionProvider,
} from "../types.js";

export class GroqTranscriptionProvider implements TranscriptionProvider {
  readonly providerId = "groq";

  async transcribe(opts: TranscribeOptions): Promise<TranscribeResult> {
    const provider = createGroq({ apiKey: opts.apiKey });
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
    return false;
  }
}
