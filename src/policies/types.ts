import type { TierName, TierSource, WorkspaceConfig, WorkspaceId } from "../config.ts";
import type { Effect } from "../effects.ts";
import type { McpTool } from "../catalog.ts";

export interface PolicyCtx {
  workspace: WorkspaceId;
  config: WorkspaceConfig;
  agentId: string;
  role: string;
  clientInfoName?: string;
  catalog: McpTool[];
  currentTier: TierName | null;
  tierSource: TierSource;
  seedTier?: TierName | null;
}

export interface TierPolicy {
  name: TierSource;
  enabled(ws: WorkspaceId, cfg: WorkspaceConfig): boolean;
  initialTier?(ctx: PolicyCtx): TierName | null;
  exposeSelectTier?(ctx: PolicyCtx): boolean;
  afterResolve?(ctx: PolicyCtx, tier: TierName): Effect<void> | void;
  onCall?(ctx: PolicyCtx, toolName: string, args: Record<string, unknown>): TierName | null;
}
