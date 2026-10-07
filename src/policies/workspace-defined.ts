/** I — WorkspaceDefinedPolicy: workspace.json default_tier */
import type { TierPolicy } from "./types.ts";

export const WorkspaceDefinedPolicy: TierPolicy = {
  name: "WorkspaceDefined",
  enabled(ws, cfg) {
    return cfg.policies.WorkspaceDefined !== false;
  },
  initialTier(ctx) {
    return ctx.config.defaultTier;
  },
};
