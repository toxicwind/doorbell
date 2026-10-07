/** F — WorkspacePinnedPolicy: config.json pinnedTier */
import type { TierPolicy } from "./types.ts";

export const WorkspacePinnedPolicy: TierPolicy = {
  name: "WorkspacePinned",
  enabled(ws, cfg) {
    return cfg.policies.WorkspacePinned !== false;
  },
  initialTier(ctx) {
    return ctx.config.pinnedTier;
  },
};
