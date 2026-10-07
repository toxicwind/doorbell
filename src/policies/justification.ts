/** G — JustificationPolicy: request_upgrade path (default disabled) */
import { parseTier } from "../config.ts";
import type { TierPolicy } from "./types.ts";

export const JustificationPolicy: TierPolicy = {
  name: "Justification",
  enabled(ws, cfg) {
    return cfg.policies.Justification === true;
  },
  onCall(ctx, toolName, args) {
    if (toolName !== "request_upgrade") return null;
    const target = parseTier(String(args.target_tier || ""));
    const reason = String(args.reason || "").trim();
    if (!target || reason.length < 8) return null;
    // Accept upgrade with justification
    return target;
  },
};
