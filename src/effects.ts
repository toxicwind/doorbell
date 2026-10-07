/**
 * Effect algebra: ReaderT Env / StateT State / IO (Free Op).
 * Tier mutations only via SetTier interpreted here.
 */
import type { TierName, TierSource, WorkspaceId } from "./config.ts";

export interface Env {
  workspace: WorkspaceId;
  now: () => number;
}

export interface SessionSnapshot {
  sessionId: string;
  agentId: string;
  workspace: WorkspaceId;
  profile: string;
  tier: TierName | null;
  tierSource: TierSource;
  exposeSelectTier: boolean;
  autoTierPending: boolean;
  gateSid: string | null;
  catalogCount: number;
  createdAt: number;
  lastUsed: number;
  ephemeralExpiresAt: number | null;
}

export type Op =
  | { _tag: "Pure"; value: unknown }
  | { _tag: "SetTier"; tier: TierName; source: TierSource }
  | { _tag: "SetExposeSelectTier"; value: boolean }
  | { _tag: "SetAutoPending"; value: boolean }
  | { _tag: "PromoteGateSid"; sid: string }
  | { _tag: "BroadcastListChanged" }
  | { _tag: "Touch"; at: number }
  | { _tag: "SetEphemeralExpiry"; at: number | null }
  | { _tag: "Seq"; left: Op; right: Op };

export type Effect<A> = {
  _tag: "Effect";
  run: (env: Env, state: MutableState) => Promise<{ state: MutableState; value: A }>;
};

export interface MutableState {
  tier: TierName | null;
  tierSource: TierSource;
  exposeSelectTier: boolean;
  autoTierPending: boolean;
  gateSid: string | null;
  lastUsed: number;
  ephemeralExpiresAt: number | null;
  pendingBroadcast: boolean;
}

export const pure = <A>(value: A): Effect<A> => ({
  _tag: "Effect",
  run: async (_env, state) => ({ state, value }),
});

export const flatMap = <A, B>(fa: Effect<A>, f: (a: A) => Effect<B>): Effect<B> => ({
  _tag: "Effect",
  run: async (env, state) => {
    const r = await fa.run(env, state);
    return f(r.value).run(env, r.state);
  },
});

export const map = <A, B>(fa: Effect<A>, f: (a: A) => B): Effect<B> =>
  flatMap(fa, (a) => pure(f(a)));

export const ask: Effect<Env> = {
  _tag: "Effect",
  run: async (env, state) => ({ state, value: env }),
};

export const get: Effect<MutableState> = {
  _tag: "Effect",
  run: async (_env, state) => ({ state, value: { ...state } }),
};

export const liftIO = <A>(io: () => Promise<A>): Effect<A> => ({
  _tag: "Effect",
  run: async (_env, state) => ({ state, value: await io() }),
});

export const op = (o: Op): Effect<void> => ({
  _tag: "Effect",
  run: async (_env, state) => {
    const next = { ...state };
    switch (o._tag) {
      case "Pure":
        break;
      case "SetTier":
        next.tier = o.tier;
        next.tierSource = o.source;
        next.autoTierPending = o.tier === "auto";
        next.pendingBroadcast = true;
        break;
      case "SetExposeSelectTier":
        next.exposeSelectTier = o.value;
        break;
      case "SetAutoPending":
        next.autoTierPending = o.value;
        break;
      case "PromoteGateSid":
        // atomic promotion — only replace when provided
        if (o.sid) next.gateSid = o.sid;
        break;
      case "BroadcastListChanged":
        next.pendingBroadcast = true;
        break;
      case "Touch":
        next.lastUsed = o.at;
        break;
      case "SetEphemeralExpiry":
        next.ephemeralExpiresAt = o.at;
        break;
      case "Seq":
        await op(o.left).run(_env, next);
        await op(o.right).run(_env, next);
        break;
    }
    return { state: next, value: undefined };
  },
});

export const setTier = (tier: TierName, source: TierSource): Effect<void> =>
  op({ _tag: "SetTier", tier, source });

export const promoteGateSid = (sid: string): Effect<void> =>
  op({ _tag: "PromoteGateSid", sid });

export const broadcastListChanged = (): Effect<void> =>
  op({ _tag: "BroadcastListChanged" });

/** Simple async mutex for SSE broadcast fan-out. */
export class Mutex {
  private chain: Promise<void> = Promise.resolve();
  run<T>(fn: () => Promise<T>): Promise<T> {
    const next = this.chain.then(fn, fn);
    this.chain = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
  }
}

export const sseMutex = new Mutex();
