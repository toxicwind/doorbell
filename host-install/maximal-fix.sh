#!/usr/bin/env bash
# Maximal estate fix: Funnel + MCP paths + locate/patch moved gatehouse upstreams.
# No bad symlinks. Run on the estate host as toxic.
set -euo pipefail

echo "=== 0) doorbell local health ==="
curl -fsS http://127.0.0.1:25202/health | head -c 400; echo
pitchfork status doorbell-mcp 2>/dev/null || true

echo "=== 1) Funnel ON (correct CLI) ==="
# Newer CLI: funnel takes a port, not '--https=443 on'
if ! tailscale funnel status 2>/dev/null | grep -qi 'on\|enabled\|Funnel'; then
  tailscale funnel --bg --yes 443 || tailscale funnel --yes 443 || {
    echo "FUNNEL_FAIL — try: tailscale funnel --help"
    tailscale funnel --help | sed -n '1,60p' || true
  }
fi
tailscale funnel status 2>/dev/null || true

echo "=== 2) Ensure MCP serve paths (do NOT reset unless empty) ==="
# Mirror historical mapping: public path → :25202/mcp
tailscale serve --bg --yes --set-path=/gemini-mcp http://127.0.0.1:25202/mcp || true
tailscale serve --bg --yes --set-path=/doorbell-mcp http://127.0.0.1:25202/mcp || true
# OAuth helpers that were on :25202
tailscale serve --bg --yes --set-path=/authorize http://127.0.0.1:25202/authorize || true
tailscale serve --bg --yes --set-path=/api/oauth/token http://127.0.0.1:25202/api/oauth/token || true
tailscale serve --bg --yes --set-path=/api/oauth/register http://127.0.0.1:25202/api/oauth/register || true

echo "=== 3) Serve status (expect Funnel on + both MCP paths) ==="
tailscale serve status

echo "=== 4) Prove local + public ==="
curl -fsS -o /dev/null -w 'local /doorbell-mcp:%{http_code}\n' -X POST http://127.0.0.1:25202/doorbell-mcp \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"fix","version":"1"}}}'
curl -fsS -o /dev/null -w 'local /gemini-mcp:%{http_code}\n' -X POST http://127.0.0.1:25202/gemini-mcp \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"fix","version":"1"}}}'
curl -fsS -o /dev/null -w 'public /doorbell-mcp:%{http_code}\n' -X POST https://github-mcp-host.tailc9ac71.ts.net/doorbell-mcp \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"fix","version":"1"}}}' || echo 'public doorbell FAIL (Funnel?)'
curl -fsS -o /dev/null -w 'public /gemini-mcp:%{http_code}\n' -X POST https://github-mcp-host.tailc9ac71.ts.net/gemini-mcp \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"fix","version":"1"}}}' || echo 'public gemini FAIL (Funnel?)'

echo "=== 5) Locate moved shell MCP trees (no symlinks) ==="
locate_one() {
  local name="$1"
  # prefer estate, then projects, then home — print first hit only
  for root in /home/toxic/estate /home/toxic/projects /home/toxic; do
    [ -d "$root" ] || continue
    hit=$(find "$root" -maxdepth 5 -type d -name "$name" 2>/dev/null | head -1 || true)
    if [ -n "${hit:-}" ]; then echo "$name → $hit"; return 0; fi
  done
  echo "$name → MISSING"
}
locate_one kitty-mcp-server
locate_one wezterm-agent-mcp
locate_one rsync-mcp
locate_one lasso
locate_one tmux-mcp
locate_one desktop-commander
ls /home/toxic/estate/tools 2>/dev/null || true

echo "=== 6) Find mcpproxy / gatehouse config ==="
for c in \
  /home/toxic/.config/mcpproxy/mcp_proxy.json \
  /home/toxic/.config/mcpproxy/config.json \
  /home/toxic/.mcpproxy/config.json \
  /home/toxic/estate/gatehouse/mcpproxy.json \
  /home/toxic/estate/config/mcpproxy.json \
  /home/toxic/estate/ranch/*/mcpproxy*.json
do
  for f in $c; do
    [ -f "$f" ] && echo "CFG $f" && ls -la "$f"
  done
done
# also pitchfork/mise hints
rg -l 'kitty-mcp-server|wezterm-agent-mcp|mcp-background-job' /home/toxic/estate /home/toxic/.config -g '*.json' -g '*.toml' -g '*.yaml' 2>/dev/null | head -20 || true

echo "=== 7) Done ==="
echo "Paste this whole output back. After Funnel is on I will patch upstream refs via MCP (no symlinks)."
