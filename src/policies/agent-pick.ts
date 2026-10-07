/** A — AgentPickPolicy: expose select_tier; sells router as recommended */
import type { TierPolicy } from "./types.ts";

export const AgentPickPolicy: TierPolicy = {
  name: "AgentPick",
  enabled(ws, cfg) {
    return cfg.policies.AgentPick !== false;
  },
  // Does not set initialTier — agent chooses via select_tier
  initialTier() {
    return null;
  },
  exposeSelectTier() {
    return true;
  },
};
