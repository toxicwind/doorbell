#!/usr/bin/env bash
set -euo pipefail
for f in "${HOME}/.doorbell/monad.pid" "${HOME}/.doorbell/edge.pid"; do
  if [ -f "$f" ]; then
    kill "$(cat "$f")" 2>/dev/null || true
    rm -f "$f"
  fi
done
for port in "${MONAD_PORT:-25204}" "${EDGE_PORT:-25202}"; do
  fuser -k "${port}/tcp" 2>/dev/null || true
done
echo "stopped doorbell monad+edge"
