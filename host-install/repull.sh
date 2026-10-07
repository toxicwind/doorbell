#!/bin/sh
# Pull main into an existing doorbell dir and cold-start under mise.
# The live dir is often a tarball extract with no .git. Do not clone over it.
set -eu
ESTATE="${ESTATE:-/home/toxic/estate}"
DEST="${DOORBELL_ROOT:-$ESTATE/ranch/doorbell}"
URL="${DOORBELL_REPO:-https://github.com/toxicwind/doorbell.git}"
PORT=25202

mkdir -p "$DEST"
cd "$DEST"
if [ -f .env ]; then cp .env /tmp/doorbell.env.keep; fi

if [ ! -d .git ]; then
  git init -b main
  git remote add origin "$URL" 2>/dev/null || git remote set-url origin "$URL"
fi
git remote set-url origin "$URL"
git fetch origin main
git checkout -B main origin/main
if [ -f /tmp/doorbell.env.keep ]; then cp /tmp/doorbell.env.keep .env; fi
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
if [ -x ./bin/pitchfork-stop ]; then
  ./bin/pitchfork-stop gemini-mcp 2>/dev/null || true
  ./bin/pitchfork-stop doorbell-mcp 2>/dev/null || true
else
  pitchfork stop gemini-mcp 2>/dev/null || true
  pitchfork stop doorbell-mcp 2>/dev/null || true
fi
fuser -k ${PORT}/tcp 2>/dev/null || true
i=0
while [ "$i" -lt 30 ]; do
  if ! ss -ltn | grep -q ":${PORT} "; then
    break
  fi
  sleep 1
  i=$((i + 1))
done
if [ -x ./bin/pitchfork-start ]; then
  ./bin/pitchfork-start doorbell-mcp
else
  pitchfork start doorbell-mcp
fi
curl -fsS "http://127.0.0.1:${PORT}/health"
echo
curl -fsS -X POST "http://127.0.0.1:${PORT}/gemini-mcp" \
  -H 'Content-Type: application/json' \
  -H 'x-agent-id: repull' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"repull","version":"1"}}}'
echo
