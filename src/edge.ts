/**
 * Protocol edge on EDGE_PORT (default 25202) → monad MONAD_URL (default :25204).
 * Thin reverse proxy; estate symlink target for gemini-mcp-hono.ts.
 */
const EDGE_PORT = parseInt(process.env.EDGE_PORT || "25202", 10);
const MONAD = (process.env.MONAD_URL || "http://127.0.0.1:25204").replace(/\/$/, "");

const HOP = [
  "x-agent-id",
  "x-agent-role",
  "x-agent-model",
  "authorization",
  "mcp-session-id",
  "x-doorbell-workspace",
  "x-grok-bot",
  "content-type",
  "accept",
  "last-event-id",
];

async function proxy(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const target = new URL(url.pathname + url.search, MONAD);
  const headers = new Headers();
  for (const h of HOP) {
    const v = req.headers.get(h);
    if (v) headers.set(h, v);
  }
  const init: RequestInit = { method: req.method, headers };
  if (req.method !== "GET" && req.method !== "HEAD") {
    init.body = req.body;
    // @ts-expect-error bun duplex
    init.duplex = "half";
  }
  const up = await fetch(target, init);
  const out = new Headers(up.headers);
  out.set("Access-Control-Allow-Origin", "*");
  out.set(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, mcp-session-id, Last-Event-ID, x-agent-id, x-agent-role, x-agent-model, x-doorbell-workspace, x-grok-bot",
  );
  out.set("Access-Control-Expose-Headers", "mcp-session-id");
  return new Response(up.body, { status: up.status, headers: out });
}

Bun.serve({
  port: EDGE_PORT,
  reusePort: true,
  async fetch(req) {
    if (req.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS, DELETE",
          "Access-Control-Allow-Headers":
            "Content-Type, Authorization, mcp-session-id, Last-Event-ID, x-agent-id, x-agent-role, x-agent-model, x-doorbell-workspace, x-grok-bot",
        },
      });
    }
    try {
      return await proxy(req);
    } catch (e: any) {
      return Response.json(
        { ok: false, error: `edge→monad: ${e?.message || e}`, monad: MONAD },
        { status: 502 },
      );
    }
  },
});

console.log(`[edge] doorbell proxy :${EDGE_PORT} → ${MONAD}`);
