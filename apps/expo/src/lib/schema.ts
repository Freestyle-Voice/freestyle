import type { SQLiteDatabase } from "expo-sqlite";

const SCHEMA_VERSION = 1;

const DEFAULT_FORMAT_RULES = [
  {
    pattern: "mail.google.com|outlook|yahoo.com|proton",
    label: "Email",
    instructions:
      "Format as a proper email body: use greeting if dictated, clear paragraphs separated by blank lines, professional tone, sign-off if dictated. No subject line.",
  },
  {
    pattern: "slack.com|Slack",
    label: "Slack",
    instructions: "Conversational, concise, professional. Casual punctuation.",
  },
  {
    pattern: "discord.com|Discord",
    label: "Discord",
    instructions: "Casual and conversational tone.",
  },
  {
    pattern: "github.com|GitLab",
    label: "Code Platform",
    instructions: "Clear, technical, well-structured with markdown.",
  },
  {
    pattern: "docs.google.com|notion.so|Notion",
    label: "Document",
    instructions:
      "Proper document formatting with clear paragraphs and structure.",
  },
  {
    pattern: "Code|Cursor|Terminal|iTerm",
    label: "Code Editor",
    instructions:
      "Clean prose for code comments, commits, or documentation. Preserve technical terms.",
  },
  {
    pattern: "Messages|WhatsApp|Telegram",
    label: "Messaging",
    instructions: "Casual and brief, like a text message.",
  },
  {
    pattern: "x.com|twitter.com",
    label: "X/Twitter",
    instructions: "Concise (280 chars ideal), punchy, and direct.",
  },
  {
    pattern: "linkedin.com",
    label: "LinkedIn",
    instructions: "Professional and well-structured.",
  },
  {
    pattern: "chatgpt.com|claude.ai|perplexity",
    label: "AI Chat",
    instructions: "Clear, well-structured prompt or message.",
  },
];

export async function initSchema(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS schema_version (
      id INTEGER PRIMARY KEY CHECK(id = 1),
      version INTEGER NOT NULL
    )
  `);

  const row = await db.getFirstAsync<{ version: number }>(
    "SELECT version FROM schema_version WHERE id = 1",
  );
  const currentVersion = row?.version ?? 0;

  if (currentVersion < 1) {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        deleted_at TEXT
      );

      CREATE TABLE IF NOT EXISTS model_configs (
        id TEXT PRIMARY KEY,
        provider TEXT NOT NULL,
        model_id TEXT NOT NULL,
        model_name TEXT NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('voice', 'llm')),
        is_default INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        deleted_at TEXT,
        synced_at TEXT,
        UNIQUE(provider, model_id, type)
      );

      CREATE TABLE IF NOT EXISTS transcription_history (
        id TEXT PRIMARY KEY,
        raw_text TEXT NOT NULL,
        cleaned_text TEXT,
        voice_provider TEXT NOT NULL,
        voice_model TEXT NOT NULL,
        llm_provider TEXT,
        llm_model TEXT,
        duration_ms INTEGER NOT NULL DEFAULT 0,
        audio_duration_ms INTEGER NOT NULL DEFAULT 0,
        input_tokens INTEGER NOT NULL DEFAULT 0,
        output_tokens INTEGER NOT NULL DEFAULT 0,
        cost_usd REAL NOT NULL DEFAULT 0,
        device_id TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        deleted_at TEXT,
        synced_at TEXT
      );

      CREATE TABLE IF NOT EXISTS dictionary (
        id TEXT PRIMARY KEY,
        key TEXT NOT NULL UNIQUE,
        value TEXT NOT NULL,
        usage_count INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        deleted_at TEXT,
        synced_at TEXT
      );

      CREATE TABLE IF NOT EXISTS format_rules (
        id TEXT PRIMARY KEY,
        app_pattern TEXT NOT NULL,
        label TEXT NOT NULL,
        instructions TEXT NOT NULL,
        is_default INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        deleted_at TEXT,
        synced_at TEXT
      );
    `);

    const count = await db.getFirstAsync<{ c: number }>(
      "SELECT COUNT(*) as c FROM format_rules",
    );
    if ((count?.c ?? 0) === 0) {
      for (const rule of DEFAULT_FORMAT_RULES) {
        const id = generateSimpleId();
        await db.runAsync(
          "INSERT INTO format_rules (id, app_pattern, label, instructions, is_default) VALUES (?, ?, ?, ?, 1)",
          [id, rule.pattern, rule.label, rule.instructions],
        );
      }
    }
  }

  await db.execAsync(`
    INSERT INTO schema_version (id, version) VALUES (1, ${SCHEMA_VERSION})
    ON CONFLICT(id) DO UPDATE SET version = ${SCHEMA_VERSION}
  `);
}

function generateSimpleId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `${timestamp}-${random}`;
}
