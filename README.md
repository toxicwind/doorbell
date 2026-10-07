# ranch/doorbell

Shared MCP helper door for **xai/** and **spark/** workspaces (never symlinked to each other).

| Process | Port | Role |
|---------|------|------|
| doorbell-mcp (`src/index.ts`) | **25202** | MCP + health/sessions (pitchfork daemon) |

> Port **25204** is reserved for awrawr-ws-exec — do not bind it.

## Public HTTP paths

| Path | Role |
|------|------|
| `/doorbell-mcp` | **Primary** MCP endpoint (GET/POST/DELETE + SSE) |
| `/gemini-mcp` | Backwards-compat alias (same handlers) |
| `/health`, `/sessions` | Unscoped root endpoints |

Tailscale may still advertise `/gemini-mcp` — that is fine; the HTTP alias covers it. You can add a Tailscale serve path for `/doorbell-mcp` later without removing the old one.

## Pitchfork takeover (host)

```bash
# 1) secrets newline fix (once)
curl -fsSL https://raw.githubusercontent.com/toxicwind/doorbell/main/host-install/fix-secrets-newlines.sh | bash

# 2) cold-start doorbell-mcp on :25202 (syncs full tree from tarball if incomplete; does NOT touch Tailscale)
curl -fsSL https://raw.githubusercontent.com/toxicwind/doorbell/main/host-install/pitchfork-takeover.sh | bash
```

Daemon name is **doorbell-mcp**. The old **gemini-mcp** daemon stanza is removed so :25202 is not double-bound; HTTP `/gemini-mcp` remains on the same process.

## Start (local / background)

```bash
cd /home/toxic/estate/ranch/doorbell
cp -n .env.example .env   # set MCPPROXY_API_KEY from ~/.secrets
bun install
bun run start:bg          # nohup; pids in ~/.doorbell/
# stop: bun run stop:bg
curl -s localhost:25202/health
curl -s localhost:25202/sessions
```

Estate symlink: `gemini-monad.ts` → doorbell (compat name).
