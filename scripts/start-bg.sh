#!/usr/bin/env bash
# Start monad (:25204) + edge (:25202) in background; returns immediately.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
[ -f .env ] && set -a && source .env && set +a
if [ -f "${HOME}/.secrets" ]; then set -a; # shellcheck disable=SC1091
  source "${HOME}/.secrets" || true; set +a; fi
if [ -z "${MCPPROXY_API_KEY:-}" ] && [ -f /home/toxic/estate/.env ]; then
  set -a; source /home/toxic/estate/.env || true; set +a
fi
export MONAD_PORT="${MONAD_PORT:-25204}"
export EDGE_PORT="${EDGE_PORT:-25202}"
export MONAD_URL="${MONAD_URL:-http://127.0.0.1:${MONAD_PORT}}"
mkdir -p "${HOME}/.doorbell"

stop_pid() {
  local f="$1"
  if [ -f "$f" ]; then
    kill "$(cat "$f")" 2>/dev/null || true
    rm -f "$f"
  fi
}
stop_pid "${HOME}/.doorbell/monad.pid"
stop_pid "${HOME}/.doorbell/edge.pid"
for port in "$MONAD_PORT" "$EDGE_PORT"; do
  fuser -k "${port}/tcp" 2>/dev/null || true
done
sleep 0.4

nohup bun run ./src/index.ts >> "${HOME}/.doorbell/monad.log" 2>&1 &
echo $! > "${HOME}/.doorbell/monad.pid"
nohup bun run ./src/edge.ts >> "${HOME}/.doorbell/edge.log" 2>&1 &
echo $! > "${HOME}/.doorbell/edge.pid"

echo "monad pid=$(cat "${HOME}/.doorbell/monad.pid") :${MONAD_PORT}"
echo "edge  pid=$(cat "${HOME}/.doorbell/edge.pid") :${EDGE_PORT}"
echo "logs: ~/.doorbell/monad.log ~/.doorbell/edge.log"
echo "prove: curl -s localhost:${EDGE_PORT}/health; curl -s localhost:${MONAD_PORT}/health; curl -s localhost:${EDGE_PORT}/sessions"
