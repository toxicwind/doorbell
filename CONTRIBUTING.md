# Contributing

1. Edit `xai/src/` (or `spark/`) — not live estate root files.
2. `bun run check` before cutover.
3. Grok detection is fail-closed; non-Grok clients must see `select_tier` only.
4. Never commit `.env`, `*.orig`, or `*.pre-mod`.
5. On host prove failure, run `./RESTORE.sh`.
