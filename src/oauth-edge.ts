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

function unauthorized(origin: string) {
  return json(
    { error: "unauthorized", error_description: "valid bearer required; POST /api/oauth/token (client_credentials)" },
    401,
    { "WWW-Authenticate": `Bearer resource_metadata="${origin}/.well-known/oauth-protected-resource"` },
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

Bun.serve({
  port: PORT,
  hostname: "127.0.0.1",
  async fetch(req) {
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

    // deny by default: everything else (MCP surface, sessions, tier/seed) needs a bearer
    if (!verifyBearer(req)) return unauthorized(origin);
    try {
      return await proxy(req);
    } catch (e: any) {
      return json({ ok: false, error: `edge→doorbell: ${e?.message || e}`, upstream: UPSTREAM }, 502);
    }
  },
});

console.log(`[✓] doorbell-oauth-edge :${PORT} → ${UPSTREAM} (issuer=${originOf(new Request("https://edge.local/") as any, new URL("https://edge.local/"))})`);
