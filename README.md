# doorbell

HTTP MCP door on port 25202. v7. One initialize returns the router catalog.

`/doorbell-mcp` is the primary path. `/gemini-mcp` is the same handlers. Upstream is gatehouse at `GATEHOUSE_URL` (default `http://127.0.0.1:25127/mcp`).

## Tools

The first response is the router surface. `select_tier` is optional. It is not a gate.

| Tool | Job |
|---|---|
| call_read | dispatch a read-only tool |
| call_write | dispatch a write or read tool |
| call_destructive | dispatch any tool, requires confirm |
| list_routes | names on the upstream surface |
| route | dispatch any upstream tool |
| select_tier | optional view change: full, router, classified, minimal, auto |

Unresolved policies stay on router. There is no weird-tier list.

## Install

Source in this repo is the tree. The tarball is the same tree, for the host script.

```bash
curl -fsSL https://raw.githubusercontent.com/toxicwind/doorbell/main/host-install/repull.sh | bash
```

That pulls `main` into `/home/toxic/estate/ranch/doorbell` and cold-starts `doorbell-mcp` under mise. It does not unpack the tarball and it does not call pitchfork-restart.

## Layout

- `src/index.ts` — HTTP entry
- `src/session.ts` — initialize, tools/list, tools/call
- `src/surfaces.ts` — tier views
- `src/catalog.ts` — gatehouse pool
- `host-install/v7-fix.sh` — yote unpack and restart
