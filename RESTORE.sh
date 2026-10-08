#!/usr/bin/env bash
set -euo pipefail
ESTATE="${ESTATE:-/home/toxic/estate}"
cd "$ESTATE"
restore_one() {
  local live="$1"
  if [ -L "$live" ] || [ -e "$live" ]; then rm -f "$live"; fi
  if [ -f "${live}.orig" ]; then cp -a "${live}.orig" "$live"; echo "restored $live from .orig"
  elif [ -f "${live}.pre-mod" ]; then cp -a "${live}.pre-mod" "$live"; echo "restored $live from .pre-mod"
  else echo "NO_BACKUP for $live" >&2; return 1; fi
}
restore_one gemini-monad.ts
restore_one gemini-mcp-hono.ts
pkill -f 'bun run /home/toxic/estate/gemini-monad.ts' 2>/dev/null || true
pkill -f 'bun run .*doorbell-monad' 2>/dev/null || true
sleep 1
nohup bun run "$ESTATE/gemini-monad.ts" >>/tmp/doorbell-monad.restore.log 2>&1 &
echo "restarted monad pid $!"
sleep 1
ss -tlnp 2>/dev/null | grep -E '2520[24]' || true
echo RESTORE_DONE
