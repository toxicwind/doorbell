# Entrypoints

| Live estate path | Symlink target |
|------------------|----------------|
| `/home/toxic/estate/gemini-monad.ts` | `ranch/doorbell/xai/gemini-monad.ts` → `doorbell-monad.ts` → `src/` |
| `/home/toxic/estate/gemini-mcp-hono.ts` | `ranch/doorbell/xai/gemini-mcp-hono.ts` → `doorbell-edge.ts` |

Public names: **`doorbell-monad.ts`**, **`doorbell-edge.ts`**.  
`gemini-*.ts` wrappers exist only so existing symlink/process names keep working.
