import * as SecureStore from "expo-secure-store";

const API_KEY_PREFIX = "freestyle_apikey_";

export async function getApiKey(provider: string): Promise<string | null> {
  return SecureStore.getItemAsync(`${API_KEY_PREFIX}${provider}`);
}

export async function setApiKey(
  provider: string,
  key: string,
): Promise<void> {
  await SecureStore.setItemAsync(`${API_KEY_PREFIX}${provider}`, key);
}

export async function deleteApiKey(provider: string): Promise<void> {
  await SecureStore.deleteItemAsync(`${API_KEY_PREFIX}${provider}`);
}

export async function hasApiKey(provider: string): Promise<boolean> {
  const key = await getApiKey(provider);
  return key !== null && key.length > 0;
}

export const PROVIDERS = [
  {
    id: "openai",
    name: "OpenAI",
    description: "Whisper, GPT-4o Transcribe",
    keyPlaceholder: "sk-...",
  },
  {
    id: "groq",
    name: "Groq",
    description: "Fast transcription with Whisper",
    keyPlaceholder: "gsk_...",
  },
  {
    id: "deepgram",
    name: "Deepgram",
    description: "Nova-2, Nova-3 models",
    keyPlaceholder: "dg_...",
  },
  {
    id: "elevenlabs",
    name: "ElevenLabs",
    description: "Scribe v1 transcription",
    keyPlaceholder: "sk_...",
  },
  {
    id: "anthropic",
    name: "Anthropic",
    description: "Claude for LLM post-processing",
    keyPlaceholder: "sk-ant-...",
  },
  {
    id: "google",
    name: "Google",
    description: "Gemini for LLM post-processing",
    keyPlaceholder: "AIza...",
  },
] as const;

export type ProviderId = (typeof PROVIDERS)[number]["id"];

export const VOICE_MODELS = [
  {
    provider: "openai",
    model_id: "openai/gpt-4o-transcribe",
    model_name: "GPT-4o Transcribe",
  },
  {
    provider: "openai",
    model_id: "openai/gpt-4o-mini-transcribe",
    model_name: "GPT-4o Mini Transcribe",
  },
  {
    provider: "openai",
    model_id: "openai/whisper-1",
    model_name: "Whisper v1",
  },
  {
    provider: "deepgram",
    model_id: "deepgram/nova-3",
    model_name: "Nova 3",
  },
  {
    provider: "deepgram",
    model_id: "deepgram/nova-2",
    model_name: "Nova 2",
  },
  {
    provider: "elevenlabs",
    model_id: "elevenlabs/scribe_v1",
    model_name: "Scribe v1",
  },
  {
    provider: "groq",
    model_id: "groq/whisper-large-v3",
    model_name: "Whisper Large v3",
  },
  {
    provider: "groq",
    model_id: "groq/whisper-large-v3-turbo",
    model_name: "Whisper Large v3 Turbo",
  },
] as const;

export const LLM_MODELS = [
  {
    provider: "openai",
    model_id: "openai/gpt-4o-mini",
    model_name: "GPT-4o Mini",
  },
  {
    provider: "openai",
    model_id: "openai/gpt-4o",
    model_name: "GPT-4o",
  },
  {
    provider: "anthropic",
    model_id: "anthropic/claude-sonnet-4-20250514",
    model_name: "Claude Sonnet 4",
  },
  {
    provider: "anthropic",
    model_id: "anthropic/claude-haiku-4-20250514",
    model_name: "Claude Haiku 4",
  },
  {
    provider: "google",
    model_id: "google/gemini-2.0-flash",
    model_name: "Gemini 2.0 Flash",
  },
  {
    provider: "groq",
    model_id: "groq/llama-3.3-70b-versatile",
    model_name: "Llama 3.3 70B",
  },
] as const;

export const LANGUAGES = [
  { code: "auto", name: "Auto Detect" },
  { code: "en", name: "English" },
  { code: "es", name: "Spanish" },
  { code: "fr", name: "French" },
  { code: "de", name: "German" },
  { code: "it", name: "Italian" },
  { code: "pt", name: "Portuguese" },
  { code: "nl", name: "Dutch" },
  { code: "ja", name: "Japanese" },
  { code: "ko", name: "Korean" },
  { code: "zh", name: "Chinese" },
  { code: "ar", name: "Arabic" },
  { code: "hi", name: "Hindi" },
  { code: "ru", name: "Russian" },
  { code: "pl", name: "Polish" },
  { code: "tr", name: "Turkish" },
  { code: "sv", name: "Swedish" },
  { code: "da", name: "Danish" },
  { code: "no", name: "Norwegian" },
  { code: "fi", name: "Finnish" },
] as const;
