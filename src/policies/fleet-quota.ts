/** E — FleetQuotaPolicy: cap concurrent full/classified (default disabled) */
import type { TierPolicy } from "./types.ts";

let fullCount = 0;

export function noteFleetTier(tier: string | null, prev: string | null) {
  if (prev === "full" || prev === "classified") fullCount = Math.max(0, fullCount - 1);
  if (tier === "full" || tier === "classified") fullCount++;
}

export const FleetQuotaPolicy: TierPolicy = {
  name: "FleetQuota",
  enabled(ws, cfg) {
    return cfg.policies.FleetQuota === true;
  },
  initialTier() {
    const max = parseInt(process.env.DOORBELL_FLEET_FULL_MAX || "8", 10);
    if (fullCount >= max) return "router";
    return null;
  },
  onCall(ctx, toolName, args) {
    if (toolName !== "select_tier") return null;
    const max = parseInt(process.env.DOORBELL_FLEET_FULL_MAX || "8", 10);
    const requested = String(args.tier || "");
    if ((requested === "full" || requested === "classified") && fullCount >= max) {
      return "router";
    }
    return null;
  },
};
