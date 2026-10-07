/** C — AgentRenegotiatePolicy: allow select_tier after settle (default off) */
import type { TierPolicy } from "./types.ts";

export const AgentRenegotiatePolicy: TierPolicy = {
  name: "AgentRenegotiate",
  enabled(ws, cfg) {
    return cfg.policies.AgentRenegotiate === true;
  },
  exposeSelectTier(ctx) {
    // Keep select_tier visible even after a tier is set
    return ctx.currentTier != null;
  },
};
