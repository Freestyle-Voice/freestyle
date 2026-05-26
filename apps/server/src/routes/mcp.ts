import { StreamableHTTPTransport } from "@hono/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Hono } from "hono";
import { z } from "zod/v3";
import dictionary from "./dictionary.js";
import formats from "./formats.js";
import history from "./history.js";

async function call(
  app: Hono,
  method: string,
  path: string,
  body?: unknown,
): Promise<{ data: any; ok: boolean; status: number }> {
  const init: RequestInit = { method };
  if (body) {
    init.headers = { "Content-Type": "application/json" };
    init.body = JSON.stringify(body);
  }
  const res = await app.request(path, init);
  const data = await res.json();
  return { data, ok: res.ok, status: res.status };
}

function text(value: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }],
  };
}

function error(message: string) {
  return {
    content: [{ type: "text" as const, text: message }],
    isError: true,
  };
}

const mcpServer = new McpServer({
  name: "freestyle",
  version: "0.0.2",
});

// --- Format tools ---

mcpServer.tool(
  "format_list",
  "List formatting rules with optional search and pagination",
  {
    limit: z.number().int().min(1).max(200).default(50).describe("Max results"),
    offset: z.number().int().min(0).default(0).describe("Pagination offset"),
    search: z
      .string()
      .optional()
      .describe("Search label, pattern, or instructions"),
  },
  async ({ limit, offset, search }) => {
    const params = new URLSearchParams({
      limit: String(limit),
      offset: String(offset),
    });
    if (search) params.set("search", search);
    const { data } = await call(formats, "GET", `/?${params}`);
    return text(data);
  },
);

mcpServer.tool(
  "format_view",
  "View a single formatting rule by ID",
  { id: z.number().int().describe("Format rule ID") },
  async ({ id }) => {
    const { data } = await call(formats, "GET", "/?limit=200");
    const row = data.items?.find((r: any) => r.id === id);
    if (!row) return error(`Format rule #${id} not found`);
    return text(row);
  },
);

mcpServer.tool(
  "format_create",
  "Create a new formatting rule",
  {
    app_pattern: z
      .string()
      .describe("App pattern to match (e.g. 'slack|discord')"),
    label: z.string().describe("Display label"),
    instructions: z.string().describe("Formatting instructions for the LLM"),
  },
  async (args) => {
    const { data, ok } = await call(formats, "POST", "/", args);
    if (!ok) return error(data.error ?? "Failed to create format rule");
    return text(data);
  },
);

mcpServer.tool(
  "format_update",
  "Update an existing formatting rule",
  {
    id: z.number().int().describe("Format rule ID"),
    app_pattern: z.string().optional().describe("New app pattern"),
    label: z.string().optional().describe("New label"),
    instructions: z.string().optional().describe("New instructions"),
  },
  async ({ id, ...body }) => {
    const { data, ok } = await call(formats, "PUT", `/${id}`, body);
    if (!ok) return error(data.error ?? `Format rule #${id} not found`);
    return text({ ok: true, id });
  },
);

mcpServer.tool(
  "format_delete",
  "Delete a formatting rule",
  { id: z.number().int().describe("Format rule ID") },
  async ({ id }) => {
    await call(formats, "DELETE", `/${id}`);
    return text({ ok: true, id });
  },
);

// --- Dictionary tools ---

mcpServer.tool(
  "dict_list",
  "List dictionary entries with optional search and pagination",
  {
    limit: z.number().int().min(1).max(200).default(50).describe("Max results"),
    offset: z.number().int().min(0).default(0).describe("Pagination offset"),
    search: z.string().optional().describe("Search by key or value"),
  },
  async ({ limit, offset, search }) => {
    const params = new URLSearchParams({
      limit: String(limit),
      offset: String(offset),
    });
    if (search) params.set("search", search);
    const { data } = await call(dictionary, "GET", `/?${params}`);
    return text(data);
  },
);

mcpServer.tool(
  "dict_view",
  "View a single dictionary entry by ID",
  { id: z.number().int().describe("Dictionary entry ID") },
  async ({ id }) => {
    const { data, ok } = await call(dictionary, "GET", `/${id}`);
    if (!ok) return error(`Dictionary entry #${id} not found`);
    return text(data);
  },
);

mcpServer.tool(
  "dict_create",
  "Create a new dictionary entry (word replacement)",
  {
    key: z.string().describe("Word or phrase to match"),
    value: z.string().describe("Replacement text"),
  },
  async (args) => {
    const { data, ok } = await call(dictionary, "POST", "/", args);
    if (!ok) return error(data.error ?? "Failed to create dictionary entry");
    return text(data);
  },
);

mcpServer.tool(
  "dict_update",
  "Update an existing dictionary entry",
  {
    id: z.number().int().describe("Dictionary entry ID"),
    key: z.string().optional().describe("New key"),
    value: z.string().optional().describe("New value"),
  },
  async ({ id, ...body }) => {
    const { data, ok } = await call(dictionary, "PUT", `/${id}`, body);
    if (!ok) return error(data.error ?? `Dictionary entry #${id} not found`);
    return text(data);
  },
);

mcpServer.tool(
  "dict_delete",
  "Delete a dictionary entry",
  { id: z.number().int().describe("Dictionary entry ID") },
  async ({ id }) => {
    await call(dictionary, "DELETE", `/${id}`);
    return text({ ok: true, id });
  },
);

// --- History tools ---

mcpServer.tool(
  "history_list",
  "List transcription history with optional search and pagination",
  {
    limit: z.number().int().min(1).max(200).default(20).describe("Max results"),
    offset: z.number().int().min(0).default(0).describe("Pagination offset"),
    search: z
      .string()
      .optional()
      .describe("Search transcription text or model"),
  },
  async ({ limit, offset, search }) => {
    const params = new URLSearchParams({
      limit: String(limit),
      offset: String(offset),
    });
    if (search) params.set("search", search);
    const { data } = await call(history, "GET", `/?${params}`);
    return text(data);
  },
);

mcpServer.tool(
  "history_stats",
  "Get transcription usage statistics",
  {},
  async () => {
    const { data } = await call(history, "GET", "/stats");
    return text(data);
  },
);

const transport = new StreamableHTTPTransport();

const mcp = new Hono().all("/", async (c) => {
  if (!mcpServer.isConnected()) {
    await mcpServer.connect(transport);
  }
  const response = await transport.handleRequest(c);
  return response ?? c.body(null, 204);
});

export default mcp;
