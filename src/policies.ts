/**
 * Composable TierPolicy chain — fixed order I→F→D→B→A→C→G→E→H.
 * First non-null initialTier wins; exposeSelectTier OR'd; afterResolve all;
 * onCall first override wins; each toggleable per workspace.
 * No silent full → unresolved initialTier becomes "router".
 */
import type { TierName, TierSource, WorkspaceConfig, WorkspaceId } from "./config.ts";
import type { Effect } from "./effects.ts";
import { pure, setTier } from "./effects.ts";
import { AgentPickPolicy } from "./policies/agent-pick.ts";
import { AgentRenegotiatePolicy } from "./policies/agent-renegotiate.ts";
import { ContextHeuristicPolicy } from "./policies/context-heuristic.ts";
import { EphemeralTTLPolicy } from "./policies/ephemeral-ttl.ts";
import { FleetQuotaPolicy } from "./policies/fleet-quota.ts";
import { JustificationPolicy } from "./policies/justification.ts";
import { OperatorSeedPolicy } from "./policies/operator-seed.ts";
import type { PolicyCtx, TierPolicy } from "./policies/types.ts";
import { WorkspaceDefinedPolicy } from "./policies/workspace-defined.ts";
import { WorkspacePinnedPolicy } from "./policies/workspace-pinned.ts";

export type { PolicyCtx, TierPolicy };

/** Fixed chain order per brief § policies A–I */
export const POLICY_CHAIN: TierPolicy[] = [
  WorkspaceDefinedPolicy, // I
  WorkspacePinnedPolicy, // F
  ContextHeuristicPolicy, // D
  OperatorSeedPolicy, // B
  AgentPickPolicy, // A
  AgentRenegotiatePolicy, // C
  JustificationPolicy, // G
  FleetQuotaPolicy, // E
  EphemeralTTLPolicy, // H
];

export interface PolicyResolution {
  initialTier: TierName;
  tierSource: TierSource;
  exposeSelectTier: boolean;
  after: Array<(ctx: PolicyCtx, tier: TierName) => Effect<void> | void>;
}

export function resolvePolicies(ctx: PolicyCtx): PolicyResolution {
  let initialTier: TierName | null = null;
  let tierSource: TierSource = "fallback-router";
  let exposeSelectTier = false;
  const after: PolicyResolution["after"] = [];

  for (const p of POLICY_CHAIN) {
    if (!p.enabled(ctx.workspace, ctx.config)) continue;
    if (initialTier == null && p.initialTier) {
      const t = p.initialTier(ctx);
      if (t != null) {
        initialTier = t;
        tierSource = p.name;
      }
    }
    if (p.exposeSelectTier?.(ctx)) exposeSelectTier = true;
    if (p.afterResolve) after.push(p.afterResolve.bind(p));
  }

  // Deadlock / silent-full guard: never default to full
  if (initialTier == null) {
    initialTier = "router";
    tierSource = "fallback-router";
  }

  return { initialTier, tierSource, exposeSelectTier, after };
}

export function applyOnCallOverride(
  ctx: PolicyCtx,
  toolName: string,
  args: Record<string, unknown>,
): { tier: TierName; source: TierSource } | null {
  for (const p of POLICY_CHAIN) {
    if (!p.enabled(ctx.workspace, ctx.config)) continue;
    const t = p.onCall?.(ctx, toolName, args);
    if (t != null) return { tier: t, source: p.name };
  }
  return null;
}

export function runAfterResolve(
  ctx: PolicyCtx,
  tier: TierName,
  hooks: PolicyResolution["after"],
): Effect<void> {
  let eff: Effect<void> = pure(undefined);
  for (const h of hooks) {
    const r = h(ctx, tier);
    if (r && typeof (r as Effect<void>).run === "function") {
      const next = r as Effect<void>;
      const prev = eff;
      eff = {
        _tag: "Effect",
        run: async (env, state) => {
          const a = await prev.run(env, state);
          return next.run(env, a.state);
        },
      };
    }
  }
  return eff;
}

export function initialSetTierEffect(res: PolicyResolution): Effect<void> {
  return setTier(res.initialTier, res.tierSource);
}

export function enabledPolicyNames(ws: WorkspaceId, cfg: WorkspaceConfig): string[] {
  return POLICY_CHAIN.filter((p) => p.enabled(ws, cfg)).map((p) => p.name);
}
