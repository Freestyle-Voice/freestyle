import * as SQLite from "expo-sqlite";
import { initSchema } from "./schema";

const DB_NAME = "freestyle.db";

let db: SQLite.SQLiteDatabase | null = null;
let initPromise: Promise<void> | null = null;

export async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (db) return db;

  db = await SQLite.openDatabaseAsync(DB_NAME);

  await db.execAsync("PRAGMA journal_mode = WAL");
  await db.execAsync("PRAGMA foreign_keys = ON");
  await db.execAsync("PRAGMA synchronous = NORMAL");
  await db.execAsync("PRAGMA busy_timeout = 5000");

  await initSchema(db);

  return db;
}

export async function initDatabase(): Promise<void> {
  if (!initPromise) {
    initPromise = getDb().then(() => {});
  }
  return initPromise;
}

export function generateId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `${timestamp}-${random}`;
}

// --- Settings helpers ---

export async function getSetting(key: string): Promise<string | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ value: string }>(
    "SELECT value FROM settings WHERE key = ? AND deleted_at IS NULL",
    [key],
  );
  return row?.value ?? null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
     ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = datetime('now'), deleted_at = NULL`,
    [key, value, value],
  );
}

// --- Model config helpers ---

export interface ModelConfig {
  id: string;
  provider: string;
  model_id: string;
  model_name: string;
  type: "voice" | "llm";
  is_default: number;
  created_at: string;
}

export async function getDefaultModel(
  type: "voice" | "llm",
): Promise<ModelConfig | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<ModelConfig>(
    "SELECT * FROM model_configs WHERE type = ? AND is_default = 1 AND deleted_at IS NULL LIMIT 1",
    [type],
  );
  return row ?? null;
}

export async function getModelConfigs(
  type?: "voice" | "llm",
): Promise<ModelConfig[]> {
  const db = await getDb();
  if (type) {
    return db.getAllAsync<ModelConfig>(
      "SELECT * FROM model_configs WHERE type = ? AND deleted_at IS NULL ORDER BY is_default DESC, created_at DESC",
      [type],
    );
  }
  return db.getAllAsync<ModelConfig>(
    "SELECT * FROM model_configs WHERE deleted_at IS NULL ORDER BY type, is_default DESC, created_at DESC",
  );
}

export async function addModelConfig(config: {
  provider: string;
  model_id: string;
  model_name: string;
  type: "voice" | "llm";
  is_default?: boolean;
}): Promise<string> {
  const db = await getDb();
  const id = generateId();

  if (config.is_default) {
    await db.runAsync(
      "UPDATE model_configs SET is_default = 0 WHERE type = ?",
      [config.type],
    );
  }

  await db.runAsync(
    "INSERT INTO model_configs (id, provider, model_id, model_name, type, is_default) VALUES (?, ?, ?, ?, ?, ?)",
    [
      id,
      config.provider,
      config.model_id,
      config.model_name,
      config.type,
      config.is_default ? 1 : 0,
    ],
  );

  return id;
}

export async function setDefaultModel(
  id: string,
  type: "voice" | "llm",
): Promise<void> {
  const db = await getDb();
  await db.runAsync("UPDATE model_configs SET is_default = 0 WHERE type = ?", [
    type,
  ]);
  await db.runAsync("UPDATE model_configs SET is_default = 1 WHERE id = ?", [
    id,
  ]);
}

export async function deleteModelConfig(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    "UPDATE model_configs SET deleted_at = datetime('now') WHERE id = ?",
    [id],
  );
}

// --- History helpers ---

export interface HistoryEntry {
  id: string;
  raw_text: string;
  cleaned_text: string | null;
  voice_provider: string;
  voice_model: string;
  llm_provider: string | null;
  llm_model: string | null;
  duration_ms: number;
  audio_duration_ms: number;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
  created_at: string;
}

export async function addHistoryEntry(entry: {
  raw_text: string;
  cleaned_text: string | null;
  voice_provider: string;
  voice_model: string;
  llm_provider?: string | null;
  llm_model?: string | null;
  duration_ms: number;
  audio_duration_ms?: number;
  input_tokens?: number;
  output_tokens?: number;
  cost_usd?: number;
  device_id?: string;
}): Promise<string> {
  const db = await getDb();
  const id = generateId();

  await db.runAsync(
    `INSERT INTO transcription_history
      (id, raw_text, cleaned_text, voice_provider, voice_model, llm_provider, llm_model, duration_ms, audio_duration_ms, input_tokens, output_tokens, cost_usd, device_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      entry.raw_text,
      entry.cleaned_text,
      entry.voice_provider,
      entry.voice_model,
      entry.llm_provider ?? null,
      entry.llm_model ?? null,
      entry.duration_ms,
      entry.audio_duration_ms ?? 0,
      entry.input_tokens ?? 0,
      entry.output_tokens ?? 0,
      entry.cost_usd ?? 0,
      entry.device_id ?? null,
    ],
  );

  return id;
}

export async function getHistory(opts?: {
  limit?: number;
  offset?: number;
  search?: string;
}): Promise<HistoryEntry[]> {
  const db = await getDb();
  const limit = opts?.limit ?? 50;
  const offset = opts?.offset ?? 0;

  if (opts?.search) {
    const searchTerm = `%${opts.search}%`;
    return db.getAllAsync<HistoryEntry>(
      `SELECT * FROM transcription_history
       WHERE deleted_at IS NULL AND (raw_text LIKE ? OR cleaned_text LIKE ?)
       ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [searchTerm, searchTerm, limit, offset],
    );
  }

  return db.getAllAsync<HistoryEntry>(
    "SELECT * FROM transcription_history WHERE deleted_at IS NULL ORDER BY created_at DESC LIMIT ? OFFSET ?",
    [limit, offset],
  );
}

export interface HistoryStats {
  total_sessions: number;
  total_duration_ms: number;
  total_cost_usd: number;
  today_sessions: number;
}

export async function getHistoryStats(): Promise<HistoryStats> {
  const db = await getDb();

  const stats = await db.getFirstAsync<{
    total_sessions: number;
    total_duration_ms: number;
    total_cost_usd: number;
  }>(
    `SELECT
      COUNT(*) as total_sessions,
      COALESCE(SUM(duration_ms), 0) as total_duration_ms,
      COALESCE(SUM(cost_usd), 0) as total_cost_usd
     FROM transcription_history WHERE deleted_at IS NULL`,
  );

  const today = await db.getFirstAsync<{ today_sessions: number }>(
    `SELECT COUNT(*) as today_sessions FROM transcription_history
     WHERE deleted_at IS NULL AND date(created_at) = date('now')`,
  );

  return {
    total_sessions: stats?.total_sessions ?? 0,
    total_duration_ms: stats?.total_duration_ms ?? 0,
    total_cost_usd: stats?.total_cost_usd ?? 0,
    today_sessions: today?.today_sessions ?? 0,
  };
}

export async function deleteHistoryEntry(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    "UPDATE transcription_history SET deleted_at = datetime('now') WHERE id = ?",
    [id],
  );
}

export async function deleteAllHistory(): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    "UPDATE transcription_history SET deleted_at = datetime('now') WHERE deleted_at IS NULL",
  );
}

// --- Dictionary helpers ---

export interface DictionaryEntry {
  id: string;
  key: string;
  value: string;
  usage_count: number;
  created_at: string;
  updated_at: string;
}

export async function getDictionary(opts?: {
  search?: string;
}): Promise<DictionaryEntry[]> {
  const db = await getDb();

  if (opts?.search) {
    const searchTerm = `%${opts.search}%`;
    return db.getAllAsync<DictionaryEntry>(
      "SELECT * FROM dictionary WHERE deleted_at IS NULL AND (key LIKE ? OR value LIKE ?) ORDER BY key ASC",
      [searchTerm, searchTerm],
    );
  }

  return db.getAllAsync<DictionaryEntry>(
    "SELECT * FROM dictionary WHERE deleted_at IS NULL ORDER BY key ASC",
  );
}

export async function getAllDictionaryEntries(): Promise<DictionaryEntry[]> {
  const db = await getDb();
  return db.getAllAsync<DictionaryEntry>(
    "SELECT * FROM dictionary WHERE deleted_at IS NULL ORDER BY length(key) DESC",
  );
}

export async function addDictionaryEntry(
  key: string,
  value: string,
): Promise<string> {
  const db = await getDb();
  const id = generateId();
  await db.runAsync(
    "INSERT INTO dictionary (id, key, value) VALUES (?, ?, ?)",
    [id, key.trim().toLowerCase(), value],
  );
  return id;
}

export async function updateDictionaryEntry(
  id: string,
  updates: { key?: string; value?: string },
): Promise<void> {
  const db = await getDb();
  const parts: string[] = ["updated_at = datetime('now')"];
  const params: (string | number)[] = [];

  if (updates.key !== undefined) {
    parts.push("key = ?");
    params.push(updates.key.trim().toLowerCase());
  }
  if (updates.value !== undefined) {
    parts.push("value = ?");
    params.push(updates.value);
  }
  params.push(id);

  await db.runAsync(
    `UPDATE dictionary SET ${parts.join(", ")} WHERE id = ?`,
    params,
  );
}

export async function deleteDictionaryEntry(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    "UPDATE dictionary SET deleted_at = datetime('now') WHERE id = ?",
    [id],
  );
}

// --- Format rules helpers ---

export interface FormatRule {
  id: string;
  app_pattern: string;
  label: string;
  instructions: string;
  is_default: number;
  created_at: string;
  updated_at: string;
}

export async function getFormatRules(): Promise<FormatRule[]> {
  const db = await getDb();
  return db.getAllAsync<FormatRule>(
    "SELECT * FROM format_rules WHERE deleted_at IS NULL ORDER BY is_default ASC, created_at DESC",
  );
}

export async function addFormatRule(rule: {
  app_pattern: string;
  label: string;
  instructions: string;
}): Promise<string> {
  const db = await getDb();
  const id = generateId();
  await db.runAsync(
    "INSERT INTO format_rules (id, app_pattern, label, instructions, is_default) VALUES (?, ?, ?, ?, 0)",
    [id, rule.app_pattern, rule.label, rule.instructions],
  );
  return id;
}

export async function updateFormatRule(
  id: string,
  updates: { app_pattern?: string; label?: string; instructions?: string },
): Promise<void> {
  const db = await getDb();
  const parts: string[] = ["updated_at = datetime('now')"];
  const params: (string | number)[] = [];

  if (updates.app_pattern !== undefined) {
    parts.push("app_pattern = ?");
    params.push(updates.app_pattern);
  }
  if (updates.label !== undefined) {
    parts.push("label = ?");
    params.push(updates.label);
  }
  if (updates.instructions !== undefined) {
    parts.push("instructions = ?");
    params.push(updates.instructions);
  }
  params.push(id);

  await db.runAsync(
    `UPDATE format_rules SET ${parts.join(", ")} WHERE id = ?`,
    params,
  );
}

export async function deleteFormatRule(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    "UPDATE format_rules SET deleted_at = datetime('now') WHERE id = ?",
    [id],
  );
}
