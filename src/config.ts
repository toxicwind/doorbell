/** Runtime config — secrets from env / ~/.secrets only; never hardcode keys. */
import { existsSync, readFileSync } from "fs";
import { join } from "path";

export type WorkspaceId = "xai" | "spark";
export type TierName = "full" | "router" | "classified" | "minimal" | "auto";
export type ToolClass = "read" | "write" | "destructive" | "admin";
export type TierSource =
  | "WorkspaceDefined"
  | "WorkspacePinned"
  | "ContextHeuristic"
  | "OperatorSeed"
  | "AgentPick"
  | "AgentRenegotiate"
  | "Justification"
  | "FleetQuota"
  | "EphemeralTTL"
  | "fallback-router"
  | "select_tier"
  | "tier/seed"
  | "unknown";

export const PORT = parseInt(process.env.MONAD_PORT || "25202", 10);
export const GATEHOUSE = process.env.GATEHOUSE_URL || "http://127.0.0.1:25127/mcp";
export const ISSUER = process.env.PUBLIC_ISSUER || "https://github-mcp-host.tailc9ac71.ts.net";
export const DOORBELL_ROOT =
  process.env.DOORBELL_ROOT ||
  (existsSync("/home/toxic/estate/ranch/doorbell")
    ? "/home/toxic/estate/ranch/doorbell"
    : new URL("..", import.meta.url).pathname);

export const SESSION_TTL_MS = 60 * 60 * 1000;
export const SWEEP_INTERVAL_MS = 5 * 60 * 1000;
export const MAX_AGENT_SESSIONS = 500;
export const VERSION = "7.0.0";

function loadKeyFromSecrets(): string {
  const candidates = [
    process.env.HOME ? join(process.env.HOME, ".secrets") : "",
    "/home/toxic/.secrets",
  ].filter(Boolean);
  for (const p of candidates) {
    try {
      if (!existsSync(p)) continue;
      const raw = readFileSync(p, "utf8");
      const m =
        raw.match(/MCPPROXY_API_KEY\s*[=:]\s*["']?([A-Za-z0-9_-]+)/) ||
        raw.match(/"MCPPROXY_API_KEY"\s*:\s*"([^"]+)"/);
      if (m?.[1]) return m[1];
    } catch {}
  }
  return "";
}

export const KEY = process.env.MCPPROXY_API_KEY || loadKeyFromSecrets();

export const TIER_NAMES: TierName[] = ["full", "router", "classified", "minimal", "auto"];

export function parseTier(s: string): TierName | null {
  const t = String(s || "").toLowerCase() as TierName;
  return TIER_NAMES.includes(t) ? t : null;
}

export interface WorkspaceConfig {
  workspace: WorkspaceId;
  policies: Record<string, boolean>;
  pinnedTier: TierName | null;
  ephemeralTtlMs: number;
  defaultTier: TierName | null;
  profile: string;
}

const DEFAULT_POLICIES: Record<string, boolean> = {
  WorkspaceDefined: true,
  WorkspacePinned: true,
  ContextHeuristic: true,
  OperatorSeed: false,
  AgentPick: true,
  AgentRenegotiate: false,
  Justification: false,
  FleetQuota: false,
  EphemeralTTL: true,
};

export function loadWorkspaceConfig(ws: WorkspaceId): WorkspaceConfig {
  const base = join(DOORBELL_ROOT, ws, ".doorbell");
  let cfg: any = {};
  let wsp: any = {};
  try {
    cfg = JSON.parse(readFileSync(join(base, "config.json"), "utf8"));
  } catch {}
  try {
    wsp = JSON.parse(readFileSync(join(base, "workspace.json"), "utf8"));
  } catch {}
  const seedEnv = process.env.DOORBELL_SEED_TIER;
  const policies = { ...DEFAULT_POLICIES, ...(cfg.policies || {}) };
  if (seedEnv) policies.OperatorSeed = true;
  return {
    workspace: ws,
    policies,
    pinnedTier: parseTier(cfg.pinnedTier) ?? null,
    ephemeralTtlMs: Number(cfg.ephemeralTtlMs) || 900_000,
    defaultTier: parseTier(wsp.default_tier) ?? null,
    profile: String(wsp.profile || ws),
  };
}

export function detectWorkspace(req: Request, url: URL): WorkspaceId {
  const h = (req.headers.get("x-doorbell-workspace") || "").toLowerCase();
  if (h === "spark" || h === "xai") return h;
  const q = (url.searchParams.get("workspace") || "").toLowerCase();
  if (q === "spark" || q === "xai") return q;
  const env = (process.env.DOORBELL_WORKSPACE || "").toLowerCase();
  if (env === "spark" || env === "xai") return env;
  const ua = (req.headers.get("user-agent") || "").toLowerCase();
  if (ua.includes("grok") || ua.includes("xai")) return "xai";
  return "xai";
}
