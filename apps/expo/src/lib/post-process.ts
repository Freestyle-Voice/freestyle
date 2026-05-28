import {
  getSetting,
  getDefaultModel,
  getAllDictionaryEntries,
  getFormatRules,
  getDb,
} from "./db";
import { getApiKey } from "./storage";

export interface PostProcessResult {
  cleaned: string;
  llmProvider: string | null;
  llmModel: string | null;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}

function stripProviderPrefix(modelId: string): string {
  const slashIdx = modelId.indexOf("/");
  return slashIdx >= 0 ? modelId.slice(slashIdx + 1) : modelId;
}

function getContextHint(
  formatRules: { app_pattern: string; instructions: string }[],
  contextHint?: string,
): string {
  if (!contextHint) return "";

  for (const rule of formatRules) {
    const patterns = rule.app_pattern.split("|").map((p) => p.trim());
    for (const pattern of patterns) {
      if (
        pattern &&
        contextHint.toLowerCase().includes(pattern.toLowerCase())
      ) {
        return rule.instructions;
      }
    }
  }

  return "";
}

const SYSTEM_PROMPT_TEMPLATE = `You clean up raw voice transcriptions into polished, ready-to-send text.
{CONTEXT}
Edits you MUST apply:
1. Remove filler words (um, uh, like, you know, basically, so, I mean, right, actually, literally)
2. Remove false starts, repeated words, and self-corrections — keep only the final intended version
3. Fix punctuation, capitalization, and grammar
4. Convert spoken numbers, dates, and units to their written form (e.g. "three hundred dollars" -> "$300")
5. Clean up spoken artifacts: "dot" -> ".", "at sign" / "at" in emails -> "@", "slash" -> "/", "hashtag" -> "#", "dash" -> "-"
6. Smooth awkward phrasing caused by speech-to-text without changing the meaning
7. Break run-on sentences into proper sentences where the speaker clearly intended a pause
8. Ensure the text reads naturally as written communication

Rules:
- Preserve the speaker's meaning and tone faithfully
- Do NOT add information the speaker did not convey
- Do NOT summarize or omit content — keep everything the speaker said
- Do NOT add greetings, sign-offs, or filler the speaker didn't say
- Do NOT explain your edits or include any commentary
- If the input is only filler words or silence, return an empty string

IMPORTANT: Your entire response must be the cleaned text and nothing else. No quotes, no explanations, no reasoning, no prefixes.`;

export async function postProcess(
  rawText: string,
  contextHint?: string,
): Promise<PostProcessResult> {
  let inputTokens = 0;
  let outputTokens = 0;
  let llmProvider: string | null = null;
  let llmModel: string | null = null;

  const stripped = rawText
    .replace(
      /\b(um+|uh+|ah+|er+|hm+|hmm+|mm+|mhm+|you know|i mean)\b/gi,
      "",
    )
    .replace(/[.…,!?\-–—\s]+/g, "");
  if (!stripped) {
    return {
      cleaned: "",
      llmProvider: null,
      llmModel: null,
      inputTokens: 0,
      outputTokens: 0,
      costUsd: 0,
    };
  }

  let cleaned = rawText;

  const llmSetting = await getSetting("llm_cleanup");
  const llmEnabled = llmSetting === "true";

  if (llmEnabled) {
    const llmConfig = await getDefaultModel("llm");
    if (llmConfig) {
      const apiKey = await getApiKey(llmConfig.provider);
      if (apiKey) {
        try {
          const formatRules = await getFormatRules();
          const hint = getContextHint(formatRules, contextHint);
          const contextLine = hint ? `\nContext: ${hint}\n` : "";
          const systemPrompt = SYSTEM_PROMPT_TEMPLATE.replace(
            "{CONTEXT}",
            contextLine,
          );

          const result = await callLLM(
            llmConfig.provider,
            stripProviderPrefix(llmConfig.model_id),
            apiKey,
            systemPrompt,
            rawText,
          );

          let llmText = result.text.trim();
          inputTokens = result.inputTokens;
          outputTokens = result.outputTokens;
          llmProvider = llmConfig.provider;
          llmModel = llmConfig.model_id;

          if (llmText.includes("\n") && llmText.length > rawText.length * 2) {
            const quoted = llmText.match(/"([^"]+)"[^"]*$/);
            if (quoted) {
              llmText = quoted[1];
            } else {
              const lines = llmText.split("\n").filter((l) => l.trim());
              llmText = lines[lines.length - 1]?.trim() ?? rawText;
            }
          }

          if (
            llmText.startsWith('"') &&
            llmText.endsWith('"') &&
            !rawText.startsWith('"')
          ) {
            llmText = llmText.slice(1, -1);
          }

          cleaned = llmText;
        } catch (err) {
          console.error("LLM cleanup failed:", err);
        }
      }
    }
  }

  cleaned = await applyDictionaryReplacements(cleaned);

  return {
    cleaned,
    llmProvider,
    llmModel,
    inputTokens,
    outputTokens,
    costUsd: 0,
  };
}

async function applyDictionaryReplacements(text: string): Promise<string> {
  try {
    const dictEntries = await getAllDictionaryEntries();
    if (dictEntries.length === 0) return text;

    const db = await getDb();
    const matchedIds: string[] = [];
    let result = text;

    for (const { id, key, value } of dictEntries) {
      const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(`\\b${escaped}\\b`, "gi");
      if (regex.test(result)) {
        matchedIds.push(id);
        result = result.replace(
          new RegExp(`\\b${escaped}\\b`, "gi"),
          value,
        );
      }
    }

    for (const id of matchedIds) {
      await db.runAsync(
        "UPDATE dictionary SET usage_count = usage_count + 1, updated_at = datetime('now') WHERE id = ?",
        [id],
      );
    }

    return result;
  } catch {
    return text;
  }
}

interface LLMResult {
  text: string;
  inputTokens: number;
  outputTokens: number;
}

async function callLLM(
  provider: string,
  model: string,
  apiKey: string,
  systemPrompt: string,
  userMessage: string,
): Promise<LLMResult> {
  const { url, headers, body } = buildLLMRequest(
    provider,
    model,
    apiKey,
    systemPrompt,
    userMessage,
  );

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`LLM call failed: ${response.status} ${errText}`);
  }

  const result = await response.json();
  return parseLLMResponse(provider, result);
}

function buildLLMRequest(
  provider: string,
  model: string,
  apiKey: string,
  systemPrompt: string,
  userMessage: string,
): { url: string; headers: Record<string, string>; body: unknown } {
  switch (provider) {
    case "openai":
    case "groq":
      return {
        url:
          provider === "groq"
            ? "https://api.groq.com/openai/v1/chat/completions"
            : "https://api.openai.com/v1/chat/completions",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: {
          model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userMessage },
          ],
          temperature: 0.3,
        },
      };

    case "anthropic":
      return {
        url: "https://api.anthropic.com/v1/messages",
        headers: {
          "x-api-key": apiKey,
          "Content-Type": "application/json",
          "anthropic-version": "2023-06-01",
        },
        body: {
          model,
          max_tokens: 4096,
          system: systemPrompt,
          messages: [{ role: "user", content: userMessage }],
        },
      };

    case "google":
      return {
        url: `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        headers: { "Content-Type": "application/json" },
        body: {
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: [{ parts: [{ text: userMessage }] }],
        },
      };

    default:
      throw new Error(`Unsupported LLM provider: ${provider}`);
  }
}

function parseLLMResponse(
  provider: string,
  result: any,
): LLMResult {
  switch (provider) {
    case "openai":
    case "groq":
      return {
        text: result.choices?.[0]?.message?.content ?? "",
        inputTokens: result.usage?.prompt_tokens ?? 0,
        outputTokens: result.usage?.completion_tokens ?? 0,
      };

    case "anthropic":
      return {
        text:
          result.content
            ?.filter((c: any) => c.type === "text")
            .map((c: any) => c.text)
            .join("") ?? "",
        inputTokens: result.usage?.input_tokens ?? 0,
        outputTokens: result.usage?.output_tokens ?? 0,
      };

    case "google":
      return {
        text:
          result.candidates?.[0]?.content?.parts
            ?.map((p: any) => p.text)
            .join("") ?? "",
        inputTokens:
          result.usageMetadata?.promptTokenCount ?? 0,
        outputTokens:
          result.usageMetadata?.candidatesTokenCount ?? 0,
      };

    default:
      return { text: "", inputTokens: 0, outputTokens: 0 };
  }
}
