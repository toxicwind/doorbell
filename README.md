# doorbell

Shared MCP monad for the estate (`ranch/doorbell`). Catalog is truth; tiers are views.

```
Spark/xAI → doorbell :25202 (JSON-RPC+SSE) → gatehouse :25127 → MCP servers
```

## Install on the estate host

```bash
curl -fsSL https://raw.githubusercontent.com/toxicwind/doorbell/main/install.sh | bash
cd /home/toxic/estate/ranch/doorbell
# set MCPPROXY_API_KEY in .env (from ~/.secrets)
bun install && bun run start
curl -s localhost:25202/health
curl -s localhost:25202/sessions
```

Or unpack only:

```bash
curl -fsSL https://raw.githubusercontent.com/toxicwind/doorbell/main/doorbell.tar.gz.b64 | base64 -d | tar -xz -C /home/toxic/estate/ranch/doorbell
```

## Policies

Chain I→F→D→B→A→C→G→E→H. Unresolved → **router** (never silent full).
