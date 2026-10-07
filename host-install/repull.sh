#!/bin/sh
# Merge origin/main into the live doorbell dir. Print the weird diff if the trees disagree.
# Does not clone over an existing directory. Does not call pitchfork-restart.
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
fi
git remote remove origin 2>/dev/null || true
git remote add origin "$URL"
git fetch origin main

echo "=== local status ==="
git status --short || true
echo "=== local diff ==="
git diff --stat || true
git diff || true

if git rev-parse --verify HEAD >/dev/null 2>&1; then
  echo "=== diff against origin/main ==="
  git diff --stat HEAD origin/main || true
  git merge origin/main --no-edit --allow-unrelated-histories -X ours || {
    echo "=== merge conflict ==="
    git diff || true
    git status --short || true
    exit 1
  }
else
  git checkout -B main origin/main
fi

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
