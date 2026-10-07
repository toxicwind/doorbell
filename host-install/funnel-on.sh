#!/usr/bin/env bash
# Force Funnel ON for github-mcp-host (fixes false-positive "Funnel" grep).
set -euo pipefail
echo "=== before ==="
tailscale serve status 2>&1 | head -5 || true
echo "=== enable Funnel (try several CLI shapes) ==="
# Prefer explicit port; never pass a bare "on" after --https=443 (parses as target).
ok=0
for cmd in \
  "tailscale funnel --bg --yes 443" \
  "tailscale funnel --yes 443" \
  "tailscale funnel 443" \
  "tailscale serve --bg --yes --https=443 / http://127.0.0.1:25201" \
  ; do
  echo "+ $cmd"
  if eval "$cmd" 2>&1; then ok=1; break; fi
done
# Last resort: funnel subcommand help so we can see the right syntax
if [ "$ok" -eq 0 ]; then
  echo "FUNNEL_FAIL — dumping help:"
  tailscale funnel --help 2>&1 | sed -n '1,80p' || true
  tailscale serve --help 2>&1 | sed -n '1,80p' || true
fi
echo "=== after (must NOT say tailnet only on :443) ==="
tailscale serve status 2>&1 | head -20
echo "=== prove from this host (MagicDNS) ==="
curl -fsS -o /dev/null -w 'host /doorbell-mcp:%{http_code}\n' -X POST https://github-mcp-host.tailc9ac71.ts.net/doorbell-mcp \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"v","version":"1"}}}' || echo host_fail
echo "=== Funnel ACL tip ==="
echo "If still 'tailnet only': enable Funnel in admin console for this node, or: tailscale funnel --help"
