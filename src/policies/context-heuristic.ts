/** D — ContextHeuristicPolicy: spark→minimal, xai→full */
import type { TierPolicy } from "./types.ts";

export const ContextHeuristicPolicy: TierPolicy = {
  name: "ContextHeuristic",
  enabled(ws, cfg) {
    return cfg.policies.ContextHeuristic !== false;
  },
  initialTier(ctx) {
    if (ctx.workspace === "spark") return "minimal";
    if (ctx.workspace === "xai") return "full";
    return null;
  },
};
