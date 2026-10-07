#!/bin/sh
set -eu
DEST="${DOORBELL_DEST:-/home/toxic/estate/ranch/doorbell}"
URL="${DOORBELL_TARBALL:-https://raw.githubusercontent.com/toxicwind/doorbell/main/doorbell.tar.gz.b64}"
mkdir -p "$DEST"
curl -fsSL "$URL" | base64 -d | tar -xzf - -C "$DEST"
cd /home/toxic/estate
if [ -x ./bin/pitchfork-restart ]; then
  ./bin/pitchfork-restart doorbell-mcp || true
fi
pitchfork stop doorbell-mcp 2>/dev/null || true
pitchfork start doorbell-mcp
curl -fsS http://127.0.0.1:25202/health
echo
curl -fsS -X POST http://127.0.0.1:25202/gemini-mcp \
  -H 'Content-Type: application/json' \
  -H 'x-agent-id: v7' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"v7","version":"1"}}}'
echo
