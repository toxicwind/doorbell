/** Runtime config — secrets only from env */
export const PORT = parseInt(process.env.MONAD_PORT || "25204", 10);
export const GATEHOUSE = process.env.GATEHOUSE_URL || "http://127.0.0.1:25127/mcp";
export const KEY = process.env.MCPPROXY_API_KEY || "";
export const ISSUER = process.env.PUBLIC_ISSUER || "https://github-mcp-host.tailc9ac71.ts.net";
export const EDGE_PORT = parseInt(process.env.EDGE_PORT || "25202", 10);
export const MONAD_URL = process.env.MONAD_URL || "http://127.0.0.1:25204";
