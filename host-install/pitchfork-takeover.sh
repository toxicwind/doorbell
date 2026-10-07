#!/usr/bin/env bash
# Put doorbell under pitchfork on :25202, prove, kill fg. Do NOT steal :25204 (awrawr-ws-exec).
set -euo pipefail
ESTATE="${ESTATE:-/home/toxic/estate}"
DEST="${DOORBELL_ROOT:-$ESTATE/ranch/doorbell}"
# Avoid mise parsing ~/.secrets as dotenv (it dies on glued newlines).
export MISE_DISABLE_TOOLS=1
unset MISE_ENV_FILE || true

if [ ! -f "$DEST/src/index.ts" ]; then
  echo "missing $DEST — run: curl -fsSL https://raw.githubusercontent.com/toxicwind/doorbell/d929cbdd9e52d84006e9663d3babdf43fa6213c8/install.sh | bash"
  exit 1
fi
cd "$DEST"
[ -f .env ] || cp -n .env.example .env
grep -q '^MONAD_PORT=' .env && sed -i 's/^MONAD_PORT=.*/MONAD_PORT=25202/' .env || echo 'MONAD_PORT=25202' >> .env

# Pull only MCPPROXY_API_KEY without `source` (mise-safe)
if [ -z "${MCPPROXY_API_KEY:-}" ]; then
  for f in "$HOME/.secrets" "$ESTATE/.env" "$DEST/.env"; do
    [ -f "$f" ] || continue
    k=$(grep -E '^[[:space:]]*MCPPROXY_API_KEY[[:space:]]*=' "$f" | head -1 | sed -E 's/^[^=]+=[[:space:]]*//; s/^["'\'']//; s/["'\'']$//')
    [ -n "$k" ] && export MCPPROXY_API_KEY="$k" && break
  done
fi
if [ -n "${MCPPROXY_API_KEY:-}" ]; then
  if grep -q '^MCPPROXY_API_KEY=' .env; then
    sed -i "s|^MCPPROXY_API_KEY=.*|MCPPROXY_API_KEY=${MCPPROXY_API_KEY}|" .env
  else
    echo "MCPPROXY_API_KEY=${MCPPROXY_API_KEY}" >> .env
  fi
fi

# bare bun, no mise wrapper
BUN="${BUN:-$(command -v bun || true)}"
[ -x /home/toxic/.bun/bin/bun ] && BUN=/home/toxic/.bun/bin/bun
[ -n "$BUN" ] || { echo "bun not found"; exit 1; }
"$BUN" install

mkdir -p "$ESTATE/pitchfork.d"
cat > "$ESTATE/pitchfork.d/gemini-mcp.toml" << 'TOML'
[daemons.gemini-mcp]
port = 25202
run = "exec /home/toxic/.bun/bin/bun run ./src/index.ts"
dir = "/home/toxic/estate/ranch/doorbell"
mise = false
retry = true
ready_http = "http://127.0.0.1:25202/health"
health_http = { url = "http://127.0.0.1:25202/health", interval = "30s", timeout = "5s", retries = 3 }
depends = ["gatehouse"]
boot_start = true
auto = ["start"]
env = { MONAD_PORT = "25202", GATEHOUSE_URL = "http://127.0.0.1:25127/mcp" }
TOML

python3 - << 'PY'
from pathlib import Path
import re
p = Path("/home/toxic/estate/pitchfork.toml")
text = p.read_text()
block = '''[daemons.gemini-mcp]
port = 25202
run = "exec /home/toxic/.bun/bin/bun run ./src/index.ts"
dir = "/home/toxic/estate/ranch/doorbell"
mise = false
retry = true
ready_http = "http://127.0.0.1:25202/health"
health_http = { url = "http://127.0.0.1:25202/health", interval = "30s", timeout = "5s", retries = 3 }
depends = ["gatehouse"]
boot_start = true
auto = ["start"]
env = { MONAD_PORT = "25202", GATEHOUSE_URL = "http://127.0.0.1:25127/mcp" }
'''
pat = re.compile(r"\[daemons\.gemini-mcp\][\s\S]*?(?=\n\[daemons\.|\Z)")
text = pat.sub(block.rstrip() + "\n", text) if pat.search(text) else text.rstrip() + "\n\n" + block
p.write_text(text)
print("patched pitchfork.toml [daemons.gemini-mcp] → doorbell")
PY

ln -sfn "$DEST/gemini-monad.ts" "$ESTATE/gemini-monad.ts"
cp -n "$ESTATE/gemini-mcp.ts" "$ESTATE/gemini-mcp.ts.pre-doorbell" 2>/dev/null || true

pkill -f 'bun run ./src/index.ts' 2>/dev/null || true
pkill -f 'bun run /home/toxic/estate/gemini-monad.ts' 2>/dev/null || true
pkill -f 'bun run /home/toxic/estate/gemini-mcp.ts' 2>/dev/null || true
fuser -k 25202/tcp 2>/dev/null || true
sleep 0.5

cd "$ESTATE"
if [ -x ./bin/pitchfork-restart ]; then
  ./bin/pitchfork-restart gemini-mcp
else
  pitchfork stop gemini-mcp 2>/dev/null || true
  pitchfork start gemini-mcp
fi

ok=0
for i in $(seq 1 20); do
  if curl -fsS "http://127.0.0.1:25202/health" >/tmp/doorbell-health.json 2>/dev/null; then ok=1; break; fi
  sleep 0.5
done
if [ "$ok" != 1 ]; then
  echo "FAIL: /health not up — pitchfork logs gemini-mcp"
  exit 1
fi
echo "=== health ==="; cat /tmp/doorbell-health.json; echo
curl -fsS "http://127.0.0.1:25202/sessions" | head -c 2000; echo
pkill -f 'bun run ./src/index.ts' 2>/dev/null || true
echo "Sure. Pitchfork owns gemini-mcp/:25202. Safe to close this terminal."
