#!/bin/sh
# Pull main and cold-start doorbell-mcp under mise.
# Does not unpack doorbell.tar.gz.b64. Does not call pitchfork-restart.
set -eu
ESTATE="${ESTATE:-/home/toxic/estate}"
DEST="${DOORBELL_ROOT:-$ESTATE/ranch/doorbell}"
URL="${DOORBELL_REPO:-https://github.com/toxicwind/doorbell.git}"
PORT=25202

if [ ! -d "$DEST/.git" ]; then
  git clone --branch main "$URL" "$DEST"
fi
cd "$DEST"
git fetch origin main
git checkout main
git pull --ff-only origin main
echo "HEAD $(git rev-parse --short HEAD)"

mkdir -p "$ESTATE/pitchfork.d"
cat > "$ESTATE/pitchfork.d/doorbell-mcp.toml" << TOML
[daemons.doorbell-mcp]
port = ${PORT}
run = "mise exec -- bun run ./src/index.ts"
dir = "${DEST}"
mise = true
retry = true
ready_http = "http://127.0.0.1:${PORT}/health"
TOML

cd "$ESTATE"
pitchfork stop gemini-mcp 2>/dev/null || true
pitchfork stop doorbell-mcp 2>/dev/null || true
fuser -k ${PORT}/tcp 2>/dev/null || true
i=0
while [ "$i" -lt 30 ]; do
  if ! ss -ltn | grep -q ":${PORT} "; then
    break
  fi
  sleep 1
  i=$((i + 1))
done
pitchfork start doorbell-mcp
curl -fsS "http://127.0.0.1:${PORT}/health"
echo
curl -fsS -X POST "http://127.0.0.1:${PORT}/gemini-mcp" \
  -H 'Content-Type: application/json' \
  -H 'x-agent-id: repull' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"repull","version":"1"}}}'
echo
