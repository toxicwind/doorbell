# Install

## Requirements

- Bun ≥ 1.1 (`bun --version`)
- Optional: paru only if Bun is missing on Arch (`paru -S bun-bin`)

## Steps

```bash
cd ranch/doorbell
cp .env.example .env
# set MCPPROXY_API_KEY and upstream URLs
bun run check
```

### Run

```bash
set -a; source .env; set +a
bun run start:monad &
bun run start:edge &
```
