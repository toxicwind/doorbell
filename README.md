# ranch/doorbell

Shared MCP helper door for **xai/** and **spark/** workspaces (never symlinked to each other).

| Process | Port | Role |
|---------|------|------|
| monad (`src/index.ts`) | **25204** | tier policies, sessions, tools |
| edge (`src/edge.ts`) | **25202** | public proxy → monad |

## Start (background — returns immediately)

```bash
cd /home/toxic/estate/ranch/doorbell
cp -n .env.example .env   # set MCPPROXY_API_KEY from ~/.secrets
bun install
bun run start:bg          # nohup monad + edge; pids in ~/.doorbell/
# stop: bun run stop:bg
curl -s localhost:25202/health; curl -s localhost:25204/health
curl -s localhost:25202/sessions
```

## Curl install

```bash
curl -fsSL https://raw.githubusercontent.com/toxicwind/doorbell/main/install.sh | bash
```

Estate symlinks: `gemini-monad.ts` → monad, `gemini-mcp-hono.ts` → edge.
