/** B — OperatorSeedPolicy: DOORBELL_SEED_TIER / POST /tier/seed */
import { parseTier } from "../config.ts";
import type { TierPolicy } from "./types.ts";

export const OperatorSeedPolicy: TierPolicy = {
  name: "OperatorSeed",
  enabled(ws, cfg) {
    if (cfg.policies.OperatorSeed === true) return true;
    return Boolean(process.env.DOORBELL_SEED_TIER);
  },
  initialTier(ctx) {
    if (ctx.seedTier) return ctx.seedTier;
    return parseTier(process.env.DOORBELL_SEED_TIER || "");
  },
};
