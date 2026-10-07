/** GET /sessions, POST /tier/seed, GET /health helpers */
import { GATEHOUSE, parseTier, VERSION, type WorkspaceId } from "./config.ts";
import { KEY } from "./config.ts";
import { enabledPolicyNames } from "./policies.ts";
import { loadWorkspaceConfig } from "./config.ts";
import { applySeed, listSessions, sessionCount } from "./session.ts";
import { allPoolEntries } from "./catalog.ts";

export function healthPayload() {
  return {
    ok: true,
    service: "doorbell",
    version: VERSION,
    gatehouse: GATEHOUSE,
    hasKey: Boolean(KEY),
    agentSessions: sessionCount(),
    poolEntries: allPoolEntries().length,
    policies: {
      xai: enabledPolicyNames("xai", loadWorkspaceConfig("xai")),
      spark: enabledPolicyNames("spark", loadWorkspaceConfig("spark")),
    },
  };
}

export function sessionsPayload() {
  return {
    sessions: listSessions(),
    count: sessionCount(),
  };
}

export async function handleTierSeed(req: Request): Promise<Response> {
  let body: any = {};
  try {
    body = await req.json();
  } catch {}
  const tier = parseTier(String(body.tier || ""));
  if (!tier) {
    return Response.json({ error: "tier required (full|router|classified|minimal|auto)" }, { status: 400 });
  }
  const sessionId = String(body.sessionId || body.session_id || "default");
  const agentId = String(body.agentId || body.agent_id || "default-agent");
  const workspace = (String(body.workspace || "xai").toLowerCase() === "spark" ? "spark" : "xai") as WorkspaceId;
  const snap = await applySeed(sessionId, agentId, tier, workspace);
  return Response.json({ ok: true, session: snap });
}
