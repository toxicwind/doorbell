#!/usr/bin/env bash
# Paste on estate: put doorbell under pitchfork on :25202, prove, then kill fg shell jobs.
# NOTE: :25204 is awrawr-ws-exec — do NOT steal it. Monad+public edge share :25202 for now.
set -euo pipefail
ESTATE="${ESTATE:-/home/toxic/estate}"
DEST="${DOORBELL_ROOT:-$ESTATE/ranch/doorbell}"
cd "$ESTATE"

# 1) Ensure doorbell tree + env
if [ ! -f "$DEST/src/index.ts" ]; then
  echo "missing $DEST — run install first"; exit 1
fi
cd "$DEST"
[ -f .env ] || cp -n .env.example .env
# force public port 25202 (avoid 25204 collision with awrawr-ws-exec)
grep -q '^MONAD_PORT=' .env && sed -i 's/^MONAD_PORT=.*/MONAD_PORT=25202/' .env || echo 'MONAD_PORT=25202' >> .env
if [ -f "$HOME/.secrets" ]; then set -a; source "$HOME/.secrets" || true; set +a; fi
if [ -z "${MCPPROXY_API_KEY:-}" ] && [ -f "$ESTATE/.env" ]; then set -a; source "$ESTATE/.env" || true; set +a; fi
bun install

# 2) Fragment + compose into live pitchfork.toml (hand-edit gemini-mcp run target)
mkdir -p "$ESTATE/pitchfork.d"
cat > "$ESTATE/pitchfork.d/gemini-mcp.toml" << 'TOML'
# ranch/doorbell — public MCP on GEMINI_MCP_PORT (:25202). Replaces legacy gemini-mcp.ts bridge.
# Monad internals stay on :25202 until a free MONAD_PORT is allocated (25204 = awrawr-ws-exec).
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

# Patch composed pitchfork.toml in place (pitchfork does not hot-reload; restart re-registers)
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
if pat.search(text):
    text = pat.sub(block.rstrip() + "\n", text)
else:
    text = text.rstrip() + "\n\n" + block
p.write_text(text)
print("patched pitchfork.toml [daemons.gemini-mcp] → doorbell")
PY

# 3) Symlink compat entries (safe; failover flip)
ln -sfn "$DEST/gemini-monad.ts" "$ESTATE/gemini-monad.ts"
# keep gemini-mcp.ts as legacy file; pitchfork no longer runs it
cp -n "$ESTATE/gemini-mcp.ts" "$ESTATE/gemini-mcp.ts.pre-doorbell" 2>/dev/null || true

# 4) Stop throwaway fg / nohup holders of :25202 before pitchfork claims it
pkill -f 'bun run ./src/index.ts' 2>/dev/null || true
pkill -f 'bun run /home/toxic/estate/gemini-monad.ts' 2>/dev/null || true
pkill -f 'bun run /home/toxic/estate/gemini-mcp.ts' 2>/dev/null || true
fuser -k 25202/tcp 2>/dev/null || true
sleep 0.5

# 5) Pitchfork re-register + start (survives terminal death)
cd "$ESTATE"
if [ -x ./bin/pitchfork-restart ]; then
  ./bin/pitchfork-restart gemini-mcp
else
  pitchfork stop gemini-mcp 2>/dev/null || true
  pitchfork start gemini-mcp
fi

# 6) Prove — only then we are "sure"
ok=0
for i in 1 2 3 4 5 6 7 8 9 10; do
  if curl -fsS "http://127.0.0.1:25202/health" >/tmp/doorbell-health.json 2>/dev/null; then
    ok=1; break
  fi
  sleep 0.5
done
if [ "$ok" != 1 ]; then
  echo "FAIL: /health not up — leaving fg alone; check: pitchfork logs gemini-mcp"
  exit 1
fi
echo "=== health ==="; cat /tmp/doorbell-health.json; echo
curl -fsS "http://127.0.0.1:25202/sessions" | head -c 2000; echo

# 7) Kill leftover throwaway jobs (pitchfork owns the port now)
pkill -f 'bun run ./src/index.ts' 2>/dev/null || true
# do NOT kill awrawr on 25204
echo "Sure. Pitchfork owns gemini-mcp/:25202. Safe to close this terminal."
echo "Fallback flip done: estate/gemini-monad.ts → ranch/doorbell; pitchfork run → doorbell src."
