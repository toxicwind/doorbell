/** H — EphemeralTTLPolicy: TTL for full/classified → demote to router */
import { setTier, type Effect, pure } from "../effects.ts";
import type { TierPolicy } from "./types.ts";

export const EphemeralTTLPolicy: TierPolicy = {
  name: "EphemeralTTL",
  enabled(ws, cfg) {
    return cfg.policies.EphemeralTTL !== false;
  },
  afterResolve(ctx, tier): Effect<void> | void {
    if (tier !== "full" && tier !== "classified") return;
    // Caller sets ephemeralExpiresAt from config.ephemeralTtlMs
    return pure(undefined);
  },
  onCall(ctx) {
    // Demotion handled in session tick via ephemeralExpiresAt
    return null;
  },
};

export function demoteIfExpired(
  tier: string | null,
  expiresAt: number | null,
  now: number,
): Effect<void> | null {
  if (!expiresAt || now < expiresAt) return null;
  if (tier !== "full" && tier !== "classified") return null;
  return setTier("router", "EphemeralTTL");
}
