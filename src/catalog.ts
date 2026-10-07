/** Gatehouse catalog fetch + classification. Catalog is truth; tiers are views. */
import { randomBytes } from "crypto";
import { GATEHOUSE, KEY, VERSION, type ToolClass } from "./config.ts";

export interface McpTool {
  name: string;
  description?: string;
  inputSchema?: unknown;
  annotations?: Record<string, unknown>;
  [k: string]: unknown;
}

export interface GFetchResult {
  text: string;
  sid: string | null;
  status: number;
}

export async function gfetch(
  sid: string | null,
  body: unknown,
  endpoint: string = GATEHOUSE,
  bearer: string = KEY,
): Promise<GFetchResult> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json, text/event-stream",
  };
  if (bearer) headers.Authorization = `Bearer ${bearer}`;
  if (sid) headers["mcp-session-id"] = sid;
  const r = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const newSid = r.headers.get("mcp-session-id") || sid;
  const text = await r.text();
  return { text, sid: newSid, status: r.status };
}

export function extractJson(text: string): any {
  if (!text) return null;
  const trimmed = text.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("{")) {
    try {
      return JSON.parse(trimmed);
    } catch {}
  }
  const lines = trimmed.split("\n");
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].trim();
    if (!line.startsWith("data:")) continue;
    const payload = line.slice(5).trim();
    if (!payload) continue;
    try {
      return JSON.parse(payload);
    } catch {}
  }
  const s = trimmed.indexOf("{");
  const e = trimmed.lastIndexOf("}");
  if (s >= 0 && e > s) {
    try {
      return JSON.parse(trimmed.slice(s, e + 1));
    } catch {}
  }
  return null;
}

const DESTRUCTIVE_RE =
  /(delete|destroy|kill|drop|purge|remove|wipe|terminate|format|reset|uninstall)/i;
const WRITE_RE =
  /(create|write|update|set|put|push|post|add|insert|patch|apply|run|execute|invoke|submit|start|stop|restart|deploy)/i;
const ADMIN_RE = /(admin|config|grant|revoke|rotate|policy|secret|credential)/i;

export function classifyTool(t: McpTool): ToolClass {
  const a = t.annotations || {};
  if (a.destructiveHint === true) return "destructive";
  if (a.readOnlyHint === true) return "read";
  const n = String(t.name || "");
  if (ADMIN_RE.test(n)) return "admin";
  if (DESTRUCTIVE_RE.test(n)) return "destructive";
  if (WRITE_RE.test(n)) return "write";
  return "read";
}

export const isReadOnly = (t: McpTool) => classifyTool(t) === "read";

export interface PoolEntry {
  gateSid: string;
  refcount: number;
  fingerprint: string;
  catalog: McpTool[];
  initResponse: unknown;
}

const pool = new Map<string, PoolEntry>();

export function poolKeyFor(fingerprint: string) {
  return `pool:${fingerprint}`;
}

export function getPool(key: string) {
  return pool.get(key);
}

export function allPoolEntries() {
  return [...pool.entries()];
}

export async function acquirePoolEntry(
  fingerprint: string,
  agentId: string,
  role: string,
): Promise<PoolEntry> {
  const key = poolKeyFor(fingerprint);
  const existing = pool.get(key);
  if (existing) {
    existing.refcount++;
    return existing;
  }

  const initBody = {
    jsonrpc: "2.0",
    id: 0,
    method: "initialize",
    params: {
      protocolVersion: "2025-11-25",
      capabilities: {},
      clientInfo: { name: "doorbell", version: VERSION, agentId, role },
    },
  };
  const init = await gfetch(null, initBody);
  const initParsed = extractJson(init.text);
  // Atomic gateSid promotion from first response
  const gateSid = init.sid || `gs_${randomBytes(4).toString("hex")}`;
  const list = await gfetch(gateSid, {
    jsonrpc: "2.0",
    id: 1,
    method: "tools/list",
    params: {},
  });
  const listParsed = extractJson(list.text);
  const catalog: McpTool[] = listParsed?.result?.tools || [];
  const promotedSid = list.sid || gateSid;

  const entry: PoolEntry = {
    gateSid: promotedSid,
    refcount: 1,
    fingerprint,
    catalog,
    initResponse: initParsed || {
      jsonrpc: "2.0",
      id: 0,
      result: {
        protocolVersion: "2025-11-25",
        capabilities: { tools: { listChanged: true } },
        serverInfo: { name: "doorbell", version: VERSION },
      },
    },
  };
  pool.set(key, entry);
  return entry;
}

export async function releasePoolEntry(fingerprint: string) {
  const key = poolKeyFor(fingerprint);
  const entry = pool.get(key);
  if (!entry) return;
  entry.refcount--;
  if (entry.refcount <= 0) pool.delete(key);
}

export function promotePoolGateSid(poolKey: string, sid: string | null) {
  if (!sid) return;
  const entry = pool.get(poolKey);
  if (entry) entry.gateSid = sid;
}
