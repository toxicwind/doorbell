/** Per-agent session state, policy resolve, tools/list + tools/call. */
import { randomBytes } from "crypto";
import {
  loadWorkspaceConfig,
  parseTier,
  type TierName,
  type TierSource,
  type WorkspaceConfig,
  type WorkspaceId,
  VERSION,
} from "./config.ts";
import {
  acquirePoolEntry,
  classifyTool,
  extractJson,
  gfetch,
  getPool,
  poolKeyFor,
  promotePoolGateSid,
  releasePoolEntry,
  type McpTool,
} from "./catalog.ts";
import {
  broadcastListChanged,
  promoteGateSid,
  setTier,
  type Env,
  type MutableState,
  type SessionSnapshot,
} from "./effects.ts";
import {
  applyOnCallOverride,
  initialSetTierEffect,
  resolvePolicies,
  runAfterResolve,
  type PolicyCtx,
} from "./policies.ts";
import { demoteIfExpired } from "./policies/ephemeral-ttl.ts";
import { noteFleetTier } from "./policies/fleet-quota.ts";
import { resolveSurface } from "./surfaces.ts";
import { broadcast, listChangedNotification } from "./sse.ts";

export interface AgentContext {
  sparkSid: string;
  agentId: string;
  role: string;
  modelTier: string;
  credentialFingerprint: string;
  workspace: WorkspaceId;
}

export interface AgentSession {
  ctx: AgentContext;
  config: WorkspaceConfig;
  profile: string;
  catalog: McpTool[];
  poolKey: string;
  createdAt: number;
  state: MutableState;
  clientInfoName?: string;
  seedTier: TierName | null;
  initResponse: unknown;
}

const agentSessions = new Map<string, AgentSession>();

export const agentKey = (ctx: AgentContext) => `${ctx.sparkSid}::${ctx.agentId}`;

function freshState(): MutableState {
  return {
    tier: null,
    tierSource: "unknown",
    exposeSelectTier: false,
    autoTierPending: false,
    gateSid: null,
    lastUsed: Date.now(),
    ephemeralExpiresAt: null,
    pendingBroadcast: false,
  };
}

function policyCtx(s: AgentSession): PolicyCtx {
  return {
    workspace: s.ctx.workspace,
    config: s.config,
    agentId: s.ctx.agentId,
    role: s.ctx.role,
    clientInfoName: s.clientInfoName,
    catalog: s.catalog,
    currentTier: s.state.tier,
    tierSource: s.state.tierSource,
    seedTier: s.seedTier,
  };
}

function envOf(s: AgentSession): Env {
  return { workspace: s.ctx.workspace, now: () => Date.now() };
}

async function interpret(s: AgentSession, eff: { run: (e: Env, st: MutableState) => Promise<{ state: MutableState; value: unknown }> }) {
  const prevTier = s.state.tier;
  const r = await eff.run(envOf(s), s.state);
  s.state = r.state;
  if (s.state.gateSid) promotePoolGateSid(s.poolKey, s.state.gateSid);
  if (s.state.tier !== prevTier) noteFleetTier(s.state.tier, prevTier);
  if (s.state.pendingBroadcast) {
    s.state.pendingBroadcast = false;
    await broadcast(agentKey(s.ctx), listChangedNotification());
  }
  return r.value;
}

export async function ensureAgentSession(ctx: AgentContext): Promise<AgentSession> {
  const key = agentKey(ctx);
  const existing = agentSessions.get(key);
  if (existing) {
    existing.state.lastUsed = Date.now();
    return existing;
  }

  const config = loadWorkspaceConfig(ctx.workspace);
  const entry = await acquirePoolEntry(ctx.credentialFingerprint, ctx.agentId, ctx.role);
  const s: AgentSession = {
    ctx,
    config,
    profile: config.profile,
    catalog: entry.catalog,
    poolKey: poolKeyFor(ctx.credentialFingerprint),
    createdAt: Date.now(),
    state: { ...freshState(), gateSid: entry.gateSid },
    seedTier: null,
    initResponse: entry.initResponse,
  };

  const res = resolvePolicies(policyCtx(s));
  s.state.exposeSelectTier = res.exposeSelectTier;
  await interpret(s, initialSetTierEffect(res));
  if (s.state.tier === "full" || s.state.tier === "classified") {
    s.state.ephemeralExpiresAt = Date.now() + config.ephemeralTtlMs;
  }
  await interpret(s, runAfterResolve(policyCtx(s), s.state.tier!, res.after));

  agentSessions.set(key, s);
  return s;
}

export async function applySeed(sessionId: string, agentId: string, tier: TierName, workspace: WorkspaceId) {
  const key = `${sessionId}::${agentId}`;
  let s = agentSessions.get(key);
  if (!s) {
    s = await ensureAgentSession({
      sparkSid: sessionId,
      agentId,
      role: "implementer",
      modelTier: "sonnet",
      credentialFingerprint: "seed",
      workspace,
    });
  }
  s.seedTier = tier;
  s.config = { ...s.config, policies: { ...s.config.policies, OperatorSeed: true } };
  await interpret(s, setTier(tier, "tier/seed"));
  if (tier === "full" || tier === "classified") {
    s.state.ephemeralExpiresAt = Date.now() + s.config.ephemeralTtlMs;
  }
  return snapshotSession(s);
}

async function maybeDemote(s: AgentSession) {
  const dem = demoteIfExpired(s.state.tier, s.state.ephemeralExpiresAt, Date.now());
  if (dem) {
    await interpret(s, dem);
    s.state.ephemeralExpiresAt = null;
  }
}

export function toolsListPayload(s: AgentSession, reqId: any) {
  // Snapshot state for each tools/list
  const snap = snapshotSession(s);
  const tools = resolveSurface({
    tier: s.state.tier,
    exposeSelectTier: s.state.exposeSelectTier,
    catalog: s.catalog,
    includeRequestUpgrade: s.config.policies.Justification === true,
  });
  return {
    jsonrpc: "2.0",
    id: reqId,
    result: {
      resultType: "complete",
      tools,
      ttlMs: 300000,
      cacheScope: "private",
      _doorbell: {
        tier: snap.tier,
        tierSource: snap.tierSource,
        workspace: snap.workspace,
        exposeSelectTier: snap.exposeSelectTier,
      },
    },
  };
}

function ok(reqId: any, text: string) {
  return {
    jsonrpc: "2.0",
    id: reqId,
    result: { resultType: "complete", content: [{ type: "text", text }] },
  };
}
function refuse(reqId: any, msg: string) {
  return {
    jsonrpc: "2.0",
    id: reqId,
    result: { content: [{ type: "text", text: `refused: ${msg}` }], isError: true },
  };
}

export async function handleToolsCall(s: AgentSession, reqId: any, params: any): Promise<any> {
  await maybeDemote(s);
  const name = params?.name;
  const args = params?.arguments || {};
  const key = agentKey(s.ctx);

  const override = applyOnCallOverride(policyCtx(s), name, args);
  if (override) {
    await interpret(s, setTier(override.tier, override.source));
    if (override.tier === "full" || override.tier === "classified") {
      s.state.ephemeralExpiresAt = Date.now() + s.config.ephemeralTtlMs;
    }
  }

  if (name === "select_tier") {
    const requested = parseTier(String(args.tier || ""));
    if (!requested) return ok(reqId, `unknown tier: ${args.tier}`);
    const finalTier = override?.tier ?? requested;
    await interpret(s, setTier(finalTier, override ? override.source : "select_tier"));
    if (finalTier === "full" || finalTier === "classified") {
      s.state.ephemeralExpiresAt = Date.now() + s.config.ephemeralTtlMs;
    } else {
      s.state.ephemeralExpiresAt = null;
    }
    const names = resolveSurface({
      tier: s.state.tier,
      exposeSelectTier: s.state.exposeSelectTier,
      catalog: s.catalog,
      includeRequestUpgrade: s.config.policies.Justification === true,
    }).map((t) => t.name).join(", ");
    return ok(reqId, `Tier "${s.state.tier}" set for agent ${s.ctx.agentId} (source=${s.state.tierSource}). Surface: ${names || "(empty)"}.`);
  }

  if (name === "request_upgrade") {
    if (s.config.policies.Justification !== true) {
      return refuse(reqId, "JustificationPolicy disabled");
    }
    if (!override) return refuse(reqId, "upgrade rejected (need target_tier + reason≥8 chars)");
    return ok(reqId, `upgraded to ${s.state.tier} via JustificationPolicy`);
  }

  if (name === "list_routes") {
    const routes = s.catalog.map((t) => ({
      name: t.name,
      description: t.description,
      class: classifyTool(t),
    }));
    return ok(reqId, JSON.stringify(routes, null, 2));
  }

  const isDispatcher = /^(route|call_(read|write|destructive))$/.test(String(name));
  if (isDispatcher) {
    const target = String(args.tool || "");
    const targetTool = s.catalog.find((t) => t.name === target);
    if (!targetTool) return refuse(reqId, `unknown target: ${target}`);
    const cls = classifyTool(targetTool);
    if (name === "call_read" && cls !== "read") return refuse(reqId, `${target} is ${cls}`);
    if (name === "call_write" && (cls === "destructive" || cls === "admin"))
      return refuse(reqId, `${target} is ${cls}`);
    if (name === "call_destructive" && args.confirm !== true)
      return refuse(reqId, `confirm:true required`);
    const cleanArgs = { ...(args.args || {}) };
    delete cleanArgs.confirm;
    const r = await gfetch(getPool(s.poolKey)?.gateSid ?? s.state.gateSid, {
      jsonrpc: "2.0",
      id: reqId,
      method: "tools/call",
      params: { name: target, arguments: cleanArgs },
    });
    if (r.sid) {
      await interpret(s, promoteGateSid(r.sid));
      promotePoolGateSid(s.poolKey, r.sid);
    }
    return extractJson(r.text) || ok(reqId, r.text);
  }

  // auto lock-in on first real call
  if (s.state.autoTierPending && s.state.tier === "auto") {
    const t = s.catalog.find((x) => x.name === name);
    const cls = t ? classifyTool(t) : "write";
    const next: TierName = cls === "read" ? "minimal" : "router";
    await interpret(s, setTier(next, "AgentPick"));
  }

  // tier gate for direct catalog calls
  if (s.state.tier === "minimal") {
    const t = s.catalog.find((x) => x.name === name);
    if (t && classifyTool(t) !== "read") return refuse(reqId, `${name} is not read-only`);
  }
  if (s.state.tier === "router" || s.state.tier === "classified") {
    // direct catalog tools not on surface — must use dispatchers
    if (s.catalog.some((t) => t.name === name)) {
      return refuse(reqId, `use route/call_* dispatchers on ${s.state.tier} tier`);
    }
  }

  const r = await gfetch(getPool(s.poolKey)?.gateSid ?? s.state.gateSid, {
    jsonrpc: "2.0",
    id: reqId,
    method: "tools/call",
    params: { name, arguments: args },
  });
  if (r.sid) {
    await interpret(s, promoteGateSid(r.sid));
    promotePoolGateSid(s.poolKey, r.sid);
  }
  return extractJson(r.text) || ok(reqId, r.text);
}

export function handleInitialize(s: AgentSession, reqId: any, requested?: string): any {
  if (requested === "2026-07-28") {
    return {
      jsonrpc: "2.0",
      id: reqId,
      error: {
        code: -32602,
        message: "UnsupportedProtocolVersionError",
        data: { supported: ["2025-11-25"] },
      },
    };
  }
  return {
    jsonrpc: "2.0",
    id: reqId,
    result: {
      protocolVersion: "2025-11-25",
      capabilities: { tools: { listChanged: true } },
      serverInfo: { name: "doorbell", version: VERSION },
      instructions:
        "doorbell v7. Router dispatchers are the catalog. list_routes names upstream tools. " +
        "Unresolved policies are router. select_tier is optional.",
      tools: resolveSurface({
        tier: s.state.tier ?? "router",
        exposeSelectTier: false,
        catalog: s.catalog,
      }),
    },
  };
}

export function snapshotSession(s: AgentSession): SessionSnapshot {
  return {
    sessionId: s.ctx.sparkSid,
    agentId: s.ctx.agentId,
    workspace: s.ctx.workspace,
    profile: s.profile,
    tier: s.state.tier,
    tierSource: s.state.tierSource,
    exposeSelectTier: s.state.exposeSelectTier,
    autoTierPending: s.state.autoTierPending,
    gateSid: s.state.gateSid ?? getPool(s.poolKey)?.gateSid ?? null,
    catalogCount: s.catalog.length,
    createdAt: s.createdAt,
    lastUsed: s.state.lastUsed,
    ephemeralExpiresAt: s.state.ephemeralExpiresAt,
  };
}

export function listSessions() {
  return [...agentSessions.values()].map(snapshotSession);
}

export async function deleteSession(ctx: AgentContext) {
  const key = agentKey(ctx);
  agentSessions.delete(key);
  await releasePoolEntry(ctx.credentialFingerprint);
}

export function sessionCount() {
  return agentSessions.size;
}

export function sweepSessions(ttlMs: number, max: number) {
  const now = Date.now();
  for (const [k, s] of agentSessions) {
    if (now - s.state.lastUsed > ttlMs) {
      agentSessions.delete(k);
      releasePoolEntry(s.ctx.credentialFingerprint).catch(() => {});
    }
  }
  if (agentSessions.size > max) {
    const sorted = [...agentSessions.entries()].sort(
      (a, b) => a[1].state.lastUsed - b[1].state.lastUsed,
    );
    for (let i = 0; i < sorted.length - max; i++) {
      agentSessions.delete(sorted[i][0]);
      releasePoolEntry(sorted[i][1].ctx.credentialFingerprint).catch(() => {});
    }
  }
}

export function parseAgentContext(req: Request, url: URL, workspace: WorkspaceId): AgentContext {
  const sparkSid =
    url.searchParams.get("sessionId") || req.headers.get("mcp-session-id") || "default";
  const agentId =
    req.headers.get("x-agent-id") || url.searchParams.get("agentId") || "default-agent";
  const role = req.headers.get("x-agent-role") || url.searchParams.get("role") || "implementer";
  const modelTier =
    req.headers.get("x-agent-model") || url.searchParams.get("model") || "sonnet";
  const credentialFingerprint =
    req.headers.get("authorization") || "shared-default-credential";
  return { sparkSid, agentId, role, modelTier, credentialFingerprint, workspace };
}
