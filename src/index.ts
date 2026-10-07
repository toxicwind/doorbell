/**
 * doorbell v7 — Bun HTTP entry on :25202
 * GET/POST/DELETE /doorbell-mcp?sessionId=  (primary)
 * GET/POST/DELETE /gemini-mcp?sessionId=   (backwards-compat alias)
 * GET /sessions, GET /health, POST /tier/seed
 * OAuth fakes preserved; SSE endpoint event then stay open.
 */
import { randomBytes } from "crypto";
import {
  detectWorkspace,
  GATEHOUSE,
  PORT,
  SESSION_TTL_MS,
  SWEEP_INTERVAL_MS,
  MAX_AGENT_SESSIONS,
  VERSION,
} from "./config.ts";
import {
  oauthAuthorizationServer,
  oauthAuthorizeRedirect,
  oauthProtectedResource,
  oauthRegister,
  oauthToken,
} from "./oauth.ts";
import { handleTierSeed, healthPayload, sessionsPayload } from "./sessions-api.ts";
import {
  deleteSession,
  ensureAgentSession,
  handleInitialize,
  handleToolsCall,
  parseAgentContext,
  sweepSessions,
  toolsListPayload,
} from "./session.ts";
import { addSink, clearStreams, endpointEvent, removeSink, type StreamSink } from "./sse.ts";
import { gfetch, getPool } from "./catalog.ts";

const cors: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS, DELETE",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, mcp-session-id, Last-Event-ID, x-agent-id, x-agent-role, x-agent-model, x-doorbell-workspace, x-grok-bot",
  "Access-Control-Expose-Headers": "mcp-session-id",
};

const server = Bun.serve({
  port: PORT,
  reusePort: true,
  async fetch(req) {
    const url = new URL(req.url);
    const path = url.pathname;

    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });

    // OAuth fakes
    if (path.includes("oauth-protected-resource"))
      return Response.json(oauthProtectedResource(), { headers: cors });
    if (path.includes("oauth-authorization-server"))
      return Response.json(oauthAuthorizationServer(), { headers: cors });
    if (path.endsWith("jwks.json")) return Response.json({ keys: [] }, { headers: cors });
    if (path.endsWith("/register"))
      return Response.json(oauthRegister(), { status: 201, headers: cors });
    if (path.endsWith("/authorize")) return oauthAuthorizeRedirect(url);
    if (path.endsWith("/token")) return Response.json(oauthToken(), { headers: cors });

    if (path.endsWith("/health") || path === "/health") {
      return Response.json(healthPayload(), { headers: cors });
    }
    if (path.endsWith("/sessions") && req.method === "GET") {
      return Response.json(sessionsPayload(), { headers: cors });
    }
    if (path.endsWith("/tier/seed") && req.method === "POST") {
      const r = await handleTierSeed(req);
      for (const [k, v] of Object.entries(cors)) r.headers.set(k, v);
      return r;
    }

    // Primary: /doorbell-mcp; compat: /gemini-mcp; also bare /mcp
    const isMcp =
      path.includes("doorbell-mcp") ||
      path.includes("gemini-mcp") ||
      path.endsWith("/mcp");
    if (isMcp) {
      const workspace = detectWorkspace(req, url);

      if (req.method === "GET") {
        server.timeout(req, 0);
        const ctx = parseAgentContext(req, url, workspace);
        const key = `${ctx.sparkSid}::${ctx.agentId}`;
        await ensureAgentSession(ctx).catch(() => {});
        const sinkId = randomBytes(4).toString("hex");
        const stream = new ReadableStream({
          start(controller) {
            const sink: StreamSink = {
              id: sinkId,
              enqueue: (c) => controller.enqueue(c),
            };
            addSink(key, sink);
            controller.enqueue(endpointEvent(url.origin, ctx.sparkSid, ctx.agentId));
          },
          cancel() {
            removeSink(key, sinkId);
          },
        });
        return new Response(stream, {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            ...cors,
          },
        });
      }

      if (req.method === "POST") {
        const ctx = parseAgentContext(req, url, workspace);
        const bodyText = await req.text();
        let body: any;
        try {
          body = JSON.parse(bodyText);
        } catch {
          return Response.json(
            { jsonrpc: "2.0", id: null, error: { code: -32700, message: "parse error" } },
            { status: 400, headers: cors },
          );
        }

        let session;
        try {
          session = await ensureAgentSession(ctx);
        } catch (e: any) {
          return Response.json(
            {
              jsonrpc: "2.0",
              id: body.id ?? null,
              error: { code: -32000, message: `gatehouse unavailable: ${e.message}` },
            },
            { status: 502, headers: cors },
          );
        }

        const method = body.method;
        const reqId = body.id ?? null;

        if (method === "server/discover") {
          return Response.json(
            {
              jsonrpc: "2.0",
              id: reqId,
              result: {
                resultType: "complete",
                supportedVersions: ["2025-11-25"],
                capabilities: { tools: { listChanged: true } },
                _meta: {
                  "io.modelcontextprotocol/serverInfo": { name: "doorbell", version: VERSION },
                },
                instructions:
                  "doorbell v7. Router dispatchers are the catalog. list_routes names upstream tools.",
                tools: [
                  { name: "call_read", description: "Dispatch to a read-only tool." },
                  { name: "call_write", description: "Dispatch to a write or read tool." },
                  { name: "call_destructive", description: "Dispatch to any tool. Requires confirm:true." },
                  { name: "list_routes", description: "List every tool on the underlying surface." },
                  { name: "route", description: "Dispatch to any tool on the underlying MCP surface." },
                ],
                ttlMs: 3600000,
                cacheScope: "public",
              },
            },
            { headers: { "mcp-session-id": ctx.sparkSid, ...cors } },
          );
        }

        let response: any;
        try {
          if (method === "initialize") {
            session.clientInfoName = body.params?.clientInfo?.name;
            response = handleInitialize(session, reqId, body.params?.protocolVersion);
          } else if (method === "tools/list") {
            response = toolsListPayload(session, reqId);
          } else if (method === "tools/call") {
            response = await handleToolsCall(session, reqId, body.params);
          } else if (method === "ping") {
            response = { jsonrpc: "2.0", id: reqId, result: {} };
          } else if (method === "notifications/initialized") {
            return new Response(null, { status: 202, headers: cors });
          } else if (method === "subscriptions/listen") {
            return Response.json(
              { jsonrpc: "2.0", id: reqId, result: { subscribed: true } },
              { headers: { "mcp-session-id": ctx.sparkSid, ...cors } },
            );
          } else {
            const { extractJson } = await import("./catalog.ts");
            const r = await gfetch(getPool(session.poolKey)?.gateSid ?? null, body);
            if (r.sid) {
              const { promotePoolGateSid } = await import("./catalog.ts");
              promotePoolGateSid(session.poolKey, r.sid);
              session.state.gateSid = r.sid;
            }
            response =
              extractJson(r.text) || {
                jsonrpc: "2.0",
                id: reqId,
                error: { code: -32601, message: `unhandled: ${method}` },
              };
          }
        } catch (e: any) {
          response = {
            jsonrpc: "2.0",
            id: reqId,
            error: { code: -32000, message: `doorbell error: ${e.message}` },
          };
        }

        return Response.json(response, {
          headers: { "mcp-session-id": ctx.sparkSid, ...cors },
        });
      }

      if (req.method === "DELETE") {
        const ctx = parseAgentContext(req, url, workspace);
        const key = `${ctx.sparkSid}::${ctx.agentId}`;
        clearStreams(key);
        await deleteSession(ctx);
        return new Response(null, { status: 204, headers: cors });
      }
    }

    return new Response("not found", { status: 404, headers: cors });
  },
});

setInterval(() => sweepSessions(SESSION_TTL_MS, MAX_AGENT_SESSIONS), SWEEP_INTERVAL_MS);

console.log(`[✓] doorbell v7 — :${PORT}`);
console.log(`    upstream: ${GATEHOUSE}`);
console.log(`    workspaces: xai/ spark/ (separate; not symlinked)`);
console.log(`    policies: I→F→D→B→A→C→G→E→H; unresolved → router`);
console.log(`    v7: first response is the router catalog`);
