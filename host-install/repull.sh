#!/bin/sh
# Headless repull of doorbell-mcp. Prints the public connector URL.
ESTATE="${ESTATE:-/home/toxic/estate}"
DEST="${DOORBELL_ROOT:-$ESTATE/ranch/doorbell}"
URL="${DOORBELL_REPO:-https://github.com/toxicwind/doorbell.git}"
PORT=25202
PUBLIC="${DOORBELL_PUBLIC:-https://github-mcp-host.tailc9ac71.ts.net/doorbell-mcp}"

mkdir -p "$DEST"
cd "$DEST" || exit 1
[ -f .env ] && cp .env /tmp/doorbell.env.keep
if [ ! -d .git ]; then git init -b main || true; fi
git remote remove origin 2>/dev/null || true
git remote add origin "$URL" || true
git fetch origin main || { echo "FAIL fetch"; exit 1; }

echo "=== files that differ from origin/main ==="
git ls-tree -r --name-only origin/main | while read -r f; do
  [ -f "$f" ] || continue
  if ! git show "origin/main:$f" 2>/dev/null | cmp -s - "$f"; then
    echo "----- $f -----"
    git show "origin/main:$f" | diff -u "$f" - || true
  fi
done
git read-tree origin/main || true
git checkout-index -a -f || true
git reset --hard origin/main || true
[ -f /tmp/doorbell.env.keep ] && cp /tmp/doorbell.env.keep .env
echo "HEAD $(git rev-parse --short HEAD 2>/dev/null || echo none)"

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

cd "$ESTATE" || exit 1
if [ -x ./bin/pitchfork-stop ]; then
  ./bin/pitchfork-stop doorbell-mcp || true
else
  pitchfork stop doorbell-mcp || true
fi
fuser -k ${PORT}/tcp || true
i=0
while [ "$i" -lt 20 ]; do
  ss -ltn | grep -q ":${PORT} " || break
  sleep 1
  i=$((i + 1))
done
if [ -x ./bin/pitchfork-start ]; then
  ./bin/pitchfork-start doorbell-mcp || true
else
  pitchfork start doorbell-mcp || true
fi
curl -fsS "http://127.0.0.1:${PORT}/health" || echo "FAIL health"
echo
code=$(curl -sS -o /dev/null -w '%{http_code}' -X POST "http://127.0.0.1:${PORT}/doorbell-mcp" \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"repull","version":"1"}}}' || echo 000)
echo "local /doorbell-mcp ${code}"
echo "connector ${PUBLIC}"
