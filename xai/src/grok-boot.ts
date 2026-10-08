/**
 * Grok / xAI client detection + full-tier boot.
 * Fail-closed: unknown clients keep select_tier only.
 */
import type { AgentContext, AgentSession, Tier, VoT } from "./types.ts";

export type GrokHit = { hit: boolean; signal: string | null };

// Minimal parseTier/tierName copies to avoid circular imports with the core monolith.
const parseTier = (s: string, topology?: VoT): Tier | null => {
  const map: Record<string, Tier> = {
    full: { _tag: "Full" }, router: { _tag: "Router" },
    classified: { _tag: "Classified" }, minimal: { _tag: "Minimal" },
    sheaf: { _tag: "Sheaf" }, operad: { _tag: "Operad" },
    coalgebra: { _tag: "Coalgebra" }, session: { _tag: "Session" },
    petri: { _tag: "Petri" }, membrane: { _tag: "Membrane" },
    zx: { _tag: "ZX" }, topos: { _tag: "Topos" }, goi: { _tag: "GoI" },
    realizability: { _tag: "Realizability" }, choreography: { _tag: "Choreography" },
    cascade: { _tag: "Cascade" }, dytopo: { _tag: "DyTopo" },
    research: { _tag: "Research" }, auto: { _tag: "Auto" },
  };
  if (s === "emergent") return { _tag: "Emergent", topology: topology ?? "O" };
  return map[s] ?? null;
};

const tierName = (t: Tier): string =>
  t._tag === "Emergent" ? `emergent:${t.topology}` : t._tag.toLowerCase();

export function isGrokClient(req: Request, ctx: AgentContext): GrokHit {
  const h = (name: string) => (req.headers.get(name) || "").toLowerCase();
  const ua = h("user-agent");
  if (ua.includes("grok") || ua.includes("xai")) return { hit: true, signal: `user-agent:${ua.slice(0, 80)}` };
  for (const [k, v] of req.headers) {
    if (k.toLowerCase().startsWith("x-grok-") && v) return { hit: true, signal: `x-grok-*:${k}` };
  }
  if (h("x-grok-bot") || h("x-grok-agent")) return { hit: true, signal: "x-grok-*" };
  const role = h("x-agent-role") || String(ctx.role || "").toLowerCase();
  if (role === "bot" || role === "grok") return { hit: true, signal: `x-agent-role:${role}` };
  const agentId = String(ctx.agentId || "").toLowerCase();
  // Prefer explicit grok|xai in agentId — do NOT treat bare default-agent as Grok.
  if (agentId.includes("grok") || agentId.includes("xai")) return { hit: true, signal: `agentId:${ctx.agentId}` };
  return { hit: false, signal: null };
}

export function bootGrokFullTier(s: AgentSession, req: Request, clientInfoName?: string): void {
  if (s.tier != null) return;
  let hit = false;
  let signal: string | null = null;
  const name = (clientInfoName || "").toLowerCase();
  if (name.includes("grok") || name.includes("xai")) { hit = true; signal = `clientInfo.name:${clientInfoName}`; }
  else {
    const r = isGrokClient(req, s.ctx);
    hit = r.hit; signal = r.signal;
  }
  if (!hit) return;
  const tier = parseTier("full")!;
  s.tier = tier;
  s.autoTierPending = tier._tag === "Auto";
  if (!(s as any)._grokBootLogged) {
    console.log(`[grok-boot] agent=${s.ctx.agentId} signal=${signal} tier=${tierName(tier)}`);
    (s as any)._grokBootLogged = true;
  }
}
