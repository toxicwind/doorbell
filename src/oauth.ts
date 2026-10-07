/** OAuth discovery fakes preserved for clients that probe well-known. */
import { randomBytes } from "crypto";
import { ISSUER } from "./config.ts";

const REDIR =
  "https://oauth-redirect.googleusercontent.com/r/user_bound_custom-mcp-111554610217088906669-github-mcp-host_tailc9ac71_ts_net";

export function oauthProtectedResource(reqUrl?: URL) {
  const path = reqUrl?.pathname || "";
  const resourcePath = path.includes("doorbell-mcp") ? "/doorbell-mcp" : "/gemini-mcp";
  return {
    resource: `${ISSUER}${resourcePath}`,
    authorization_servers: [ISSUER],
    bearer_methods_supported: ["header"],
    scopes_supported: ["mcp"],
  };
}

export function oauthAuthorizationServer() {
  return {
    issuer: ISSUER,
    authorization_endpoint: `${ISSUER}/authorize`,
    token_endpoint: `${ISSUER}/api/oauth/token`,
    registration_endpoint: `${ISSUER}/api/oauth/register`,
    jwks_uri: `${ISSUER}/.well-known/jwks.json`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "client_credentials", "refresh_token"],
    token_endpoint_auth_methods_supported: ["none"],
  };
}

export function oauthRegister() {
  return {
    client_id: `client_${randomBytes(4).toString("hex")}`,
    client_secret: randomBytes(8).toString("hex"),
    redirect_uris: [REDIR],
    grant_types: ["authorization_code", "client_credentials"],
  };
}

export function oauthToken() {
  return {
    access_token: `tok_${randomBytes(8).toString("hex")}`,
    token_type: "Bearer",
    expires_in: 86400,
  };
}

export function oauthAuthorizeRedirect(url: URL): Response {
  const redir = url.searchParams.get("redirect_uri") || REDIR;
  const st = url.searchParams.get("state") || "";
  const u = new URL(redir);
  u.searchParams.set("code", `code_${randomBytes(8).toString("hex")}`);
  if (st) u.searchParams.set("state", st);
  return new Response(null, {
    status: 302,
    headers: { Location: u.toString(), "Access-Control-Allow-Origin": "*" },
  });
}
