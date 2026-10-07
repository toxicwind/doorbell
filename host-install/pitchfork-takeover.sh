#!/usr/bin/env bash
# Put doorbell under pitchfork as doorbell-mcp on :25202.
# HTTP /doorbell-mcp = primary; /gemini-mcp = backwards-compat alias (same process).
# Never let mise touch ~/.secrets. Do NOT touch Tailscale serve.
# NEVER call pitchfork-restart (always hot/staging) — cold stop → wait → start only.
set -euo pipefail
ESTATE="${ESTATE:-/home/toxic/estate}"
DEST="${DOORBELL_ROOT:-$ESTATE/ranch/doorbell}"
REPO_URL="${DOORBELL_REPO:-https://github.com/toxicwind/doorbell.git}"
REPO_RAW="${DOORBELL_RAW:-https://raw.githubusercontent.com/toxicwind/doorbell/main}"
PORT=25202

# Detach from mise entirely for this script (hook still injects MISE_ENV_FILE=~/.secrets)
export MISE_DISABLE_TOOLS=1
unset MISE_ENV_FILE MISE_ENV MISE_PROJECT_ROOT || true
# Prefer absolute bun so `bun` shim never re-enters mise
BUN=/home/toxic/.bun/bin/bun
[ -x "$BUN" ] || BUN="$(type -P bun 2>/dev/null || true)"
[ -x "$BUN" ] || { echo "bun not found at /home/toxic/.bun/bin/bun"; exit 1; }
run_bun() { env -u MISE_ENV_FILE -u MISE_ENV MISE_DISABLE_TOOLS=1 "$BUN" "$@"; }

# --- FIRST FIX: sanitize ~/.secrets glued newlines (mise dotenv killer) ---
SECRETS="${HOME}/.secrets"
if [ -f "$SECRETS" ]; then
  cp -n "$SECRETS" "${SECRETS}.bak.doorbell-$(date +%s)" 2>/dev/null || cp "$SECRETS" "${SECRETS}.bak.doorbell"
  python3 - <<'PY'
from pathlib import Path
p = Path.home() / ".secrets"
raw = p.read_bytes()
text = raw.decode("utf-8", "replace")
fixed = text.replace("\\n", "\n")
import re
fixed = re.sub(r"([^\n])export ", r"\1\nexport ", fixed)
if fixed != text:
    p.write_text(fixed)
    print(f"sanitized {p} (backup *.bak.doorbell*)")
else:
    print(f"no glued \\\\n found in {p}; leaving as-is")
PY
fi

# --- Sync full tree into DEST (repo ships source primarily via doorbell.tar.gz.b64) ---
tree_ok() {
  [ -f "$DEST/src/index.ts" ] && [ -f "$DEST/package.json" ] && [ -f "$DEST/host-install/pitchfork-takeover.sh" ]
}

sync_dest_from_tarball() {
  local tmp
  tmp=$(mktemp -d)
  echo "syncing full doorbell tree → $DEST (from $REPO_RAW/doorbell.tar.gz.b64)"
  curl -fsSL "$REPO_RAW/doorbell.tar.gz.b64" -o "$tmp/doorbell.tar.gz.b64"
  base64 -d "$tmp/doorbell.tar.gz.b64" > "$tmp/doorbell.tar.gz"
  mkdir -p "$DEST"
  # Preserve host .env across extract
  if [ -f "$DEST/.env" ]; then cp "$DEST/.env" "$tmp/.env.keep"; fi
  tar -xzf "$tmp/doorbell.tar.gz" -C "$DEST"
  if [ -f "$tmp/.env.keep" ]; then cp "$tmp/.env.keep" "$DEST/.env"; fi
  rm -rf "$tmp"
}

# Always refresh from tarball when incomplete OR when FORCE_SYNC=1
if ! tree_ok || [ "${FORCE_SYNC:-0}" = "1" ]; then
  mkdir -p "$(dirname "$DEST")"
  # Optional: seed empty dir via shallow clone (metadata only); tarball is source of truth for src/
  if [ ! -d "$DEST/.git" ] && [ ! -f "$DEST/src/index.ts" ]; then
    if git clone --depth 1 -b main "$REPO_URL" "$DEST" 2>/dev/null; then
      echo "cloned repo skeleton into $DEST"
    else
      mkdir -p "$DEST"
    fi
  fi
  sync_dest_from_tarball
fi

if ! tree_ok; then
  echo "FAIL: DEST still incomplete after sync:"
  echo "  need: $DEST/src/index.ts, package.json, host-install/pitchfork-takeover.sh"
  ls -la "$DEST" 2>/dev/null || true
  exit 1
fi

# Ensure host-install scripts are executable in DEST
chmod +x "$DEST/host-install/"*.sh 2>/dev/null || true
chmod +x "$DEST/install.sh" "$DEST/scripts/"*.sh 2>/dev/null || true

cd "$DEST"
echo "DEST tree OK: $(wc -c < src/index.ts) bytes src/index.ts; package.json:"
head -5 package.json

[ -f .env ] || cp -n .env.example .env
grep -q '^MONAD_PORT=' .env && sed -i 's/^MONAD_PORT=.*/MONAD_PORT=25202/' .env || echo 'MONAD_PORT=25202' >> .env

if [ -z "${MCPPROXY_API_KEY:-}" ]; then
  for f in "$HOME/.secrets" "$ESTATE/.env" "$DEST/.env"; do
    [ -f "$f" ] || continue
    k=$(grep -E '^[[:space:]]*(export[[:space:]]+)?MCPPROXY_API_KEY[[:space:]]*=' "$f" | head -1 | sed -E 's/^[[:space:]]*(export[[:space:]]+)?MCPPROXY_API_KEY[[:space:]]*=[[:space:]]*//; s/^["'\'']//; s/["'\'']$//; s/\r$//')
    [ -n "$k" ] && export MCPPROXY_API_KEY="$k" && break
  done
fi
if [ -n "${MCPPROXY_API_KEY:-}" ]; then
  if grep -q '^MCPPROXY_API_KEY=' .env; then sed -i "s|^MCPPROXY_API_KEY=.*|MCPPROXY_API_KEY=${MCPPROXY_API_KEY}|" .env
  else echo "MCPPROXY_API_KEY=${MCPPROXY_API_KEY}" >> .env; fi
fi

# package.json may have zero npm deps (Bun runs TS natively) — still run install for lockfile hygiene
run_bun install || true
# Sanity: entry must exist and be non-trivial
[ -s "$DEST/src/index.ts" ] || { echo "FAIL: empty src/index.ts"; exit 1; }

# --- Pitchfork: one process doorbell-mcp on :25202 (replace old gemini-mcp daemon) ---
mkdir -p "$ESTATE/pitchfork.d"
rm -f "$ESTATE/pitchfork.d/gemini-mcp.toml"
cat > "$ESTATE/pitchfork.d/doorbell-mcp.toml" << 'TOML'
[daemons.doorbell-mcp]
port = 25202
run = "exec env -u MISE_ENV_FILE -u MISE_ENV MISE_DISABLE_TOOLS=1 /home/toxic/.bun/bin/bun run ./src/index.ts"
dir = "/home/toxic/estate/ranch/doorbell"
mise = false
retry = true
ready_http = "http://127.0.0.1:25202/health"
health_http = { url = "http://127.0.0.1:25202/health", interval = "30s", timeout = "5s", retries = 3 }
depends = ["gatehouse"]
boot_start = true
auto = ["start"]
env = { MONAD_PORT = "25202", GATEHOUSE_URL = "http://127.0.0.1:25127/mcp", MISE_DISABLE_TOOLS = "1" }
TOML

python3 - << 'PY'
from pathlib import Path
import re
p = Path("/home/toxic/estate/pitchfork.toml")
text = p.read_text() if p.exists() else ""
block = '''[daemons.doorbell-mcp]
port = 25202
run = "exec env -u MISE_ENV_FILE -u MISE_ENV MISE_DISABLE_TOOLS=1 /home/toxic/.bun/bin/bun run ./src/index.ts"
dir = "/home/toxic/estate/ranch/doorbell"
mise = false
retry = true
ready_http = "http://127.0.0.1:25202/health"
health_http = { url = "http://127.0.0.1:25202/health", interval = "30s", timeout = "5s", retries = 3 }
depends = ["gatehouse"]
boot_start = true
auto = ["start"]
env = { MONAD_PORT = "25202", GATEHOUSE_URL = "http://127.0.0.1:25127/mcp", MISE_DISABLE_TOOLS = "1" }
'''
text = re.sub(r"\[daemons\.gemini-mcp\][\s\S]*?(?=\n\[daemons\.|\Z)", "", text)
pat = re.compile(r"\[daemons\.doorbell-mcp\][\s\S]*?(?=\n\[daemons\.|\Z)")
text = pat.sub(block.rstrip() + "\n", text) if pat.search(text) else text.rstrip() + "\n\n" + block
text = re.sub(r"\n{3,}", "\n\n", text)
p.write_text(text)
print("patched pitchfork.toml [daemons.doorbell-mcp]; removed [daemons.gemini-mcp] (HTTP /gemini-mcp stays on same process)")
PY

ln -sfn "$DEST/gemini-monad.ts" "$ESTATE/gemini-monad.ts"
cp -n "$ESTATE/gemini-mcp.ts" "$ESTATE/gemini-mcp.ts.pre-doorbell" 2>/dev/null || true

# --- COLD restart only (pitchfork-restart is ALWAYS hot/staging — never call it) ---
wait_port_free() {
  local port="$1" max="${2:-90}"
  local i=0
  echo "waiting for :${port} to clear (max ${max}s)..."
  while [ "$i" -lt "$max" ]; do
    busy=0
    if ss -ltnH 2>/dev/null | awk '{print $4}' | grep -qE "[:.]${port}$"; then busy=1; fi
    if ss -ltn 2>/dev/null | awk '{print $4}' | grep -qE "[:.]${port}$"; then busy=1; fi
    if fuser "${port}/tcp" >/dev/null 2>&1; then busy=1; fi
    if [ "$busy" = 0 ]; then
      echo ":${port} is free after ${i}s"
      return 0
    fi
    sleep 1
    i=$((i + 1))
  done
  echo "WARN: :${port} still busy after ${max}s — forcing fuser -k"
  fuser -k "${port}/tcp" 2>/dev/null || true
  sleep 2
  return 0
}

cd "$ESTATE"
echo "cold stop: gemini-mcp + doorbell-mcp (stop then start only)"
if [ -x ./bin/pitchfork-stop ]; then
  ./bin/pitchfork-stop gemini-mcp 2>/dev/null || true
  ./bin/pitchfork-stop doorbell-mcp 2>/dev/null || true
else
  pitchfork stop gemini-mcp 2>/dev/null || true
  pitchfork stop doorbell-mcp 2>/dev/null || true
fi
pkill -f 'bun run ./src/index.ts' 2>/dev/null || true
pkill -f 'bun run /home/toxic/estate/gemini-monad.ts' 2>/dev/null || true
pkill -f 'bun run /home/toxic/estate/gemini-mcp.ts' 2>/dev/null || true
pkill -f '/home/toxic/estate/ranch/doorbell/src/index.ts' 2>/dev/null || true
fuser -k "${PORT}/tcp" 2>/dev/null || true
wait_port_free "$PORT" 90

echo "cold start: doorbell-mcp"
if [ -x ./bin/pitchfork-start ]; then
  ./bin/pitchfork-start doorbell-mcp
else
  pitchfork start doorbell-mcp
fi

ok=0
for i in $(seq 1 40); do
  if curl -fsS "http://127.0.0.1:${PORT}/health" >/tmp/doorbell-health.json 2>/dev/null; then ok=1; break; fi
  sleep 0.5
done
[ "$ok" = 1 ] || { echo "FAIL: /health — pitchfork logs doorbell-mcp"; exit 1; }
echo "=== health ==="; cat /tmp/doorbell-health.json; echo
curl -fsS "http://127.0.0.1:${PORT}/sessions" | head -c 2000; echo

prove_path() {
  local path="$1"
  local code
  code=$(curl -sS -o /dev/null -w '%{http_code}' -X OPTIONS "http://127.0.0.1:${PORT}${path}" || echo "000")
  if [ "$code" = "000" ] || [ "$code" = "404" ]; then
    code=$(curl -sS -o /dev/null -w '%{http_code}' -N --max-time 2 "http://127.0.0.1:${PORT}${path}" || true)
  fi
  echo "path ${path} → HTTP ${code}"
  case "$code" in
    200|204|202|400|401|405|408|000) return 0 ;;
    *) echo "WARN: unexpected status for ${path}: ${code}"; return 0 ;;
  esac
}
prove_path "/doorbell-mcp"
prove_path "/gemini-mcp"

echo
echo "Sure. Pitchfork owns doorbell-mcp/:${PORT}."
echo "  Primary HTTP path : /doorbell-mcp"
echo "  Compat HTTP path  : /gemini-mcp  (same process; old daemon name removed)"
echo "  Tailscale         : path /gemini-mcp stays as-is (this script does NOT change Tailscale serve)."
echo "  Preferred public  : /doorbell-mcp (add a Tailscale serve path later if desired; do not remove the old one)."
echo "Safe to close this terminal."
