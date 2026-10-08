#!/usr/bin/env bash
# lock-it-in.sh — fix Gemini "disabled" without ever touching `tailscale serve --set-path`
# (that command strips Funnel; that's why you keep re-running `tailscale funnel`).
# NOTE: no `cmd | head -N` anywhere — SIGPIPE under pipefail kills the script at 141.
set -euo pipefail

PUBLIC_HOST="github-mcp-host.tailc9ac71.ts.net"
PUBLIC_URL="https://${PUBLIC_HOST}/gemini-mcp"
LOCAL="http://127.0.0.1:25202"
ESTATE="${ESTATE:-/home/toxic/estate}"

hr(){ printf '\n=== %s ===\n' "$*"; }
# awk drains stdin (no SIGPIPE); sed would too. Never head under pipefail.
first3(){ awk 'NR<=3'; }

hr "1. Funnel must be ON (never touch serve --set-path)"
if tailscale serve status 2>/dev/null | first3 | grep -q 'Funnel on'; then
  echo "funnel already on"
else
  echo "funnel off -> turning on (port 443)"
  tailscale funnel --bg --yes 443
fi
tailscale serve status | first3

hr "2. cold restart doorbell-mcp (never pitchfork-restart; that's hot)"
if [ -x "$ESTATE/bin/pitchfork-stop" ]; then
  "$ESTATE/bin/pitchfork-stop" doorbell-mcp 2>/dev/null || true
else
  pitchfork stop doorbell-mcp 2>/dev/null || true
fi
fuser -k 25202/tcp 2>/dev/null || true
for i in $(seq 1 30); do ss -ltnH | grep -q ':25202 ' || break; sleep 1; done
if [ -x "$ESTATE/bin/pitchfork-start" ]; then
  "$ESTATE/bin/pitchfork-start" doorbell-mcp
else
  pitchfork start doorbell-mcp
fi
for i in $(seq 1 40); do
  curl -fsS "$LOCAL/health" >/dev/null 2>&1 && break
  sleep 0.5
done

hr "3. local health"
curl -fsS "$LOCAL/health" | first3

hr "4. endpoint event through the PUBLIC url must carry /gemini-mcp"
EV="$(curl -sN --max-time 4 "$PUBLIC_URL?sessionId=lock&agentId=lock" | first3 | tr -d '\r' || true)"
echo "$EV"
echo "$EV" | grep -q "$PUBLIC_HOST/gemini-mcp" \
  && echo "OK endpoint path preserved" \
  || { echo "FAIL endpoint path — connector will be disabled"; exit 1; }

hr "5. OAuth protected-resource must agree with connector URL"
PR="$(curl -fsS "https://${PUBLIC_HOST}/.well-known/oauth-protected-resource")"
echo "$PR" | jq .
echo "$PR" | jq -r .resource | grep -qx "$PUBLIC_URL" \
  && echo "OK resource == connector URL" \
  || { echo "FAIL resource != $PUBLIC_URL"; exit 1; }

hr "6. OAuth authorization-server + jwks reachable"
curl -fsS "https://${PUBLIC_HOST}/.well-known/oauth-authorization-server" | jq -c '{issuer,authorization_endpoint,token_endpoint,registration_endpoint}'
curl -fsS "https://${PUBLIC_HOST}/.well-known/jwks.json" | jq -c .

hr "7. MCP initialize through public URL (funnel proof)"
curl -fsS -o /dev/null -w 'POST /gemini-mcp -> %{http_code}\n' \
  -X POST "$PUBLIC_URL" \
  -H 'content-type: application/json' \
  -H 'accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-11-25","capabilities":{},"clientInfo":{"name":"lock","version":"1"}}}' \
  || echo "public initialize failed"

hr "8. Gemini-side checklist (manual)"
cat <<'TXT'
  1. rm -f ~/.gemini/mcp-server-enablement.json   # fail-open corruption trap
  2. In Gemini, re-register the connector at the ROOT url if /gemini-mcp stays disabled:
       https://github-mcp-host.tailc9ac71.ts.net/
     (Gemini stores path but AccountLinkingService/GetLink looks up root — path-based
      connectors fail validation until upstream fixes it.)
  3. Full tab reload. Not retry. Then tick "I understand" and Connect.
  4. If on Gemini Enterprise: confirm org policy
       discoveryengine.managed.disableCustomMcpServerConnector
     is NOT ENFORCED for this project.
  5. DO NOT run `tailscale serve --set-path=...` again — it strips Funnel every time.
     If you must add a path mapping, use `tailscale funnel --bg --yes --set-path=... 443`.
TXT

hr "done"
echo "funnel:"; tailscale serve status | first3
echo "connector: $PUBLIC_URL"
