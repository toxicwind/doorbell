/**
 * doorbell OAuth compat edge — public funnel terminator for the estate host.
 *
 * The upstream doorbell v7 (:25202) is loopback-trusted and performs no auth.
 * This edge is what tailscale funnel exposes on 443: MCP-spec OAuth
 * (discovery, DCR, client_credentials + authorization_code with bound,
 * single-use codes) issuing HMAC-signed bearer tokens, and a deny-by-default
 * bearer gate on every non-OAuth path, proxying authenticated traffic to the
 * upstream. Secrets never leave this process; nothing is printed.
 */
import { createHash, createHmac, randomBytes, timingSafeEqual } from "crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";

const PORT = parseInt(process.env.OAUTH_EDGE_PORT || "25217", 10);
const UPSTREAM = (process.env.DOORBELL_UPSTREAM || "http://127.0.0.1:25202").replace(/\/$/, "");
const ISSUER = (process.env.PUBLIC_ISSUER || "").replace(/\/$/, "");
const DATA_DIR = process.env.DOORBELL_EDGE_DATA || join(import.meta.dir, "..", "data");
const TOKEN_TTL = 86400;
const CODE_TTL_MS = 600_000;
const SQUAWK_WS_UPSTREAM = (process.env.SQUAWK_WS_UPSTREAM || "ws://127.0.0.1:25147").replace(/\/$/, "");
const EXEC_WS_UPSTREAM = (process.env.EXEC_WS_UPSTREAM || "ws://127.0.0.1:25204").replace(/\/$/, "");

function loadKeyFromSecrets(): string {
  const candidates = [
    process.env.HOME ? join(process.env.HOME, ".secrets") : "",
    "/home/toxic/.secrets",
  ].filter(Boolean);
  for (const p of candidates) {
    try {
      if (!existsSync(p)) continue;
      const m = readFileSync(p, "utf8").match(/MCPPROXY_API_KEY\s*[=:]\s*["']?([A-Za-z0-9_-]+)/);
      if (m?.[1]) return m[1];
    } catch {}
  }
  return "";
}

const AUTH_SECRET =
  process.env.DOORBELL_AUTH_SECRET ||
  process.env.MCPPROXY_API_KEY ||
  loadKeyFromSecrets() ||
  randomBytes(32).toString("hex");

const cors: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS, DELETE",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, mcp-session-id, Last-Event-ID, x-agent-id, x-agent-role, x-agent-model, x-doorbell-workspace, x-grok-bot",
  "Access-Control-Expose-Headers": "mcp-session-id",
};

function json(body: unknown, status = 200, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...cors, ...extra } });
}

function hmac(input: string) {
  return createHmac("sha256", AUTH_SECRET).update(input).digest("hex");
}

function signToken(ttl = TOKEN_TTL) {
  const exp = Math.floor(Date.now() / 1000) + ttl;
  const body = exp.toString(16);
  return { access_token: `tok_${body}.${hmac(`doorbell:v1:${body}`)}`, token_type: "Bearer", expires_in: ttl };
}

function bearerToken(req: Request): string | null {
  const m = /^Bearer\s+(\S+)$/i.exec(req.headers.get("authorization") || "");
  return m ? m[1] : null;
}

function verifyBearer(req: Request): boolean {
  const tok = bearerToken(req);
  if (!tok) return false;
  const mm = /^tok_([0-9a-f]+)\.([0-9a-f]{64})$/.exec(tok);
  if (!mm) return false;
  const exp = parseInt(mm[1], 16);
  if (!Number.isFinite(exp) || exp * 1000 <= Date.now()) return false;
  const want = hmac(`doorbell:v1:${mm[1]}`);
  return ctEq(mm[2], want);
}

function ctEq(a: string, b: string): boolean {
  return a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

function sha(v: string): string {
  return createHash("sha256").update(v).digest("hex");
}

// ---- registered clients (persisted; secrets stored hashed) ----
type Client = { client_id: string; secret_hash: string; redirect_uris: string[]; created: string };
const clientsPath = () => join(DATA_DIR, "oauth-clients.json");

function loadClients(): Record<string, Client> {
  try { return JSON.parse(readFileSync(clientsPath(), "utf8")); } catch { return {}; }
}

function saveClients(all: Record<string, Client>) {
  mkdirSync(DATA_DIR, { recursive: true });
  const tmp = clientsPath() + ".tmp";
  writeFileSync(tmp, JSON.stringify(all, null, 2), { mode: 0o600 });
  writeFileSync(clientsPath(), JSON.stringify(all, null, 2), { mode: 0o600 });
  try { if (existsSync(tmp)) writeFileSync(tmp + ".discard", ""); } catch {}
}

// ---- authorization codes (in-memory, single-use, bound to client+redirect) ----
const codes = new Map<string, { client_id: string; redirect_uri: string; exp: number }>();

// ---- OAuth doc shapes (MCP-spec compatible) ----
function oauthAuthorizationServer(origin: string) {
  return {
    issuer: origin,
    authorization_endpoint: `${origin}/authorize`,
    token_endpoint: `${origin}/api/oauth/token`,
    registration_endpoint: `${origin}/api/oauth/register`,
    jwks_uri: `${origin}/.well-known/jwks.json`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "client_credentials"],
    token_endpoint_auth_methods_supported: ["client_secret_post", "none"],
    scopes_supported: ["mcp"],
  };
}

function oauthProtectedResource(origin: string, path: string) {
  const resourcePath = path.includes("gemini-mcp") ? "/gemini-mcp" : "/doorbell-mcp";
  return {
    resource: `${origin}${resourcePath}`,
    authorization_servers: [origin],
    bearer_methods_supported: ["header"],
    scopes_supported: ["mcp"],
  };
}

async function tokenRequest(req: Request) {
  const ct = (req.headers.get("content-type") || "").toLowerCase();
  const raw = await req.text();
  let p: Record<string, string> = {};
  if (ct.includes("json")) {
    try { p = JSON.parse(raw); } catch {}
  } else {
    for (const [k, v] of new URLSearchParams(raw)) p[k] = v;
  }
  const grant = p.grant_type || "";
  if (grant === "client_credentials") {
    const all = loadClients();
    const c = all[p.client_id || ""];
    if (!c || !p.client_secret || !ctEq(sha(p.client_secret), c.secret_hash)) {
      return json({ error: "invalid_client" }, 401);
    }
    return json(signToken());
  }
  if (grant === "authorization_code") {
    const c = codes.get(p.code || "");
    const ok =
      !!c && c.exp > Date.now() && c.client_id === (p.client_id || "") && c.redirect_uri === (p.redirect_uri || "");
    if (!ok) return json({ error: "invalid_grant" }, 400);
    codes.delete(p.code);
    return json(signToken());
  }
  return json({ error: "unsupported_grant_type" }, 400);
}

function registerClient(req: Request) {
  return req.text().then((raw) => {
    const ct = (req.headers.get("content-type") || "").toLowerCase();
    let body: any = {};
    try { body = ct.includes("json") ? JSON.parse(raw) : Object.fromEntries(new URLSearchParams(raw)); } catch {}
    const client_id = `client_${randomBytes(4).toString("hex")}`;
    const client_secret = randomBytes(24).toString("hex");
    const redirect_uris: string[] = Array.isArray(body.redirect_uris) && body.redirect_uris.length
      ? body.redirect_uris.map(String)
      : ["http://127.0.0.1/cb"];
    const all = loadClients();
    all[client_id] = { client_id, secret_hash: sha(client_secret), redirect_uris, created: new Date().toISOString() };
    saveClients(all);
    console.log(`[oauth-edge] dcr client=${client_id} redirects=${redirect_uris.length}`);
    return json({ client_id, client_secret, redirect_uris, grant_types: ["authorization_code", "client_credentials"], token_endpoint_auth_method: "client_secret_post" }, 201);
  });
}

function authorize(url: URL) {
  const client_id = url.searchParams.get("client_id") || "";
  const redirect_uri = url.searchParams.get("redirect_uri") || "";
  const state = url.searchParams.get("state") || "";
  const c = loadClients()[client_id];
  if (!c || !redirect_uri || !c.redirect_uris.includes(redirect_uri)) {
    return json({ error: "unauthorized_client", error_description: "client not registered or redirect_uri mismatch" }, 400);
  }
  const code = `code_${randomBytes(12).toString("hex")}`;
  codes.set(code, { client_id, redirect_uri, exp: Date.now() + CODE_TTL_MS });
  const u = new URL(redirect_uri);
  u.searchParams.set("code", code);
  if (state) u.searchParams.set("state", state);
  console.log(`[oauth-edge] authorize client=${client_id}`);
  return new Response(null, { status: 302, headers: { Location: u.toString(), "Access-Control-Allow-Origin": "*" } });
}

const isMcpPath = (p: string) =>
  p === "/" || p.includes("doorbell-mcp") || p.includes("gemini-mcp") || p.endsWith("/mcp");

function unauthorized(origin: string, path = "") {
  return json(
    { error: "unauthorized", error_description: "valid bearer required; POST /api/oauth/token (client_credentials)" },
    401,
    { "WWW-Authenticate": `Bearer resource_metadata="${origin}/.well-known/oauth-protected-resource${isMcpPath(path) && path !== "/" ? path.replace(/\/+$/, "") : ""}"` },
  );
}

async function proxy(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const target = new URL(url.pathname + url.search, UPSTREAM);
  const headers = new Headers();
  for (const h of [
    "content-type", "accept", "authorization", "mcp-session-id", "last-event-id",
    "x-agent-id", "x-agent-role", "x-agent-model", "x-doorbell-workspace", "x-grok-bot", "user-agent",
  ]) {
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
  return new Response(up.body, { status: up.status, headers: up.headers });
}

function originOf(req: Request, url: URL): string {
  if (ISSUER) return ISSUER;
  const proto = req.headers.get("x-forwarded-proto") || url.protocol.replace(":", "") || "https";
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || url.host;
  return `${proto}://${host}`;
}


// ---- /exec-ws WS fast-lane passthrough (2026-10-17) ----
// The bridge's WS lane predates this edge's funnel takeover: the client dials
// wss://<estate-host>/exec-ws carrying its vault-surrogate X-MCP-Token, which
// the edge's own bearer check 401s. The ws-exec gateway (:25204) is the auth
// boundary for this path - it validates X-MCP-Token itself - so the edge
// tunnels the upgrade straight through instead of applying verifyBearer.
// Non-upgrade requests to /exec-ws keep the deny-by-default posture below.
type ExecWsBridge = {
  client: any; // ServerWebSocket, set on open
  upstream: WebSocket | null;
  upstreamOpen: boolean;
  toUpstream: (string | ArrayBuffer)[];
  toClient: (string | ArrayBuffer)[];
  timer: ReturnType<typeof setTimeout> | null;
};

function execWsFlush(b: ExecWsBridge) {
  if (b.upstreamOpen && b.upstream) {
    for (const m of b.toUpstream.splice(0)) { try { (b.upstream as any).send(m); } catch {} }
  }
  if (b.client) {
    for (const m of b.toClient.splice(0)) { try { b.client.send(m); } catch {} }
  }
}

function execWsServe(req: Request, server: any): Response | undefined {
  const mcpToken = req.headers.get("x-mcp-token") || "";
  if (!mcpToken) {
    return json({ error: "unauthorized", error_description: "x-mcp-token required for /exec-ws" }, 401);
  }
  const url = new URL(req.url);
  return wsTunnel(req, server, EXEC_WS_UPSTREAM + url.pathname + url.search, { "X-MCP-Token": mcpToken }, "exec-ws");
}

// ---- /squawk-ws public lane (2026-10-23) ----
// Cell-side (hatch/MetaAIVM) clients dial wss://github-mcp-host.../squawk-ws
// with Authorization: Bearer <squawk token> or ?token=. squawk-ws (:25147)
// validates the token itself (constant-time, ~/.squawk-ws-token + feed token),
// so the edge only requires one to be present and tunnels the upgrade.
function squawkWsServe(req: Request, server: any): Response | undefined {
  const url = new URL(req.url);
  const auth = req.headers.get("authorization") || "";
  if (!auth && !url.searchParams.get("token")) {
    return json({ error: "unauthorized", error_description: "Bearer or ?token= required for /squawk-ws" }, 401);
  }
  const sub = url.pathname.replace(/^\/squawk-ws/, "") || "/";
  const headers: Record<string, string> = {};
  if (auth) headers["Authorization"] = auth;
  return wsTunnel(req, server, SQUAWK_WS_UPSTREAM + sub + url.search, headers, "squawk-ws");
}

function wsTunnel(req: Request, server: any, target: string, extra: Record<string, string>, label: string): Response | undefined {
  const b: ExecWsBridge = { client: null, upstream: null, upstreamOpen: false, toUpstream: [], toClient: [], timer: null };
  let up: WebSocket;
  try {
    up = new WebSocket(target, {
      headers: {
        ...extra,
        "User-Agent": req.headers.get("user-agent") || `doorbell-oauth-edge/${label}`,
      },
    });
  } catch (e: any) {
    console.log(`[oauth-edge] ${label} upstream dial failed: ${e?.message || e}`);
    return json({ ok: false, error: `${label} upstream unreachable` }, 502);
  }
  b.upstream = up;
  up.addEventListener("open", () => { b.upstreamOpen = true; execWsFlush(b); });
  up.addEventListener("message", (ev: MessageEvent) => { b.toClient.push(ev.data as any); execWsFlush(b); });
  up.addEventListener("close", (ev: CloseEvent) => {
    try { b.client?.close(ev.code || 1011, ev.reason || "upstream closed"); } catch {}
    b.upstream = null;
  });
  up.addEventListener("error", () => {
    if (!b.upstreamOpen) {
      console.log(`[oauth-edge] ${label} upstream error before open`);
      try { b.client?.close(1011, "upstream failed"); } catch {}
    }
  });
  b.timer = setTimeout(() => {
    if (!b.upstreamOpen) {
      console.log(`[oauth-edge] ${label} upstream open timeout`);
      try { up.close(); } catch {}
      try { b.client?.close(1013, "upstream timeout"); } catch {}
    }
  }, 10000);
  if (!server.upgrade(req, { data: b })) {
    if (b.timer) clearTimeout(b.timer);
    try { up.close(); } catch {}
    return json({ ok: false, error: "websocket upgrade failed" }, 500);
  }
  return undefined; // 101 sent - websocket handlers own the socket now
}

const execWsHandlers = {
  open(ws: any) {
    (ws.data as ExecWsBridge).client = ws;
    execWsFlush(ws.data as ExecWsBridge);
  },
  message(ws: any, message: string | Buffer) {
    const b = ws.data as ExecWsBridge;
    b.toUpstream.push(message as any);
    execWsFlush(b);
  },
  close(ws: any) {
    const b = ws.data as ExecWsBridge;
    if (b.timer) clearTimeout(b.timer);
    try { b.upstream?.close(); } catch {}
    b.upstream = null;
    b.client = null;
  },
};

Bun.serve({
  port: PORT,
  hostname: "127.0.0.1",
  async fetch(req, server) {
    const url = new URL(req.url);
    const path = url.pathname;
    const origin = originOf(req, url);

    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });

    if (path === "/health") return json({ ok: true, service: "doorbell-oauth-edge", upstream: UPSTREAM });

    if (path.includes("oauth-protected-resource"))
      return json(oauthProtectedResource(origin, path));
    if (path.includes("oauth-authorization-server"))
      return json(oauthAuthorizationServer(origin));
    if (path.endsWith("jwks.json")) return json({ keys: [] });
    if (path.endsWith("/register")) return registerClient(req);
    if (path.endsWith("/token")) return tokenRequest(req);
    if (path.endsWith("/authorize")) return authorize(url);

    // WS fast lane: /exec-ws upgrades tunnel to the ws-exec gateway, which
    // validates X-MCP-Token itself - bypass the edge bearer check here.
    if (path === "/exec-ws" && (req.headers.get("upgrade") || "").toLowerCase() === "websocket") {
      const r = execWsServe(req, server);
      if (r) return r;
      return; // 101 sent by server.upgrade; websocket handlers own the socket
    }

    if ((path === "/squawk-ws" || path.startsWith("/squawk-ws/")) && (req.headers.get("upgrade") || "").toLowerCase() === "websocket") {
      const r = squawkWsServe(req, server);
      if (r) return r;
      return;
    }
    if (path === "/squawk-ws/ping" || path === "/squawk-ws/health") {
      try {
        const r = await fetch(SQUAWK_WS_UPSTREAM.replace(/^ws/, "http") + "/ping");
        return new Response(await r.text(), { status: r.status, headers: { "content-type": "application/json", ...cors } });
      } catch (e: any) { return json({ ok: false, error: "squawk-ws unreachable" }, 502); }
    }

    // deny by default: everything else (MCP surface, sessions, tier/seed) needs a bearer
    if (!verifyBearer(req)) return unauthorized(origin, path);
    try {
      return await proxy(req);
    } catch (e: any) {
      return json({ ok: false, error: `edge→doorbell: ${e?.message || e}`, upstream: UPSTREAM }, 502);
    }
  },
  websocket: execWsHandlers,
});

console.log(`[✓] doorbell-oauth-edge :${PORT} → ${UPSTREAM} (issuer=${originOf(new Request("https://edge.local/") as any, new URL("https://edge.local/"))})`);
