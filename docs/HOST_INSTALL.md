# Host install

## Pitchfork (preferred on estate)

Primary daemon: **doorbell-mcp** on `:25202`. HTTP `/doorbell-mcp` is primary; `/gemini-mcp` is a backwards-compat alias on the same process. Scripts never change Tailscale serve.

```bash
curl -fsSL https://raw.githubusercontent.com/toxicwind/doorbell/main/host-install/fix-secrets-newlines.sh | bash
curl -fsSL https://raw.githubusercontent.com/toxicwind/doorbell/main/host-install/pitchfork-takeover.sh | bash
```

Takeover syncs the full tree from `doorbell.tar.gz.b64` into `/home/toxic/estate/ranch/doorbell` when incomplete (so `src/index.ts` + `host-install/` exist), writes `pitchfork.d/doorbell-mcp.toml`, removes the old `gemini-mcp` daemon stanza (same port), then cold `pitchfork stop` → wait for TIME_WAIT drain → `pitchfork start doorbell-mcp` (never `pitchfork-restart`, which is always hot/staging), and proves `/health`, `/doorbell-mcp`, and `/gemini-mcp`.

## Manual / curl tree install

```bash
curl -fsSL https://raw.githubusercontent.com/toxicwind/doorbell/main/install.sh | bash
# or locally:
cd /home/toxic/estate/ranch/doorbell
cp -n .env.example .env
bun install && bun run start:bg
curl -s http://127.0.0.1:25202/health | jq .
curl -s http://127.0.0.1:25202/sessions | jq .
```

Foreground (debug only): `bun run ./src/index.ts` (listens on `MONAD_PORT`, default 25202).
