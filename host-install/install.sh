#!/usr/bin/env bash
# ranch/doorbell — curl | bash (installs, then backgrounds monad+edge)
set -euo pipefail
DEST="${1:-/home/toxic/estate/ranch/doorbell}"
ESTATE="${ESTATE:-/home/toxic/estate}"
REPO_RAW="${DOORBELL_RAW:-https://raw.githubusercontent.com/toxicwind/doorbell/main}"
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
echo "Installing doorbell → $DEST"
curl -fsSL "$REPO_RAW/doorbell.tar.gz.b64" -o "$TMP/doorbell.tar.gz.b64"
base64 -d "$TMP/doorbell.tar.gz.b64" > "$TMP/doorbell.tar.gz"
mkdir -p "$DEST"
tar -xzf "$TMP/doorbell.tar.gz" -C "$DEST"
cd "$DEST"
cp -n .env.example .env 2>/dev/null || true
if [ -f "$HOME/.secrets" ]; then set -a; # shellcheck disable=SC1090
  source "$HOME/.secrets" 2>/dev/null || true; set +a; fi
if [ -z "${MCPPROXY_API_KEY:-}" ] && [ -f "$ESTATE/.env" ]; then set -a; source "$ESTATE/.env"; set +a; fi
# persist key into .env if present
if [ -n "${MCPPROXY_API_KEY:-}" ] && ! grep -q '^MCPPROXY_API_KEY=.\+' .env 2>/dev/null; then
  sed -i "s/^MCPPROXY_API_KEY=.*/MCPPROXY_API_KEY=${MCPPROXY_API_KEY}/" .env || true
fi
ln -sfn "$DEST/gemini-monad.ts" "$ESTATE/gemini-monad.ts"
ln -sfn "$DEST/gemini-mcp-hono.ts" "$ESTATE/gemini-mcp-hono.ts"
echo "Symlinked estate gemini-monad.ts + gemini-mcp-hono.ts → doorbell"
bun install
bash ./scripts/start-bg.sh
echo "Done. Edge :25202 → monad :25204 (background)."
