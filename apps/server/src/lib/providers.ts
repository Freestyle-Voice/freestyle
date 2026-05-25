import { createAnthropic } from "@ai-sdk/anthropic";
import { createDeepgram } from "@ai-sdk/deepgram";
import { createElevenLabs } from "@ai-sdk/elevenlabs";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createGroq } from "@ai-sdk/groq";
import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModelV1 } from "ai";
import { getDb } from "./db.js";

// Providers that don't require an API key from the api_keys table
const LOCAL_PROVIDERS = new Set(["local-llm"]);

// Provider factory creators keyed by provider ID
const PROVIDER_FACTORIES: Record<
  string,
  (apiKey: string) => {
    transcription?: (model: string) => unknown;
    chat?: (model: string) => LanguageModelV1;
  }
> = {
  openai: (apiKey) => {
    const p = createOpenAI({ apiKey });
    return { transcription: (m) => p.transcription(m), chat: (m) => p.chat(m) };
  },
  groq: (apiKey) => {
    const p = createGroq({ apiKey });
    return { transcription: (m) => p.transcription(m), chat: (m) => p.chat(m) };
  },
  anthropic: (apiKey) => {
    const p = createAnthropic({ apiKey });
    return { chat: (m) => p.chat(m) };
  },
  google: (apiKey) => {
    const p = createGoogleGenerativeAI({ apiKey });
    return { chat: (m) => p.chat(m) };
  },
  deepgram: (apiKey) => {
    const p = createDeepgram({ apiKey });
    return { transcription: (m) => p.transcription(m) };
  },
  elevenlabs: (apiKey) => {
    const p = createElevenLabs({ apiKey });
    return { transcription: (m) => p.transcription(m) };
  },
  "local-llm": () => {
    const db = getDb();
    const urlRow = db
      .prepare("SELECT value FROM settings WHERE key = 'local_llm_url'")
      .get() as { value: string } | undefined;
    const keyRow = db
      .prepare("SELECT value FROM settings WHERE key = 'local_llm_api_key'")
      .get() as { value: string } | undefined;

    const baseURL = urlRow?.value || "http://localhost:11434";
    const apiKey = keyRow?.value || "local";

    const p = createOpenAI({ apiKey, baseURL: `${baseURL}/v1` });
    return { chat: (m: string) => p.chat(m) };
  },
};

// Also try matching by prefix (e.g., "openai" matches "openai-compatible")
function findFactory(providerId: string) {
  if (PROVIDER_FACTORIES[providerId]) return PROVIDER_FACTORIES[providerId];
  // Try prefix match
  for (const [key, factory] of Object.entries(PROVIDER_FACTORIES)) {
    if (providerId.startsWith(key)) return factory;
  }
  return null;
}

function getApiKey(providerId: string): string | null {
  const db = getDb();
  const row = db
    .prepare("SELECT key FROM api_keys WHERE provider = ?")
    .get(providerId) as { key: string } | undefined;
  return row?.key ?? null;
}

interface DefaultModels {
  voice: { provider: string; model_id: string; model_name: string } | null;
  llm: { provider: string; model_id: string; model_name: string } | null;
}

export function getDefaultModels(): DefaultModels {
  const db = getDb();
  const voice = db
    .prepare(
      "SELECT provider, model_id, model_name FROM model_configs WHERE type = 'voice' AND is_default = 1 LIMIT 1",
    )
    .get() as
    | { provider: string; model_id: string; model_name: string }
    | undefined;
  const llm = db
    .prepare(
      "SELECT provider, model_id, model_name FROM model_configs WHERE type = 'llm' AND is_default = 1 LIMIT 1",
    )
    .get() as
    | { provider: string; model_id: string; model_name: string }
    | undefined;

  return {
    voice: voice ?? null,
    llm: llm ?? null,
  };
}

export function createTranscriptionModel(providerId: string, modelId: string) {
  const apiKey = getApiKey(providerId);
  if (!apiKey)
    throw new Error(`No API key configured for provider: ${providerId}`);

  const factory = findFactory(providerId);
  if (!factory) throw new Error(`Unsupported provider: ${providerId}`);

  const provider = factory(apiKey);
  if (!provider.transcription) {
    throw new Error(`Provider ${providerId} does not support transcription`);
  }

  // The model_id from models.dev is like "openai/whisper-1" -- extract the part after "/"
  const shortId = modelId.includes("/") ? modelId.split("/").pop()! : modelId;
  return provider.transcription(shortId);
}

export function createChatModel(
  providerId: string,
  modelId: string,
): LanguageModelV1 {
  const isLocal = LOCAL_PROVIDERS.has(providerId);
  const apiKey = isLocal ? "local" : getApiKey(providerId);
  if (!apiKey)
    throw new Error(`No API key configured for provider: ${providerId}`);

  const factory = findFactory(providerId);
  if (!factory) throw new Error(`Unsupported provider: ${providerId}`);

  const provider = factory(apiKey);
  if (!provider.chat) {
    throw new Error(`Provider ${providerId} does not support chat`);
  }

  const shortId = modelId.includes("/") ? modelId.split("/").pop()! : modelId;
  return provider.chat(shortId);
}
