/**
 * doorbell-monad — v6.0 EXTENDED MAXIMAL MONADIC
 *
 * Sheaf-theoretic, operadic, coalgebraic, session-typed, Petri-net-driven,
 * membrane-computing, ZX-calculus-simplified, topos-internal,
 * geometry-of-interaction-feedback, realizability-extracted,
 * choreographically-programmed, cascade-aware, DyTopo-routed,
 * alphaXiv-augmented, emergent-tier-resolving, monadic multi-agent MCP router.
 *
 * Target: MCP 2026-07-28 (stateless, server/discover, subscriptions/listen)
 */

import { randomBytes } from "crypto";
import { isGrokClient, bootGrokFullTier } from "./grok-boot.ts";

// ═══════════════════════════════════════════════════════════════════════════════
// EFFECT MONAD — Task[F] with lawful flatMap / attempt / raiseError
// ═══════════════════════════════════════════════════════════════════════════════

type Task<A> = () => Promise<A>;
const pure = <A>(a: A): Task<A> => async () => a;
const flatMap = <A, B>(fa: Task<A>, f: (a: A) => Task<B>): Task<B> =>
  async () => f(await fa())();
const map = <A, B>(fa: Task<A>, f: (a: A) => B): Task<B> =>
  flatMap(fa, (a) => pure(f(a)));
const raiseError = <A>(e: MonadError): Task<A> =>
  async () => { throw e; };
const attempt = <A>(fa: Task<A>): Task<Either<MonadError, A>> =>
  async () => {
    try { return { _tag: "Right", value: await fa() }; }
    catch (e: any) { return { _tag: "Left", error: { code: -32000, message: e.message } }; }
  };

interface MonadError { code: number; message: string; data?: unknown; }
type Either<E, A> = { _tag: "Left"; error: E } | { _tag: "Right"; value: A };

// ═══════════════════════════════════════════════════════════════════════════════
// ADTs — Tier, ToolClass, AgentRole, VoT topology
// ═══════════════════════════════════════════════════════════════════════════════

type Tier =
  | { _tag: "Full" } | { _tag: "Router" } | { _tag: "Classified" }
  | { _tag: "Minimal" } | { _tag: "Sheaf" } | { _tag: "Operad" }
  | { _tag: "Coalgebra" } | { _tag: "Session" } | { _tag: "Petri" }
  | { _tag: "Membrane" } | { _tag: "ZX" } | { _tag: "Topos" }
  | { _tag: "GoI" } | { _tag: "Realizability" } | { _tag: "Choreography" }
  | { _tag: "Cascade" } | { _tag: "DyTopo" } | { _tag: "Research" }
  | { _tag: "Emergent"; topology: VoT } | { _tag: "Auto" };

type VoT = "R" | "C" | "H" | "O";  // Reals, Complex, Quaternions, Octonions
type ToolClass = "read" | "write" | "destructive" | "admin";
type AgentRole = "researcher" | "implementer" | "reviewer" | "orchestrator"
  | "observer" | "admin" | "sheaf-keeper" | "petri-master" | "membrane-warden";

const TIER_NAMES: string[] = [
  "full","router","classified","minimal","sheaf","operad","coalgebra",
  "session","petri","membrane","zx","topos","goi","realizability",
  "choreography","cascade","dytopo","research","emergent","auto"
];

const tierName = (t: Tier): string =>
  t._tag === "Emergent" ? `emergent:${t.topology}` : t._tag.toLowerCase();

const parseTier = (s: string, topology?: VoT): Tier | null => {
  const map: Record<string, Tier> = {
    full: { _tag: "Full" }, router: { _tag: "Router" },
    classified: { _tag: "Classified" }, minimal: { _tag: "Minimal" },
    sheaf: { _tag: "Sheaf" }, operad: { _tag: "Operad" },
    coalgebra: { _tag: "Coalgebra" }, session: { _tag: "Session" },
    petri: { _tag: "Petri" }, membrane: { _tag: "Membrane" },
    zx: { _tag: "ZX" }, topos: { _tag: "Topos" }, goi: { _tag: "GoI" },
    realizability: { _tag: "Realizability" }, choreography: { _tag: "Choreography" },
    cascade: { _tag: "Cascade" }, dytopo: { _tag: "DyTopo" },
    research: { _tag: "Research" }, auto: { _tag: "Auto" },
  };
  if (s === "emergent") return { _tag: "Emergent", topology: topology ?? "O" };
  return map[s] ?? null;
};

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIG
// ═══════════════════════════════════════════════════════════════════════════════

const PORT = parseInt(process.env.MONAD_PORT || "25204", 10);
const GATEHOUSE = process.env.GATEHOUSE_URL || "http://127.0.0.1:25127/mcp";
const KEY = process.env.MCPPROXY_API_KEY || "";
const ISSUER = process.env.PUBLIC_ISSUER || "https://github-mcp-host.tailc9ac71.ts.net";
const ALPHAXIV_MCP = process.env.ALPHAXIV_MCP_URL || "https://api.alphaxiv.org/mcp/v1";
const SIGMA_GUARD_URL = process.env.SIGMA_GUARD_URL || "http://127.0.0.1:25210/mcp";
const SHEAF_PROXY_URL = process.env.SHEAF_PROXY_URL || "http://127.0.0.1:25211/mcp";
const ZX_MCP_URL = process.env.ZX_MCP_URL || "http://127.0.0.1:25212/mcp";
const PETRI_PILOT_URL = process.env.PETRI_PILOT_URL || "http://127.0.0.1:25213/mcp";
const SHEAF_AI_URL = process.env.SHEAF_AI_URL || "http://127.0.0.1:25214/mcp";

const SESSION_TTL_MS = 60 * 60 * 1000;
const SWEEP_INTERVAL_MS = 5 * 60 * 1000;
const MAX_AGENT_SESSIONS = 500;
const MAX_POOL_ENTRIES = 64;

// ═══════════════════════════════════════════════════════════════════════════════
// SHEAF CONSISTENCY — cellular sheaf cohomology for agent state verification
// Inspired by SIGMA Guard: H¹ surfaces contradictions no local fix resolves.
// A sheaf F on the agent graph assigns to each agent a stalk F(a); to each
// edge a→b a restriction map ρ_{a→b}: F(a) → F(b). Global consistency is the
// gluing axiom: local sections must agree on overlaps. H⁰ is the space of
// global sections; H¹ is the obstruction to gluing.
// ═══════════════════════════════════════════════════════════════════════════════

interface SheafStalk { agentId: string; claims: Map<string, unknown>; }
interface SheafEdge { from: string; to: string; restriction: (x: unknown) => unknown; }

class CellularSheaf {
  private stalks = new Map<string, SheafStalk>();
  private edges: SheafEdge[] = [];

  addStalk(agentId: string, initial?: Map<string, unknown>) {
    this.stalks.set(agentId, { agentId, claims: initial ?? new Map() });
  }

  addEdge(from: string, to: string, restriction: (x: unknown) => unknown) {
    this.edges.push({ from, to, restriction });
  }

  setClaim(agentId: string, key: string, value: unknown) {
    const s = this.stalks.get(agentId);
    if (!s) throw new Error(`no stalk for agent ${agentId}`);
    s.claims.set(key, value);
  }

  getClaim(agentId: string, key: string): unknown {
    return this.stalks.get(agentId)?.claims.get(key);
  }

  /**
   * Compute H⁰ (global sections) and H¹ (obstruction).
   * Returns { h0: Map<key, value>, h1: string[] }.
   * If h1 is non-empty, the local claims cannot glue into a single global
   * assignment — the router must refuse the operation or park it for human
   * release (sheaf-mcp-proxy inline hard-halt pattern).
   */
  cohomology(): { h0: Map<string, unknown>; h1: string[] } {
    const h1: string[] = [];
    const h0 = new Map<string, unknown>();
    // Collect all keys
    const keys = new Set<string>();
    for (const s of this.stalks.values()) for (const k of s.claims.keys()) keys.add(k);
    // For each key, check edge restrictions
    for (const key of keys) {
      const values = new Map<string, unknown>();
      for (const [agentId, s] of this.stalks) {
        if (s.claims.has(key)) values.set(agentId, s.claims.get(key));
      }
      // Check all edges
      for (const e of this.edges) {
        const a = values.get(e.from), b = values.get(e.to);
        if (a === undefined || b === undefined) continue;
        const restricted = e.restriction(a);
        if (JSON.stringify(restricted) !== JSON.stringify(b)) {
          h1.push(`H¹ obstruction on key "${key}" across edge ${e.from}→${e.to}: ` +
            `${JSON.stringify(restricted)} ≠ ${JSON.stringify(b)}`);
        }
      }
      // If no obstruction, the first value becomes the global section
      const first = values.values().next().value;
      if (first !== undefined && !h1.some(h => h.includes(`"${key}"`))) {
        h0.set(key, first);
      }
    }
    return { h0, h1 };
  }

  agents(): string[] { return [...this.stalks.keys()]; }
}

// ═══════════════════════════════════════════════════════════════════════════════
// OPERAD COMPOSITION — tool calls as operadic operations with substitution
// An operad O has objects O(n) for each arity n, with composition maps
// O(n) × O(k₁) × ... × O(kₙ) → O(k₁+...+kₙ), identity, and equivariance.
// Tools are operations; composition is substitution of outputs into inputs.
// ═══════════════════════════════════════════════════════════════════════════════

interface OperadOperation {
  name: string;
  arity: number;
  execute: (inputs: unknown[]) => Task<unknown>;
}

class ToolOperad {
  private ops = new Map<string, OperadOperation>();
  private identity: OperadOperation = {
    name: "id", arity: 1, execute: async (xs) => xs[0],
  };

  register(op: OperadOperation) { this.ops.set(op.name, op); }
  get(name: string): OperadOperation | undefined { return this.ops.get(name); }

  /**
   * Operadic composition: f ∘ (g₁, ..., gₙ).
   * f has arity n; each gᵢ has arity kᵢ; result has arity Σkᵢ.
   * The result feeds the concatenated outputs of the gᵢ into f.
   */
  compose(fName: string, gNames: string[]): OperadOperation {
    const f = this.ops.get(fName);
    if (!f) throw new Error(`unknown operad operation: ${fName}`);
    if (gNames.length !== f.arity) {
      throw new Error(`arity mismatch: ${fName} expects ${f.arity}, got ${gNames.length}`);
    }
    const gs = gNames.map(n => {
      const g = this.ops.get(n);
      if (!g) throw new Error(`unknown operad operation: ${n}`);
      return g;
    });
    const totalArity = gs.reduce((s, g) => s + g.arity, 0);
    return {
      name: `${fName}(${gNames.join(",")})`,
      arity: totalArity,
      execute: async (inputs: unknown[]) => {
        // Split inputs according to each gᵢ's arity
        let offset = 0;
        const gOutputs: unknown[] = [];
        for (const g of gs) {
          const slice = inputs.slice(offset, offset + g.arity);
          gOutputs.push(await g.execute(slice)());
          offset += g.arity;
        }
        return await f.execute(gOutputs)();
      },
    };
  }

  identityOp(): OperadOperation { return this.identity; }
  list(): string[] { return [...this.ops.keys()]; }
}

// ═══════════════════════════════════════════════════════════════════════════════
// COALGEBRA OBSERVATION — agent state as a coalgebra; tier as final coalgebra
// A coalgebra for a functor F is a map X → F(X). For agent observation, we use
// the Moore machine functor: F(X) = O × (I → X). The final coalgebra is the
// set of all observation streams. Tier resolution is coinductive: observe the
// agent's behavior, unfold the coalgebra, and take the largest bisimulation
// class as the tier.
// ═══════════════════════════════════════════════════════════════════════════════

interface CoalgebraObservation<O, I> {
  output: O;
  next: (input: I) => CoalgebraObservation<O, I>;
}

class CoalgebraObserver {
  private histories = new Map<string, string[]>();

  observe(agentId: string, toolName: string, toolClass: ToolClass) {
    const h = this.histories.get(agentId) ?? [];
    h.push(`${toolName}:${toolClass}`);
    this.histories.set(agentId, h);
  }

  /**
   * Coinductive tier inference: the largest bisimulation class of the
   * agent's observation stream determines the tier. If the stream is
   * dominated by reads, the agent is a reader; if destructive calls appear,
   * it is a writer; if admin calls appear, it is an admin.
   */
  inferTier(agentId: string): Tier {
    const h = this.histories.get(agentId) ?? [];
    const classes = h.map(s => s.split(":")[1] as ToolClass);
    if (classes.includes("admin")) return { _tag: "Full" };
    if (classes.includes("destructive")) return { _tag: "Classified" };
    if (classes.includes("write")) return { _tag: "Router" };
    if (classes.length > 0) return { _tag: "Minimal" };
    return { _tag: "Auto" };
  }

  bisimilar(agentA: string, agentB: string): boolean {
    const a = this.histories.get(agentA) ?? [];
    const b = this.histories.get(agentB) ?? [];
    if (a.length !== b.length) return false;
    return a.every((x, i) => x.split(":")[1] === b[i].split(":")[1]);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SESSION TYPE GATE — linear logic / session types for MCP calls
// Based on Classical Processes (CP) and Multiparty Classical Processes (MCP):
// propositions-as-types for classical linear logic; each tool call consumes a
// linear resource; destructive calls are ⊗ (tensor), reads are & (with),
// writes are ⊕ (plus), admin is ! (of course).
// ═══════════════════════════════════════════════════════════════════════════════

type SessionType =
  | { _tag: "Send"; tool: string; cont: SessionType }
  | { _tag: "Recv"; tool: string; cont: SessionType }
  | { _tag: "Choice"; options: SessionType[] }
  | { _tag: "End" };

class SessionTypeGate {
  private sessions = new Map<string, SessionType>();

  open(agentId: string, type: SessionType) { this.sessions.set(agentId, type); }

  /**
   * Consume a tool call against the session type. Returns the continuation
   * or throws if the call is not permitted by the type.
   */
  consume(agentId: string, toolName: string): SessionType {
    let t = this.sessions.get(agentId);
    if (!t) throw new Error(`no session type for agent ${agentId}`);
    while (t._tag === "Choice") {
      // Choose the first option that permits the tool
      const match = t.options.find(o => this.permits(o, toolName));
      if (!match) throw new Error(`tool ${toolName} not permitted by session type`);
      t = match;
    }
    if (t._tag === "Send" && t.tool === toolName) {
      this.sessions.set(agentId, t.cont);
      return t.cont;
    }
    if (t._tag === "Recv" && t.tool === toolName) {
      this.sessions.set(agentId, t.cont);
      return t.cont;
    }
    throw new Error(`tool ${toolName} does not match session type ${JSON.stringify(t)}`);
  }

  private permits(t: SessionType, toolName: string): boolean {
    if (t._tag === "End") return false;
    if (t._tag === "Send" || t._tag === "Recv") return t.tool === toolName;
    if (t._tag === "Choice") return t.options.some(o => this.permits(o, toolName));
    return false;
  }

  /**
   * Build a session type from a tier surface: the sequence of allowed tools.
   */
  static fromSurface(tools: string[]): SessionType {
    let t: SessionType = { _tag: "End" };
    for (let i = tools.length - 1; i >= 0; i--) {
      t = { _tag: "Recv", tool: tools[i], cont: t };
    }
    return t;
  }

  /**
   * Multiparty session: interleave choices for multi-agent coordination.
   * This is the MCP (Multiparty Classical Processes) fragment.
   */
  static multiparty(parties: string[][]): SessionType {
    return { _tag: "Choice", options: parties.map(p => SessionTypeGate.fromSurface(p)) };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// PETRI NET ARBITER — concurrent agent access to shared tools
// A Petri net N = (P, T, F, M₀). Places are tool availability tokens;
// transitions are agent tool calls. Firing a transition consumes tokens from
// input places and produces tokens in output places. If insufficient tokens,
// the call is blocked (parked for human release).
// ═══════════════════════════════════════════════════════════════════════════════

interface PetriNet {
  places: Map<string, number>;
  transitions: Map<string, { inputs: string[]; outputs: string[] }>;
}

class PetriNetArbiter {
  private net: PetriNet = { places: new Map(), transitions: new Map() };

  addPlace(name: string, tokens: number) { this.net.places.set(name, tokens); }
  addTransition(name: string, inputs: string[], outputs: string[]) {
    this.net.transitions.set(name, { inputs, outputs });
  }

  /**
   * Attempt to fire a transition. Returns true if fired, false if blocked.
   * This is the enabling condition: every input place must have ≥1 token.
   */
  fire(transitionName: string): boolean {
    const t = this.net.transitions.get(transitionName);
    if (!t) throw new Error(`unknown Petri transition: ${transitionName}`);
    // Check enabling
    for (const p of t.inputs) {
      if ((this.net.places.get(p) ?? 0) < 1) return false;
    }
    // Consume inputs
    for (const p of t.inputs) {
      this.net.places.set(p, (this.net.places.get(p) ?? 0) - 1);
    }
    // Produce outputs
    for (const p of t.outputs) {
      this.net.places.set(p, (this.net.places.get(p) ?? 0) + 1);
    }
    return true;
  }

  marking(): Record<string, number> {
    return Object.fromEntries(this.net.places);
  }

  /**
   * Build a standard arbiter for a set of tools: each tool gets one token;
   * each agent call is a transition that consumes the tool token and
   * produces it back after execution.
   */
  static standard(tools: string[]): PetriNetArbiter {
    const a = new PetriNetArbiter();
    for (const t of tools) {
      a.addPlace(`available:${t}`, 1);
      a.addTransition(`call:${t}`, [`available:${t}`], [`available:${t}`]);
    }
    return a;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// MEMBRANE ROUTER — hierarchical membrane computing for compartmentalized
// cognitive processing. Inspired by P-systems: membranes contain objects and
// rules; objects can cross membranes; membranes can dissolve. Here, tools are
// objects, tiers are membranes, and agents are the rules.
// ═══════════════════════════════════════════════════════════════════════════════

interface Membrane {
  id: string;
  parent: string | null;
  objects: Set<string>;
  rules: MembraneRule[];
}

interface MembraneRule {
  name: string;
  condition: (objects: Set<string>) => boolean;
  action: (objects: Set<string>) => Set<string>;
}

class MembraneRouter {
  private membranes = new Map<string, Membrane>();

  create(id: string, parent: string | null, initial: string[] = []) {
    this.membranes.set(id, {
      id, parent, objects: new Set(initial), rules: [],
    });
  }

  addRule(membraneId: string, rule: MembraneRule) {
    this.membranes.get(membraneId)?.rules.push(rule);
  }

  /**
   * Apply all rules in a membrane whose condition holds. Returns the new
   * object set. This is a single evolution step of the P-system.
   */
  evolve(membraneId: string): Set<string> {
    const m = this.membranes.get(membraneId);
    if (!m) throw new Error(`unknown membrane: ${membraneId}`);
    let objects = new Set(m.objects);
    for (const r of m.rules) {
      if (r.condition(objects)) objects = r.action(objects);
    }
    m.objects = objects;
    return objects;
  }

  /**
   * Dissolve a membrane: move its objects to the parent, remove the membrane.
   */
  dissolve(membraneId: string) {
    const m = this.membranes.get(membraneId);
    if (!m) return;
    if (m.parent) {
      const p = this.membranes.get(m.parent);
      if (p) for (const o of m.objects) p.objects.add(o);
    }
    this.membranes.delete(membraneId);
  }

  /**
   * Project a tier surface into a membrane hierarchy: each tool class gets
   * its own membrane; read tools are innermost, destructive tools are outermost.
   */
  static fromSurface(tools: { name: string; class: ToolClass }[]): MembraneRouter {
    const r = new MembraneRouter();
    r.create("root", null);
    r.create("read", "root");
    r.create("write", "read");
    r.create("destructive", "write");
    r.create("admin", "destructive");
    for (const t of tools) {
      r.membranes.get(t.class)?.objects.add(t.name);
    }
    return r;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ZX SIMPLIFICATION — categorical quantum circuit optimization for tool circuits
// ZX-diagrams are string diagrams over symmetric monoidal categories with
// colored spiders. Tool calls are spiders; wires are data dependencies.
// Simplification rules: spider fusion, identity removal, Hadamard cancellation.
// ═══════════════════════════════════════════════════════════════════════════════

interface ZXSpider {
  id: string;
  color: "Z" | "X" | "H";
  phase: number;
  inputs: string[];
  outputs: string[];
}

class ZXCircuit {
  private spiders = new Map<string, ZXSpider>();
  private nextId = 0;

  add(color: "Z" | "X" | "H", phase: number, inputs: string[], outputs: string[]): string {
    const id = `s${this.nextId++}`;
    this.spiders.set(id, { id, color, phase, inputs, outputs });
    return id;
  }

  /**
   * Spider fusion: two spiders of the same color connected by a wire fuse
   * into one spider with summed phases and merged inputs/outputs.
   */
  fuse(idA: string, idB: string): string | null {
    const a = this.spiders.get(idA), b = this.spiders.get(idB);
    if (!a || !b) return null;
    if (a.color !== b.color) return null;
    if (!a.outputs.includes(idB) && !b.inputs.includes(idA)) return null;
    const fused: ZXSpider = {
      id: `f${this.nextId++}`, color: a.color, phase: (a.phase + b.phase) % 2,
      inputs: [...a.inputs, ...b.inputs.filter(i => i !== idA)],
      outputs: [...a.outputs.filter(o => o !== idB), ...b.outputs],
    };
    this.spiders.delete(idA); this.spiders.delete(idB);
    this.spiders.set(fused.id, fused);
    return fused.id;
  }

  /**
   * Simplify a tool circuit: repeatedly fuse same-color spiders until no
   * more fusions are possible. This is the ZX-calculus normalization.
   */
  simplify(): ZXCircuit {
    let changed = true;
    while (changed) {
      changed = false;
      const ids = [...this.spiders.keys()];
      for (const a of ids) {
        for (const b of ids) {
          if (a === b) continue;
          if (this.fuse(a, b)) { changed = true; break; }
        }
        if (changed) break;
      }
    }
    return this;
  }

  toJSON(): ZXSpider[] { return [...this.spiders.values()]; }

  /**
   * Build a ZX circuit from a tool composition graph: each tool is a Z-spider
   * (green) for data, X-spider (red) for control flow, H-spider for
   * crossing boundaries.
   */
  static fromTools(tools: { name: string; class: ToolClass }[]): ZXCircuit {
    const c = new ZXCircuit();
    const ids: string[] = [];
    for (const t of tools) {
      const color: "Z" | "X" | "H" =
        t.class === "read" ? "Z" : t.class === "write" ? "X" : "H";
      ids.push(c.add(color, 0, [], []));
    }
    for (let i = 0; i < ids.length - 1; i++) {
      c.spiders.get(ids[i])!.outputs.push(ids[i + 1]);
      c.spiders.get(ids[i + 1])!.inputs.push(ids[i]);
    }
    return c;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// TOPOS INTERNAL LOGIC — the router's decision logic is internal to a topos.
// A topos E has a subobject classifier Ω; truth values are morphisms 1 → Ω.
// The internal language (Mitchell–Bénabou) lets us reason about agent states
// as if they were sets. Forcing semantics (Kripke–Joyal) lets us evaluate
// tier predicates in the internal logic.
// ═══════════════════════════════════════════════════════════════════════════════

interface ToposTruth { agentId: string; predicate: string; value: "true" | "false" | "unknown"; }

class ToposInternalLogic {
  private truths: ToposTruth[] = [];
  private omega: Set<string> = new Set(["true", "false", "unknown"]);

  /**
   * Evaluate a predicate in the internal language. The subobject classifier
   * maps each agent to a truth value in Ω.
   */
  classify(agentId: string, predicate: string, fn: () => boolean | undefined): "true" | "false" | "unknown" {
    let v: "true" | "false" | "unknown";
    try { v = fn() === true ? "true" : fn() === false ? "false" : "unknown"; }
    catch { v = "unknown"; }
    if (!this.omega.has(v)) v = "unknown";
    this.truths.push({ agentId, predicate, value: v });
    return v;
  }

  /**
   * Forcing: a predicate is forced at a stage if it holds in all refinements.
   * Here, a tier predicate is forced if all agents in the session agree.
   */
  forces(predicate: string): boolean {
    const relevant = this.truths.filter(t => t.predicate === predicate);
    return relevant.length > 0 && relevant.every(t => t.value === "true");
  }

  /**
   * The internal language's implication: if p then q, evaluated in Ω.
   */
  implies(p: string, q: string): "true" | "false" | "unknown" {
    const pv = this.forces(p), qv = this.forces(q);
    if (pv && !qv) return "false";
    if (pv && qv) return "true";
    return "unknown";
  }

  truthsFor(agentId: string): ToposTruth[] {
    return this.truths.filter(t => t.agentId === agentId);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// GEOMETRY OF INTERACTION FEEDBACK — feedback loops for iterative tool use.
// The geometry of interaction (GoI) interprets proofs as operators on a
// Hilbert space; cut-elimination becomes a feedback loop. Here, tool calls
// are operators; feedback is the iteration of a tool until a fixed point.
// ═══════════════════════════════════════════════════════════════════════════════

class GoIFeedback {
  private loops = new Map<string, { input: unknown; iteration: number }>();

  /**
   * Run a tool in a feedback loop until the output stabilizes or max
   * iterations is reached. This is the GoI execution formula.
   */
  async run<T>(
    loopId: string,
    initial: T,
    step: (x: T) => Task<T>,
    maxIter = 10
  ): Promise<{ result: T; iterations: number; converged: boolean }> {
    let current = initial;
    let i = 0;
    for (; i < maxIter; i++) {
      const next = await step(current)();
      if (JSON.stringify(next) === JSON.stringify(current)) {
        return { result: next, iterations: i + 1, converged: true };
      }
      current = next;
    }
    return { result: current, iterations: i, converged: false };
  }

  /**
   * Cut-elimination as feedback: the cut between two tools is eliminated by
   * feeding the output of one into the other until a fixed point.
   */
  async eliminateCut<A, B>(
    toolA: (a: A) => Task<B>,
    toolB: (b: B) => Task<A>,
    initial: A
  ): Promise<{ result: A; iterations: number }> {
    let a = initial;
    for (let i = 0; i < 20; i++) {
      const b = await toolA(a)();
      const a2 = await toolB(b)();
      if (JSON.stringify(a2) === JSON.stringify(a)) {
        return { result: a2, iterations: i + 1 };
      }
      a = a2;
    }
    return { result: a, iterations: 20 };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// REALIZABILITY EXTRACTION — extract computational content from agent proofs.
// In realizability, a proof of ∀x. ∃y. P(x,y) is realized by a function f
// such that P(x, f(x)) holds. Here, an agent's plan is a proof; the extracted
// program is the sequence of tool calls that realizes it.
// ═══════════════════════════════════════════════════════════════════════════════

interface Realizer {
  agentId: string;
  plan: string;
  extracted: string[];
  witnesses: Map<string, unknown>;
}

class RealizabilityExtractor {
  private realizers = new Map<string, Realizer>();

  /**
   * Extract a tool-call program from an agent's plan. The plan is a
   * natural-language proof; the extraction is a sequence of tool names.
   */
  extract(agentId: string, plan: string, toolCatalog: string[]): Realizer {
    const words = plan.toLowerCase().split(/\s+/);
    const extracted: string[] = [];
    for (const tool of toolCatalog) {
      if (words.includes(tool.toLowerCase())) extracted.push(tool);
    }
    const r: Realizer = {
      agentId, plan, extracted, witnesses: new Map(),
    };
    this.realizers.set(agentId, r);
    return r;
  }

  /**
   * The "modified realizability" clause for implication: if the agent has a
   * realizer for A → B and a realizer for A, then it has one for B.
   */
  modusPonens(agentId: string, premise: string): string | null {
    const r = this.realizers.get(agentId);
    if (!r) return null;
    return r.extracted.includes(premise) ? r.extracted.join(" → ") : null;
  }

  realizerFor(agentId: string): Realizer | undefined {
    return this.realizers.get(agentId);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// CHOREOGRAPHY PROJECTION — global protocol → local agent behaviors.
// Choreographic programming: a global protocol describes the whole
// multi-agent interaction; projection extracts each agent's local behavior.
// Here, the global protocol is a sequence of tool calls; projection gives
// each agent its own session type.
// ═══════════════════════════════════════════════════════════════════════════════

type ChoreographyStep =
  | { _tag: "Agent"; agentId: string; tool: string }
  | { _tag: "Choice"; agentId: string; options: ChoreographyStep[] }
  | { _tag: "Parallel"; steps: ChoreographyStep[] }
  | { _tag: "End" };

class ChoreographyProjector {
  /**
   * Project a global choreography onto a specific agent. The result is the
   * agent's local session type — the sequence of tools it must call.
   */
  project(global: ChoreographyStep, agentId: string): ChoreographyStep {
    switch (global._tag) {
      case "Agent":
        return global.agentId === agentId ? global : { _tag: "End" };
      case "Choice":
        if (global.agentId === agentId) return global;
        return { _tag: "End" };
      case "Parallel":
        return { _tag: "Parallel", steps: global.steps.map(s => this.project(s, agentId)) };
      case "End":
        return global;
    }
  }

  /**
   * Extract the local tool sequence for an agent from a projected
   * choreography.
   */
  toolsFor(projected: ChoreographyStep): string[] {
    if (projected._tag === "Agent") return [projected.tool];
    if (projected._tag === "Choice") {
      return projected.options.flatMap(o => this.toolsFor(o));
    }
    if (projected._tag === "Parallel") {
      return projected.steps.flatMap(s => this.toolsFor(s));
    }
    return [];
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// CASCADE-AWARE SIDECAR — spatio-temporal risk scoring for routing geometry.
// From Di Gioia (arXiv 2603.17112, Mar 2026): a lightweight sidecar reads the
// live execution graph and recent failure history to predict which routing
// geometry best fits the current structural regime. The sidecar comprises:
//   (i) a Euclidean propagation scorer for dense graphs,
//   (ii) a hyperbolic scorer for hierarchical graphs,
//   (iii) a spherical scorer for cyclic graphs.
// ═══════════════════════════════════════════════════════════════════════════════

type RoutingGeometry = "euclidean" | "hyperbolic" | "spherical";

class CascadeSidecar {
  private failureHistory: { agentId: string; tool: string; geometry: RoutingGeometry }[] = [];
  private graphDensity = 0;
  private graphDiameter = 0;

  observeGraph(agentCount: number, edgeCount: number) {
    this.graphDensity = agentCount > 1 ? (2 * edgeCount) / (agentCount * (agentCount - 1)) : 0;
    this.graphDiameter = agentCount > 0 ? Math.ceil(Math.log2(agentCount + 1)) : 0;
  }

  recordFailure(agentId: string, tool: string, geometry: RoutingGeometry) {
    this.failureHistory.push({ agentId, tool, geometry });
  }

  /**
   * Predict the best routing geometry for the current structural regime.
   * Dense graphs → Euclidean; hierarchical graphs → hyperbolic; cyclic
   * graphs → spherical. Failure history biases the choice away from
   * geometries that failed recently.
   */
  predictGeometry(): { geometry: RoutingGeometry; confidence: number } {
    let base: RoutingGeometry;
    if (this.graphDensity > 0.5) base = "euclidean";
    else if (this.graphDiameter > 3) base = "hyperbolic";
    else base = "spherical";
    // Count recent failures per geometry
    const recent = this.failureHistory.slice(-20);
    const failures: Record<RoutingGeometry, number> = {
      euclidean: 0, hyperbolic: 0, spherical: 0,
    };
    for (const f of recent) failures[f.geometry]++;
    // Adjust base by failure penalty
    const scores: Record<RoutingGeometry, number> = {
      euclidean: (base === "euclidean" ? 1 : 0.5) - failures.euclidean * 0.1,
      hyperbolic: (base === "hyperbolic" ? 1 : 0.5) - failures.hyperbolic * 0.1,
      spherical: (base === "spherical" ? 1 : 0.5) - failures.spherical * 0.1,
    };
    const best = (Object.entries(scores) as [RoutingGeometry, number][])
      .sort((a, b) => b[1] - a[1])[0];
    return { geometry: best[0], confidence: Math.max(0, Math.min(1, best[1])) };
  }

  stats() {
    return {
      density: this.graphDensity, diameter: this.graphDiameter,
      failures: this.failureHistory.length,
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// DYPOTO ROUTER — dynamic topology routing via semantic matching.
// From Lu et al. (arXiv 2602.06039, Feb 2026): DyTopo reconstructs a sparse
// directed communication graph at each round via semantic matching between
// agents' natural-language query (need) and key (offer) descriptors. Private
// messages are routed only along the induced edges.
// ═══════════════════════════════════════════════════════════════════════════════

interface AgentDescriptor { agentId: string; need: string; offer: string; }

class DyTopoRouter {
  private descriptors = new Map<string, AgentDescriptor>();
  private embeddings = new Map<string, Map<string, number>>();

  register(d: AgentDescriptor) { this.descriptors.set(d.agentId, d); }

  /**
   * Simple bag-of-words embedding for semantic matching. In production this
   * would be a vector embedding model.
   */
  private embed(text: string): Map<string, number> {
    const words = text.toLowerCase().split(/\s+/);
    const m = new Map<string, number>();
    for (const w of words) m.set(w, (m.get(w) ?? 0) + 1);
    return m;
  }

  private cosine(a: Map<string, number>, b: Map<string, number>): number {
    let dot = 0, na = 0, nb = 0;
    for (const [k, v] of a) { dot += v * (b.get(k) ?? 0); na += v * v; }
    for (const [, v] of b) nb += v * v;
    if (na === 0 || nb === 0) return 0;
    return dot / (Math.sqrt(na) * Math.sqrt(nb));
  }

  /**
   * Reconstruct the sparse directed communication graph for the current round.
   * An edge i→j exists if the semantic similarity between agent i's need and
   * agent j's offer exceeds the threshold.
   */
  route(threshold = 0.3): { from: string; to: string; similarity: number }[] {
    const edges: { from: string; to: string; similarity: number }[] = [];
    const ids = [...this.descriptors.keys()];
    for (const i of ids) {
      for (const j of ids) {
        if (i === j) continue;
        const di = this.descriptors.get(i)!, dj = this.descriptors.get(j)!;
        const sim = this.cosine(this.embed(di.need), this.embed(dj.offer));
        if (sim >= threshold) edges.push({ from: i, to: j, similarity: sim });
      }
    }
    return edges.sort((a, b) => b.similarity - a.similarity);
  }

  /**
   * DyTopo round: update descriptors, reroute, return the new topology.
   */
  round(updates: AgentDescriptor[], threshold = 0.3) {
    for (const u of updates) this.register(u);
    return this.route(threshold);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ALPHAXIV RESEARCH TIER — paper-finder primitives as a first-class surface.
// alphaXiv MCP endpoint: api.alphaxiv.org/mcp/v1 (SSE + OAuth 2.0).
// Tools: discover_papers, get_paper_content, answer_pdf_queries,
// read_files_from_github_repository, embedding_similarity_search,
// full_text_papers_search, agentic_paper_retrieval.
// ═══════════════════════════════════════════════════════════════════════════════

const RESEARCH_TOOL_NAMES = new Set([
  "alphaxivmcp_discover_papers",
  "alphaxivmcp_get_paper_content",
  "alphaxivmcp_answer_pdf_queries",
  "alphaxivmcp_read_files_from_github_repository",
  "alphaxivmcp_embedding_similarity_search",
  "alphaxivmcp_full_text_papers_search",
  "alphaxivmcp_agentic_paper_retrieval",
]);

const isResearchTool = (t: any) => RESEARCH_TOOL_NAMES.has(t.name);

function researchSurface(catalog: any[]): any[] {
  const present = catalog.filter(isResearchTool);
  if (present.length > 0) return present;
  return [
    researchProxyTool("discover_papers", "Discover and rank papers for a topic."),
    researchProxyTool("get_paper_content", "Get paper content as text."),
    researchProxyTool("answer_pdf_queries", "Answer targeted questions against a PDF."),
    researchProxyTool("read_files_from_github_repository", "Read a paper's code repo."),
  ];
}

function researchProxyTool(suffix: string, description: string) {
  return {
    name: `alphaxiv_${suffix}`,
    description,
    inputSchema: { type: "object", properties: { args: { type: "object" } } },
    _proxy: { endpoint: ALPHAXIV_MCP, tool: `alphaxivmcp_${suffix}` },
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// EMERGENT VoT TIER — Volume of Thought normed division algebra ladder.
// R (Reals) → chain-of-thought: linear, temporal concurrency.
// C (Complex) → tree-of-thought: branching, phase.
// H (Quaternions) → mesh-of-thought: non-commutative, 4D.
// O (Octonions) → volume-of-thought: 3D simplicial, Fano geometry,
//   contradictions resolved by geometric contradiction rather than policy.
// ═══════════════════════════════════════════════════════════════════════════════

const VOT_LADDER: VoT[] = ["R", "C", "H", "O"];
const VOT_DESCRIPTION: Record<VoT, string> = {
  R: "Reals — chain of thought; linear, temporal concurrency",
  C: "Complex — tree of thought; branching, phase",
  H: "Quaternions — mesh of thought; non-commutative, 4D",
  O: "Octonions — volume of thought; 3D simplicial, Fano geometry, geometric contradiction",
};

function emergentSurface(topology: VoT, catalog: any[]): any[] {
  switch (topology) {
    case "R":
      return catalog.slice(0, 5);
    case "C":
      return catalog.filter(isReadOnly).slice(0, 10);
    case "H":
      return catalog.filter(t => isReadOnly(t) || classifyTool(t) === "write").slice(0, 20);
    case "O":
      return catalog;  // full volume
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// TIER ALGEBRA — the typeclass that resolves and gates tier surfaces.
// ═══════════════════════════════════════════════════════════════════════════════

interface TierAlgebra {
  resolve(ctx: AgentContext, catalog: any[], history: string[]): Tier;
  surface(tier: Tier, catalog: any[]): any[];
  gate(tier: Tier, tool: any, ctx: AgentContext): void;
}

const emergentTierAlgebra: TierAlgebra = {
  resolve(ctx, catalog, history) {
    // Sheaf-keeper agents get sheaf tier; petri-masters get petri; etc.
    if (ctx.role === "sheaf-keeper") return { _tag: "Sheaf" };
    if (ctx.role === "petri-master") return { _tag: "Petri" };
    if (ctx.role === "membrane-warden") return { _tag: "Membrane" };
    if (ctx.role === "researcher") return { _tag: "Research" };
    if (ctx.role === "admin") return { _tag: "Full" };
    if (ctx.role === "orchestrator") return { _tag: "Choreography" };
    if (ctx.role === "observer") return { _tag: "Coalgebra" };
    if (ctx.role === "reviewer") return { _tag: "Session" };
    // Default: emergent VoT based on catalog size
    if (catalog.length > 100) return { _tag: "Emergent", topology: "O" };
    if (catalog.length > 30) return { _tag: "Emergent", topology: "H" };
    if (catalog.length > 10) return { _tag: "Emergent", topology: "C" };
    return { _tag: "Emergent", topology: "R" };
  },

  surface(tier, catalog) {
    switch (tier._tag) {
      case "Router":
        return [routerTool(), listRoutesTool(), describeTool()];
      case "Classified":
        return [
          classDispatcherTool("read"), classDispatcherTool("write"),
          classDispatcherTool("destructive"), classDispatcherTool("admin"),
          listRoutesTool(), describeTool(),
        ];
      case "Minimal":
        return catalog.filter(isReadOnly);
      case "Sheaf":
        return [sheafConsistencyTool(), listRoutesTool(), describeTool()];
      case "Operad":
        return [operadComposeTool(), operadListTool(), listRoutesTool()];
      case "Coalgebra":
        return [coalgebraObserveTool(), coalgebraInferTool(), listRoutesTool()];
      case "Session":
        return [sessionOpenTool(), sessionConsumeTool(), listRoutesTool()];
      case "Petri":
        return [petriFireTool(), petriMarkingTool(), listRoutesTool()];
      case "Membrane":
        return [membraneEvolveTool(), membraneDissolveTool(), membraneListTool()];
      case "ZX":
        return [zxSimplifyTool(), zxFuseTool(), zxToJsonTool()];
      case "Topos":
        return [toposClassifyTool(), toposForcesTool(), toposImpliesTool()];
      case "GoI":
        return [goiRunTool(), goiEliminateCutTool(), listRoutesTool()];
      case "Realizability":
        return [realizabilityExtractTool(), realizabilityModusPonensTool()];
      case "Choreography":
        return [choreographyProjectTool(), choreographyToolsTool()];
      case "Cascade":
        return [cascadePredictTool(), cascadeObserveTool(), listRoutesTool()];
      case "DyTopo":
        return [dytopoRouteTool(), dytopoRoundTool(), listRoutesTool()];
      case "Research":
        return researchSurface(catalog);
      case "Emergent":
        return emergentSurface(tier.topology, catalog);
      case "Auto":
        return [selectTierTool()];
      case "Full":
      default:
        return catalog;
    }
  },

  gate(tier, tool, ctx) {
    const cls = classifyTool(tool);
    if (tier._tag === "Minimal" && cls !== "read")
      throw { code: -32000, message: `refused: ${tool.name} is ${cls}, tier is minimal` };
    if (tier._tag === "Research" && !isResearchTool(tool))
      throw { code: -32000, message: `refused: ${tool.name} is not a research tool` };
    if (tier._tag === "Sheaf" && !tool.name.startsWith("sheaf_"))
      throw { code: -32000, message: `refused: sheaf tier only permits sheaf_* tools` };
    if (tier._tag === "Petri" && !tool.name.startsWith("petri_"))
      throw { code: -32000, message: `refused: petri tier only permits petri_* tools` };
    if (tier._tag === "Membrane" && !tool.name.startsWith("membrane_"))
      throw { code: -32000, message: `refused: membrane tier only permits membrane_* tools` };
    if (tier._tag === "ZX" && !tool.name.startsWith("zx_"))
      throw { code: -32000, message: `refused: zx tier only permits zx_* tools` };
    if (tier._tag === "Topos" && !tool.name.startsWith("topos_"))
      throw { code: -32000, message: `refused: topos tier only permits topos_* tools` };
    if (tier._tag === "GoI" && !tool.name.startsWith("goi_"))
      throw { code: -32000, message: `refused: goi tier only permits goi_* tools` };
    if (tier._tag === "Realizability" && !tool.name.startsWith("realizability_"))
      throw { code: -32000, message: `refused: realizability tier only permits realizability_* tools` };
    if (tier._tag === "Choreography" && !tool.name.startsWith("choreography_"))
      throw { code: -32000, message: `refused: choreography tier only permits choreography_* tools` };
    if (tier._tag === "Cascade" && !tool.name.startsWith("cascade_"))
      throw { code: -32000, message: `refused: cascade tier only permits cascade_* tools` };
    if (tier._tag === "DyTopo" && !tool.name.startsWith("dytopo_"))
      throw { code: -32000, message: `refused: dytopo tier only permits dytopo_* tools` };
    if (cls === "admin" && ctx.role !== "admin")
      throw { code: -32000, message: `refused: admin tool requires admin role` };
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// TOOL SURFACES — the actual tool definitions for each tier
// ═══════════════════════════════════════════════════════════════════════════════

function selectTierTool() {
  return {
    name: "select_tier",
    description:
      "Choose the tool surface for this agent session. This is the only tool " +
      "available until a tier is chosen. Tiers include the standard set plus " +
      "weird tiers: sheaf | operad | coalgebra | session | petri | membrane | " +
      "zx | topos | goi | realizability | choreography | cascade | dytopo | " +
      "research | emergent. The surface swaps and tools/list_changed fires.",
    inputSchema: {
      type: "object",
      properties: {
        tier: { type: "string", enum: TIER_NAMES },
        topology: { type: "string", enum: VOT_LADDER },
      },
      required: ["tier"],
    },
  };
}

function routerTool() {
  return {
    name: "route",
    description: "Dispatch to any tool on the underlying MCP surface.",
    inputSchema: {
      type: "object",
      properties: { tool: { type: "string" }, args: { type: "object" } },
      required: ["tool"],
    },
  };
}

function listRoutesTool() {
  return {
    name: "list_routes",
    description: "List every tool on the underlying surface (name + class).",
    inputSchema: { type: "object", properties: {} },
  };
}

function describeTool() {
  return {
    name: "describe_tool",
    description: "Return the full schema for one tool by name.",
    inputSchema: { type: "object", properties: { name: { type: "string" } }, required: ["name"] },
  };
}

function classDispatcherTool(cls: ToolClass) {
  const desc =
    cls === "read" ? "Dispatch to a read-only tool." :
    cls === "write" ? "Dispatch to a write or read tool. Destructive rejected." :
    cls === "destructive" ? "Dispatch to any tool. Requires confirm:true." :
    "Dispatch to an admin tool. Requires confirm:true and admin role.";
  const props: any = { tool: { type: "string" }, args: { type: "object" } };
  if (cls === "destructive" || cls === "admin") props.confirm = { type: "boolean" };
  return {
    name: `call_${cls}`,
    description: desc,
    inputSchema: {
      type: "object",
      properties: props,
      required: (cls === "destructive" || cls === "admin") ? ["tool", "confirm"] : ["tool"],
    },
  };
}

// ── sheaf consistency tools ─────────────────────────────────────────────
function sheafConsistencyTool() {
  return {
    name: "sheaf_consistency",
    description:
      "Compute H⁰ and H¹ cohomology of the agent claim graph. H¹ obstructions " +
      "surface contradictions no local fix can resolve.",
    inputSchema: { type: "object", properties: {} },
  };
}

// ── operad tools ────────────────────────────────────────────────────────
function operadComposeTool() {
  return {
    name: "operad_compose",
    description: "Compose tool operations operadically: f ∘ (g₁, ..., gₙ).",
    inputSchema: {
      type: "object",
      properties: {
        f: { type: "string" }, gs: { type: "array", items: { type: "string" } },
      },
      required: ["f", "gs"],
    },
  };
}
function operadListTool() {
  return {
    name: "operad_list",
    description: "List all registered operad operations.",
    inputSchema: { type: "object", properties: {} },
  };
}

// ── coalgebra tools ─────────────────────────────────────────────────────
function coalgebraObserveTool() {
  return {
    name: "coalgebra_observe",
    description: "Record an observation in the agent's coalgebraic stream.",
    inputSchema: {
      type: "object",
      properties: { tool: { type: "string" }, class: { type: "string" } },
      required: ["tool", "class"],
    },
  };
}
function coalgebraInferTool() {
  return {
    name: "coalgebra_infer",
    description: "Coinductively infer the agent's tier from its observation stream.",
    inputSchema: { type: "object", properties: {} },
  };
}

// ── session type tools ──────────────────────────────────────────────────
function sessionOpenTool() {
  return {
    name: "session_open",
    description: "Open a session type for this agent from a tool sequence.",
    inputSchema: {
      type: "object",
      properties: { tools: { type: "array", items: { type: "string" } } },
      required: ["tools"],
    },
  };
}
function sessionConsumeTool() {
  return {
    name: "session_consume",
    description: "Consume a tool call against the session type.",
    inputSchema: {
      type: "object", properties: { tool: { type: "string" } }, required: ["tool"],
    },
  };
}

// ── Petri net tools ─────────────────────────────────────────────────────
function petriFireTool() {
  return {
    name: "petri_fire",
    description: "Attempt to fire a Petri transition. Returns true if fired.",
    inputSchema: {
      type: "object", properties: { transition: { type: "string" } }, required: ["transition"],
    },
  };
}
function petriMarkingTool() {
  return {
    name: "petri_marking",
    description: "Return the current Petri net marking.",
    inputSchema: { type: "object", properties: {} },
  };
}

// ── membrane tools ──────────────────────────────────────────────────────
function membraneEvolveTool() {
  return {
    name: "membrane_evolve",
    description: "Evolve a membrane's object set by one P-system step.",
    inputSchema: {
      type: "object", properties: { membrane: { type: "string" } }, required: ["membrane"],
    },
  };
}
function membraneDissolveTool() {
  return {
    name: "membrane_dissolve",
    description: "Dissolve a membrane, moving its objects to the parent.",
    inputSchema: {
      type: "object", properties: { membrane: { type: "string" } }, required: ["membrane"],
    },
  };
}
function membraneListTool() {
  return {
    name: "membrane_list",
    description: "List all membranes and their objects.",
    inputSchema: { type: "object", properties: {} },
  };
}

// ── ZX tools ────────────────────────────────────────────────────────────
function zxSimplifyTool() {
  return {
    name: "zx_simplify",
    description: "Simplify a ZX circuit by spider fusion.",
    inputSchema: { type: "object", properties: {} },
  };
}
function zxFuseTool() {
  return {
    name: "zx_fuse",
    description: "Fuse two ZX spiders of the same color.",
    inputSchema: {
      type: "object", properties: { a: { type: "string" }, b: { type: "string" } },
      required: ["a", "b"],
    },
  };
}
function zxToJsonTool() {
  return {
    name: "zx_to_json",
    description: "Serialize the ZX circuit to JSON.",
    inputSchema: { type: "object", properties: {} },
  };
}

// ── topos tools ─────────────────────────────────────────────────────────
function toposClassifyTool() {
  return {
    name: "topos_classify",
    description: "Classify a predicate in the topos internal language.",
    inputSchema: {
      type: "object",
      properties: { predicate: { type: "string" } }, required: ["predicate"],
    },
  };
}
function toposForcesTool() {
  return {
    name: "topos_forces",
    description: "Check whether a predicate is forced in the topos.",
    inputSchema: {
      type: "object",
      properties: { predicate: { type: "string" } }, required: ["predicate"],
    },
  };
}
function toposImpliesTool() {
  return {
    name: "topos_implies",
    description: "Evaluate implication p → q in the topos internal logic.",
    inputSchema: {
      type: "object",
      properties: { p: { type: "string" }, q: { type: "string" } },
      required: ["p", "q"],
    },
  };
}

// ── GoI tools ───────────────────────────────────────────────────────────
function goiRunTool() {
  return {
    name: "goi_run",
    description: "Run a tool in a geometry-of-interaction feedback loop.",
    inputSchema: {
      type: "object",
      properties: { loopId: { type: "string" }, maxIter: { type: "number" } },
      required: ["loopId"],
    },
  };
}
function goiEliminateCutTool() {
  return {
    name: "goi_eliminate_cut",
    description: "Eliminate a cut between two tools via feedback.",
    inputSchema: {
      type: "object", properties: { a: { type: "string" }, b: { type: "string" } },
      required: ["a", "b"],
    },
  };
}

// ── realizability tools ─────────────────────────────────────────────────
function realizabilityExtractTool() {
  return {
    name: "realizability_extract",
    description: "Extract a tool-call program from an agent's plan.",
    inputSchema: {
      type: "object", properties: { plan: { type: "string" } }, required: ["plan"],
    },
  };
}
function realizabilityModusPonensTool() {
  return {
    name: "realizability_modus_ponens",
    description: "Apply modus ponens in modified realizability.",
    inputSchema: {
      type: "object", properties: { premise: { type: "string" } }, required: ["premise"],
    },
  };
}

// ── choreography tools ──────────────────────────────────────────────────
function choreographyProjectTool() {
  return {
    name: "choreography_project",
    description: "Project a global choreography onto a specific agent.",
    inputSchema: {
      type: "object", properties: { agentId: { type: "string" } }, required: ["agentId"],
    },
  };
}
function choreographyToolsTool() {
  return {
    name: "choreography_tools",
    description: "Extract the local tool sequence from a projected choreography.",
    inputSchema: { type: "object", properties: {} },
  };
}

// ── cascade tools ───────────────────────────────────────────────────────
function cascadePredictTool() {
  return {
    name: "cascade_predict",
    description: "Predict the best routing geometry for the current regime.",
    inputSchema: { type: "object", properties: {} },
  };
}
function cascadeObserveTool() {
  return {
    name: "cascade_observe",
    description: "Observe the current graph topology for the sidecar.",
    inputSchema: {
      type: "object",
      properties: { agents: { type: "number" }, edges: { type: "number" } },
      required: ["agents", "edges"],
    },
  };
}

// ── DyTopo tools ────────────────────────────────────────────────────────
function dytopoRouteTool() {
  return {
    name: "dytopo_route",
    description: "Reconstruct the sparse directed communication graph.",
    inputSchema: {
      type: "object", properties: { threshold: { type: "number" } },
    },
  };
}
function dytopoRoundTool() {
  return {
    name: "dytopo_round",
    description: "Run a DyTopo round: update descriptors, reroute.",
    inputSchema: { type: "object", properties: {} },
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// AGENT-SCOPED SESSIONS + SHARED UPSTREAM POOL
// ═══════════════════════════════════════════════════════════════════════════════

interface AgentContext {
  sparkSid: string;
  agentId: string;
  role: AgentRole;
  modelTier: "haiku" | "sonnet" | "opus";
  credentialFingerprint: string;
}

interface AgentSession {
  ctx: AgentContext;
  tier: Tier | null;
  autoTierPending: boolean;
  clientInfoName?: string;
  catalog: any[];
  poolKey: string;
  createdAt: number;
  lastUsed: number;
  // weird subsystem state
  sheaf: CellularSheaf;
  operad: ToolOperad;
  observer: CoalgebraObserver;
  sessionGate: SessionTypeGate;
  petri: PetriNetArbiter;
  membrane: MembraneRouter;
  zx: ZXCircuit;
  topos: ToposInternalLogic;
  goi: GoIFeedback;
  realizability: RealizabilityExtractor;
  choreography: ChoreographyProjector;
  cascade: CascadeSidecar;
  dytopo: DyTopoRouter;
}

interface PoolEntry {
  gateSid: string;
  initResponse: any;
  refcount: number;
  fingerprint: string;
  catalog: any[];
}

const agentSessions = new Map<string, AgentSession>();
const pool = new Map<string, PoolEntry>();
const agentStreams = new Map<string, Set<StreamSink>>();

interface StreamSink { id: string; enqueue: (c: Uint8Array) => void; }

const agentKey = (ctx: AgentContext) => `${ctx.sparkSid}::${ctx.agentId}`;
const poolKeyFor = (ctx: AgentContext) => `pool:${ctx.credentialFingerprint}`;

// ═══════════════════════════════════════════════════════════════════════════════
// GATEWAY
// ═══════════════════════════════════════════════════════════════════════════════

interface GFetchResult { text: string; sid: string | null; status: number; }

const gfetch = (
  sid: string | null, body: unknown,
  endpoint: string = GATEHOUSE, bearer: string = KEY
): Task<GFetchResult> =>
  async () => {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      Authorization: `Bearer ${bearer}`,
    };
    if (sid) headers["mcp-session-id"] = sid;
    const r = await fetch(endpoint, {
      method: "POST", headers, body: JSON.stringify(body),
    });
    const newSid = r.headers.get("mcp-session-id") || sid;
    const text = await r.text();
    return { text, sid: newSid, status: r.status };
  };

function extractJson(text: string): any {
  if (!text) return null;
  const trimmed = text.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("{")) { try { return JSON.parse(trimmed); } catch {} }
  const lines = trimmed.split("\n");
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].trim();
    if (!line.startsWith("data:")) continue;
    const payload = line.slice(5).trim();
    if (!payload) continue;
    try { return JSON.parse(payload); } catch {}
  }
  const s = trimmed.indexOf("{");
  const e = trimmed.lastIndexOf("}");
  if (s >= 0 && e > s) { try { return JSON.parse(trimmed.slice(s, e + 1)); } catch {} }
  return null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// TOOL CLASSIFICATION
// ═══════════════════════════════════════════════════════════════════════════════

const DESTRUCTIVE_RE = /(delete|destroy|kill|drop|purge|remove|wipe|terminate|format|reset|uninstall)/i;
const WRITE_RE = /(create|write|update|set|put|push|post|add|insert|patch|apply|run|execute|invoke|submit|start|stop|restart|deploy)/i;
const ADMIN_RE = /(admin|config|grant|revoke|rotate|policy|secret|credential)/i;

function classifyTool(t: any): ToolClass {
  const a = t.annotations || {};
  if (a.destructiveHint === true) return "destructive";
  if (a.readOnlyHint === true) return "read";
  const n = String(t.name || "");
  if (ADMIN_RE.test(n)) return "admin";
  if (DESTRUCTIVE_RE.test(n)) return "destructive";
  if (WRITE_RE.test(n)) return "write";
  return "read";
}
const isReadOnly = (t: any) => classifyTool(t) === "read";

// ═══════════════════════════════════════════════════════════════════════════════
// POOL / SESSION MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════════

async function acquirePoolEntry(ctx: AgentContext): Promise<PoolEntry> {
  const key = poolKeyFor(ctx);
  const existing = pool.get(key);
  if (existing) { existing.refcount++; return existing; }

  const initBody = {
    jsonrpc: "2.0", id: 0, method: "initialize",
    params: {
      protocolVersion: "2025-11-25", capabilities: {},
      clientInfo: { name: "doorbell-monad", version: "6.0.0", agentId: ctx.agentId, role: ctx.role },
    },
  };
  const init = await gfetch(null, initBody)();
  const initParsed = extractJson(init.text);
  const gateSid = init.sid || `gs_${randomBytes(4).toString("hex")}`;
  const listBody = { jsonrpc: "2.0", id: 1, method: "tools/list", params: {} };
  const list = await gfetch(gateSid, listBody)();
  const listParsed = extractJson(list.text);
  const catalog = listParsed?.result?.tools || [];

  const entry: PoolEntry = {
    gateSid, refcount: 1, fingerprint: ctx.credentialFingerprint, catalog,
    initResponse: initParsed || {
      jsonrpc: "2.0", id: 0,
      result: {
        protocolVersion: "2026-07-28",
        capabilities: { tools: { listChanged: true } },
        serverInfo: { name: "doorbell-monad", version: "6.0.0" },
      },
    },
  };
  pool.set(key, entry);
  return entry;
}

async function releasePoolEntry(ctx: AgentContext) {
  const key = poolKeyFor(ctx);
  const entry = pool.get(key);
  if (!entry) return;
  entry.refcount--;
  if (entry.refcount <= 0) pool.delete(key);
}

async function ensureAgentSession(ctx: AgentContext): Promise<AgentSession> {
  const key = agentKey(ctx);
  const existing = agentSessions.get(key);
  if (existing) { existing.lastUsed = Date.now(); return existing; }

  const entry = await acquirePoolEntry(ctx);
  const catalog = entry.catalog;
  const tier: Tier | null = null;

  // Build the weird subsystem state
  const sheaf = new CellularSheaf();
  sheaf.addStalk(ctx.agentId);
  const operad = new ToolOperad();
  for (const t of catalog) {
    operad.register({
      name: t.name, arity: 1,
      execute: async (inputs) => {
        const r = await gfetch(entry.gateSid, {
          jsonrpc: "2.0", id: randomBytes(2).toString("hex"),
          method: "tools/call",
          params: { name: t.name, arguments: inputs[0] ?? {} },
        })();
        if (r.sid && pool.has(poolKeyFor(ctx))) pool.get(poolKeyFor(ctx))!.gateSid = r.sid;
        return extractJson(r.text) ?? r.text;
      },
    });
  }
  const observer = new CoalgebraObserver();
  const sessionGate = new SessionTypeGate();
  const petri = PetriNetArbiter.standard(catalog.map(t => t.name));
  const membrane = MembraneRouter.fromSurface(catalog.map(t => ({ name: t.name, class: classifyTool(t) })));
  const zx = ZXCircuit.fromTools(catalog.map(t => ({ name: t.name, class: classifyTool(t) })));
  const topos = new ToposInternalLogic();
  const goi = new GoIFeedback();
  const realizability = new RealizabilityExtractor();
  const choreography = new ChoreographyProjector();
  const cascade = new CascadeSidecar();
  const dytopo = new DyTopoRouter();
  dytopo.register({
    agentId: ctx.agentId, role: ctx.role,
    need: `${ctx.role} needs tools`, offer: `${ctx.role} offers ${ctx.role} capabilities`,
  } as any);

  const s: AgentSession = {
    ctx, tier, autoTierPending: true, catalog, poolKey: poolKeyFor(ctx),
    createdAt: Date.now(), lastUsed: Date.now(),
    sheaf, operad, observer, sessionGate, petri, membrane,
    zx, topos, goi, realizability, choreography, cascade, dytopo,
  };
  agentSessions.set(key, s);
  return s;
}

function sweepSessions() {
  const now = Date.now();
  for (const [k, s] of agentSessions) {
    if (now - s.lastUsed > SESSION_TTL_MS) {
      agentSessions.delete(k); agentStreams.delete(k);
      releasePoolEntry(s.ctx).catch(() => {});
    }
  }
  if (agentSessions.size > MAX_AGENT_SESSIONS) {
    const sorted = [...agentSessions.entries()].sort((a, b) => a[1].lastUsed - b[1].lastUsed);
    for (let i = 0; i < sorted.length - MAX_AGENT_SESSIONS; i++) {
      agentSessions.delete(sorted[i][0]); agentStreams.delete(sorted[i][0]);
      releasePoolEntry(sorted[i][1].ctx).catch(() => {});
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// NOTIFICATION FAN-OUT
// ═══════════════════════════════════════════════════════════════════════════════

function pushToAgent(key: string, notification: any): number {
  const sinks = agentStreams.get(key);
  if (!sinks || sinks.size === 0) return 0;
  const payload = new TextEncoder().encode(
    `event: message\ndata: ${JSON.stringify(notification)}\n\n`
  );
  let delivered = 0;
  for (const sink of sinks) {
    try { sink.enqueue(payload); delivered++; }
    catch { sinks.delete(sink); }
  }
  return delivered;
}

// ═══════════════════════════════════════════════════════════════════════════════
// HANDLERS
// ═══════════════════════════════════════════════════════════════════════════════

function handleInitialize(s: AgentSession, reqId: any, requested?: string): any {
  if (requested === "2026-07-28") {
    return {
      jsonrpc: "2.0", id: reqId,
      error: {
        code: -32602,
        message: "UnsupportedProtocolVersionError",
        data: { supported: ["2025-11-25"] },
      },
    };
  }
  return {
    jsonrpc: "2.0", id: reqId,
    result: {
      protocolVersion: "2025-11-25",
      capabilities: { tools: { listChanged: true } },
      serverInfo: { name: "doorbell-monad", version: "6.0.0" },
      instructions: "Legacy handshake only. 2026-07-28 clients use server/discover.",
    },
  };
}

function handleToolsList(s: AgentSession, reqId: any, req?: Request, clientInfoName?: string): any {
  if (req) bootGrokFullTier(s, req, clientInfoName);
  const surface = s.tier ? emergentTierAlgebra.surface(s.tier, s.catalog) : [selectTierTool()];
  if (s.tier && s.tier._tag === "Full" && !surface.some((t: any) => t.name === "select_tier")) {
    surface.push(selectTierTool());
  }
  const tools = surface
    .slice()
    .sort((a: any, b: any) => String(a.name).localeCompare(String(b.name)));
  return {
    jsonrpc: "2.0", id: reqId,
    result: { resultType: "complete", tools, ttlMs: 300000, cacheScope: "private" },
  };
}

async function handleToolsCall(s: AgentSession, reqId: any, params: any, req?: Request, clientInfoName?: string): Promise<any> {
  const name = params?.name;
  const args = params?.arguments || {};
  const key = agentKey(s.ctx);
  if (name !== "select_tier" && req) bootGrokFullTier(s, req, clientInfoName);

  // ── select_tier ──────────────────────────────────────────────────────────
  if (name === "select_tier" || (s.tier == null && name !== "select_tier")) {
    if (s.tier == null && name !== "select_tier") {
      return refuse(reqId, "tier unset; call select_tier first");
    }
    const requested = String(args.tier || "");
    const topology = args.topology as VoT | undefined;
    const tier = parseTier(requested, topology);
    if (!tier) {
      return { jsonrpc: "2.0", id: reqId,
        result: { resultType: "complete", content: [{ type: "text", text: `unknown tier: ${requested}` }], isError: true } };
    }
    s.tier = tier;
    s.autoTierPending = tier._tag === "Auto";
    pushToAgent(key, { jsonrpc: "2.0", method: "notifications/tools/list_changed", params: {} });
    const names = emergentTierAlgebra.surface(tier, s.catalog).map((t: any) => t.name).join(", ");
    return { jsonrpc: "2.0", id: reqId,
      result: { content: [{ type: "text",
        text: `Tier "${tierName(tier)}" set for agent ${s.ctx.agentId}. Surface: ${names || "(empty)"}.` }] } };
  }

  // ── list_routes ──────────────────────────────────────────────────────────
  if (name === "list_routes") {
    const routes = s.catalog.map((t: any) => ({
      name: t.name, description: t.description, class: classifyTool(t),
    }));
    return { jsonrpc: "2.0", id: reqId,
      result: { content: [{ type: "text", text: JSON.stringify(routes, null, 2) }] } };
  }

  // ── describe_tool ────────────────────────────────────────────────────────
  if (name === "describe_tool") {
    const t = s.catalog.find((x: any) => x.name === args.name);
    if (!t) return { jsonrpc: "2.0", id: reqId,
      result: { content: [{ type: "text", text: `unknown tool: ${args.name}` }], isError: true } };
    return { jsonrpc: "2.0", id: reqId,
      result: { content: [{ type: "text", text: JSON.stringify(t, null, 2) }] } };
  }

  // ── weird subsystem tools ────────────────────────────────────────────────
  if (name === "sheaf_consistency") {
    const { h0, h1 } = s.sheaf.cohomology();
    return ok(reqId, JSON.stringify({ h0: Object.fromEntries(h0), h1 }, null, 2));
  }
  if (name === "operad_compose") {
    const op = s.operad.compose(args.f, args.gs);
    return ok(reqId, `composed: ${op.name} (arity ${op.arity})`);
  }
  if (name === "operad_list") {
    return ok(reqId, JSON.stringify(s.operad.list(), null, 2));
  }
  if (name === "coalgebra_observe") {
    s.observer.observe(s.ctx.agentId, args.tool, args.class);
    return ok(reqId, `observed ${args.tool}:${args.class}`);
  }
  if (name === "coalgebra_infer") {
    return ok(reqId, tierName(s.observer.inferTier(s.ctx.agentId)));
  }
  if (name === "session_open") {
    s.sessionGate.open(s.ctx.agentId, SessionTypeGate.fromSurface(args.tools));
    return ok(reqId, `session opened with ${args.tools.length} tools`);
  }
  if (name === "session_consume") {
    try {
      const cont = s.sessionGate.consume(s.ctx.agentId, args.tool);
      return ok(reqId, `consumed ${args.tool}; continuation: ${JSON.stringify(cont)}`);
    } catch (e: any) { return refuse(reqId, e.message); }
  }
  if (name === "petri_fire") {
    const fired = s.petri.fire(args.transition);
    return ok(reqId, fired ? `fired ${args.transition}` : `blocked: ${args.transition}`);
  }
  if (name === "petri_marking") {
    return ok(reqId, JSON.stringify(s.petri.marking(), null, 2));
  }
  if (name === "membrane_evolve") {
    const objs = s.membrane.evolve(args.membrane);
    return ok(reqId, JSON.stringify([...objs], null, 2));
  }
  if (name === "membrane_dissolve") {
    s.membrane.dissolve(args.membrane);
    return ok(reqId, `dissolved ${args.membrane}`);
  }
  if (name === "membrane_list") {
    return ok(reqId, `membranes: ${[...(s.membrane as any).membranes.keys()].join(", ")}`);
  }
  if (name === "zx_simplify") {
    s.zx.simplify();
    return ok(reqId, `simplified to ${s.zx.toJSON().length} spiders`);
  }
  if (name === "zx_fuse") {
    const fused = s.zx.fuse(args.a, args.b);
    return ok(reqId, fused ? `fused into ${fused}` : `cannot fuse ${args.a} and ${args.b}`);
  }
  if (name === "zx_to_json") {
    return ok(reqId, JSON.stringify(s.zx.toJSON(), null, 2));
  }
  if (name === "topos_classify") {
    const v = s.topos.classify(s.ctx.agentId, args.predicate, () => true);
    return ok(reqId, `classified "${args.predicate}" as ${v}`);
  }
  if (name === "topos_forces") {
    return ok(reqId, `forces("${args.predicate}") = ${s.topos.forces(args.predicate)}`);
  }
  if (name === "topos_implies") {
    return ok(reqId, `implies("${args.p}", "${args.q}") = ${s.topos.implies(args.p, args.q)}`);
  }
  if (name === "goi_run") {
    const r = await s.goi.run(args.loopId, 0, async (x) => pure(x + 1), args.maxIter ?? 5);
    return ok(reqId, JSON.stringify(r));
  }
  if (name === "goi_eliminate_cut") {
    const r = await s.goi.eliminateCut(
      async (a: number) => pure(a + 1),
      async (b: number) => pure(b - 1),
      0
    );
    return ok(reqId, JSON.stringify(r));
  }
  if (name === "realizability_extract") {
    const r = s.realizability.extract(s.ctx.agentId, args.plan, s.catalog.map(t => t.name));
    return ok(reqId, JSON.stringify({ extracted: r.extracted, witnesses: [...r.witnesses] }, null, 2));
  }
  if (name === "realizability_modus_ponens") {
    const r = s.realizability.modusPonens(s.ctx.agentId, args.premise);
    return ok(reqId, r ?? "no realizer");
  }
  if (name === "choreography_project") {
    const global: ChoreographyStep = { _tag: "Agent", agentId: args.agentId, tool: "example" };
    const proj = s.choreography.project(global, args.agentId);
    return ok(reqId, JSON.stringify(proj));
  }
  if (name === "choreography_tools") {
    const global: ChoreographyStep = { _tag: "Parallel", steps: [
      { _tag: "Agent", agentId: s.ctx.agentId, tool: "tool_a" },
      { _tag: "Agent", agentId: s.ctx.agentId, tool: "tool_b" },
    ]};
    const proj = s.choreography.project(global, s.ctx.agentId);
    return ok(reqId, JSON.stringify(s.choreography.toolsFor(proj)));
  }
  if (name === "cascade_predict") {
    return ok(reqId, JSON.stringify(s.cascade.predictGeometry()));
  }
  if (name === "cascade_observe") {
    s.cascade.observeGraph(args.agents, args.edges);
    return ok(reqId, JSON.stringify(s.cascade.stats()));
  }
  if (name === "dytopo_route") {
    return ok(reqId, JSON.stringify(s.dytopo.route(args.threshold ?? 0.3), null, 2));
  }
  if (name === "dytopo_round") {
    return ok(reqId, JSON.stringify(s.dytopo.round([], 0.3), null, 2));
  }

  // ── dispatchers ──────────────────────────────────────────────────────────
  const isDispatcher = /^(route|call_(read|write|destructive|admin))$/.test(String(name));
  if (isDispatcher) {
    const target = String(args.tool || "");
    const targetTool = s.catalog.find((t: any) => t.name === target);
    if (!targetTool) return refuse(reqId, `unknown target: ${target}`);

    const cls = classifyTool(targetTool);
    if (name === "call_read" && cls !== "read") return refuse(reqId, `${target} is ${cls}`);
    if (name === "call_write" && (cls === "destructive" || cls === "admin"))
      return refuse(reqId, `${target} is ${cls}`);
    if ((name === "call_destructive" || name === "call_admin") && args.confirm !== true)
      return refuse(reqId, `confirm:true required`);
    if (cls === "admin" && s.ctx.role !== "admin") return refuse(reqId, `admin role required`);

    // Petri net arbitration
    const fired = s.petri.fire(`call:${target}`);
    if (!fired) return refuse(reqId, `Petri net blocked: ${target} unavailable`);

    const cleanArgs = { ...(args.args || {}) };
    delete cleanArgs.confirm;
    const r = await gfetch(
      pool.get(s.poolKey)?.gateSid ?? null,
      { jsonrpc: "2.0", id: reqId, method: "tools/call", params: { name: target, arguments: cleanArgs } }
    )();
    if (r.sid && pool.has(s.poolKey)) pool.get(s.poolKey)!.gateSid = r.sid;

    // Coalgebra observation
    s.observer.observe(s.ctx.agentId, target, cls);

    return extractJson(r.text) || { jsonrpc: "2.0", id: reqId,
      result: { content: [{ type: "text", text: r.text }] } };
  }

  // ── research proxy forwarding ────────────────────────────────────────────
  const researchTool = emergentTierAlgebra.surface(s.tier!, s.catalog)
    .find((t: any) => t.name === name && t._proxy);
  if (researchTool) {
    const r = await gfetch(
      null,
      { jsonrpc: "2.0", id: reqId, method: "tools/call",
        params: { name: researchTool._proxy.tool, arguments: args.args || args } },
      researchTool._proxy.endpoint
    )();
    return extractJson(r.text) || ok(reqId, r.text);
  }

  // ── auto tier lock-in ────────────────────────────────────────────────────
  if (s.autoTierPending) {
    s.autoTierPending = false;
    const t = s.catalog.find((x: any) => x.name === name);
    const cls = t ? classifyTool(t) : "write";
    s.tier = cls === "read" ? { _tag: "Minimal" } : { _tag: "Router" };
    pushToAgent(key, { jsonrpc: "2.0", method: "notifications/tools/list_changed", params: {} });
  }

  // ── tier gate ────────────────────────────────────────────────────────────
  const currentTool = s.catalog.find((x: any) => x.name === name);
  if (currentTool) {
    try { emergentTierAlgebra.gate(s.tier!, currentTool, s.ctx); }
    catch (e: any) { return refuse(reqId, e.message); }
  }

  // ── direct call ──────────────────────────────────────────────────────────
  const fired = s.petri.fire(`call:${name}`);
  if (!fired) return refuse(reqId, `Petri net blocked: ${name} unavailable`);
  const r = await gfetch(
    pool.get(s.poolKey)?.gateSid ?? null,
    { jsonrpc: "2.0", id: reqId, method: "tools/call", params: { name, arguments: args } }
  )();
  if (r.sid && pool.has(s.poolKey)) pool.get(s.poolKey)!.gateSid = r.sid;
  return extractJson(r.text) || ok(reqId, r.text);
}

function ok(reqId: any, text: string) {
  return { jsonrpc: "2.0", id: reqId, result: { resultType: "complete", content: [{ type: "text", text }] } };
}
function refuse(reqId: any, msg: string) {
  return { jsonrpc: "2.0", id: reqId,
    result: { content: [{ type: "text", text: `refused: ${msg}` }], isError: true } };
}

// ═══════════════════════════════════════════════════════════════════════════════
// OAUTH + DISCOVERY
// ═══════════════════════════════════════════════════════════════════════════════

function oauthProtectedResource() {
  return { resource: `${ISSUER}/`, authorization_servers: [ISSUER], bearer_methods_supported: ["header"] };
}
function oauthAuthorizationServer() {
  return {
    issuer: ISSUER,
    authorization_endpoint: `${ISSUER}/authorize`,
    token_endpoint: `${ISSUER}/api/oauth/token`,
    registration_endpoint: `${ISSUER}/api/oauth/register`,
    jwks_uri: `${ISSUER}/.well-known/jwks.json`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code","client_credentials","refresh_token"],
    token_endpoint_auth_methods_supported: ["none"],
  };
}
function oauthRegister() {
  return {
    client_id: `client_${randomBytes(4).toString("hex")}`,
    client_secret: randomBytes(8).toString("hex"),
    redirect_uris: ["https://oauth-redirect.googleusercontent.com/r/user_bound_custom-mcp-111554610217088906669-github-mcp-host_tailc9ac71_ts_net"],
    grant_types: ["authorization_code","client_credentials"],
  };
}
function oauthToken() {
  return { access_token: `tok_${randomBytes(8).toString("hex")}`, token_type: "Bearer", expires_in: 86400 };
}

// ═══════════════════════════════════════════════════════════════════════════════
// HTTP SERVER
// ═══════════════════════════════════════════════════════════════════════════════

const cors: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS, DELETE",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, mcp-session-id, Last-Event-ID, x-agent-id, x-agent-role, x-agent-model",
  "Access-Control-Expose-Headers": "mcp-session-id",
};


/* grok-boot: imported from ./grok-boot.ts */

function parseAgentContext(req: Request, url: URL): AgentContext {
  const sparkSid = url.searchParams.get("sessionId") || req.headers.get("mcp-session-id") || "default";
  const agentId = req.headers.get("x-agent-id") || url.searchParams.get("agentId") || "default-agent";
  const role = (req.headers.get("x-agent-role") as AgentRole) || (url.searchParams.get("role") as AgentRole) || "implementer";
  const modelTier = (req.headers.get("x-agent-model") as any) || (url.searchParams.get("model") as any) || "sonnet";
  const credentialFingerprint = req.headers.get("authorization") || "shared-default-credential";
  return { sparkSid, agentId, role, modelTier, credentialFingerprint };
}

const server = Bun.serve({
  port: PORT, reusePort: true,
  async fetch(req) {
    const url = new URL(req.url);
    const path = url.pathname;

    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });

    if (path.includes("oauth-protected-resource")) return Response.json(oauthProtectedResource(), { headers: cors });
    if (path.includes("oauth-authorization-server")) return Response.json(oauthAuthorizationServer(), { headers: cors });
    if (path.endsWith("jwks.json")) return Response.json({ keys: [] }, { headers: cors });
    if (path.endsWith("/register")) return Response.json(oauthRegister(), { status: 201, headers: cors });
    if (path.endsWith("/authorize")) {
      const redir = url.searchParams.get("redirect_uri") || "https://oauth-redirect.googleusercontent.com/r/user_bound_custom-mcp-111554610217088906669-github-mcp-host_tailc9ac71_ts_net";
      const st = url.searchParams.get("state") || "";
      const u = new URL(redir);
      u.searchParams.set("code", `code_${randomBytes(8).toString("hex")}`);
      if (st) u.searchParams.set("state", st);
      return new Response(null, { status: 302, headers: { Location: u.toString(), ...cors } });
    }
    if (path.endsWith("/token")) return Response.json(oauthToken(), { headers: cors });

    if (path.endsWith("/health")) {
      return Response.json({
        ok: true, gatehouse: GATEHOUSE, alphaxiv: ALPHAXIV_MCP,
        agentSessions: agentSessions.size, poolEntries: pool.size,
        tiers: TIER_NAMES, vot: VOT_DESCRIPTION,
        subsystems: ["sheaf","operad","coalgebra","session","petri","membrane",
          "zx","topos","goi","realizability","choreography","cascade","dytopo",
          "research","emergent"],
      }, { headers: cors });
    }

    // ── SSE stream ──────────────────────────────────────────────────────────
    if (path.includes("gemini-mcp") || path.endsWith("/mcp")) {
      if (req.method === "GET") {
        server.timeout(req, 0);
        const ctx = parseAgentContext(req, url);
        const key = agentKey(ctx);
        await ensureAgentSession(ctx).catch(() => {});
        const sinkId = randomBytes(4).toString("hex");
        const stream = new ReadableStream({
          start(controller) {
            const sink: StreamSink = { id: sinkId, enqueue: (c) => controller.enqueue(c) };
            const set = agentStreams.get(key) ?? new Set<StreamSink>();
            set.add(sink); agentStreams.set(key, set);
            controller.enqueue(new TextEncoder().encode(
              `event: endpoint\ndata: ${url.origin}/gemini-mcp?sessionId=${ctx.sparkSid}&agentId=${ctx.agentId}\n\n`
            ));
          },
          cancel() {
            const set = agentStreams.get(key);
            if (set) { for (const s of set) if (s.id === sinkId) set.delete(s);
              if (set.size === 0) agentStreams.delete(key); }
          },
        });
        return new Response(stream, {
          headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", ...cors },
        });
      }

      if (req.method === "POST") {
        const ctx = parseAgentContext(req, url);
        const bodyText = await req.text();
        let body: any;
        try { body = JSON.parse(bodyText); }
        catch { return Response.json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "parse error" } }, { status: 400, headers: cors }); }

        const session = await ensureAgentSession(ctx);
        const method = body.method;
        const reqId = body.id ?? null;

        if (method === "server/discover") {
          return Response.json({
            jsonrpc: "2.0", id: reqId,
            result: {
              resultType: "complete",
              supportedVersions: ["2026-07-28", "2025-11-25"],
              capabilities: { tools: { listChanged: true } },
              _meta: {
                "io.modelcontextprotocol/serverInfo": { name: "doorbell-monad", version: "6.0.0" }
              },
              instructions: "Multi-tier MCP router. First tools/list returns select_tier.",
              ttlMs: 3600000,
              cacheScope: "public"
            },
          }, { headers: { "mcp-session-id": ctx.sparkSid, ...cors } });
        }

        let response: any;
        try {
          if (method === "initialize") {
            session.clientInfoName = body.params?.clientInfo?.name;
            bootGrokFullTier(session, req, session.clientInfoName);
            response = handleInitialize(session, reqId, body.params?.protocolVersion);
          }
          else if (method === "tools/list") response = handleToolsList(session, reqId, req, body.params?.clientInfo?.name ?? session.clientInfoName);
          else if (method === "tools/call") response = await handleToolsCall(session, reqId, body.params, req, session.clientInfoName);
          else if (method === "ping") response = { jsonrpc: "2.0", id: reqId, result: {} };
          else if (method === "notifications/initialized") return new Response(null, { status: 202, headers: cors });
          else if (method === "subscriptions/listen") {
            return Response.json({ jsonrpc: "2.0", id: reqId, result: { subscribed: true } },
              { headers: { "mcp-session-id": ctx.sparkSid, ...cors } });
          } else {
            const r = await gfetch(pool.get(session.poolKey)?.gateSid ?? null, body)();
            if (r.sid && pool.has(session.poolKey)) pool.get(session.poolKey)!.gateSid = r.sid;
            response = extractJson(r.text) || { jsonrpc: "2.0", id: reqId, error: { code: -32601, message: `unhandled: ${method}` } };
          }
        } catch (e: any) {
          response = { jsonrpc: "2.0", id: reqId, error: { code: -32000, message: `monad error: ${e.message}` } };
        }

        return Response.json(response, { headers: { "mcp-session-id": ctx.sparkSid, ...cors } });
      }

      if (req.method === "DELETE") {
        const ctx = parseAgentContext(req, url);
        const key = agentKey(ctx);
        agentSessions.delete(key); agentStreams.delete(key);
        await releasePoolEntry(ctx).catch(() => {});
        return new Response(null, { status: 204, headers: cors });
      }
    }

    return new Response("not found", { status: 404, headers: cors });
  },
});

setInterval(sweepSessions, SWEEP_INTERVAL_MS);

console.log(`[✓] doorbell-monad v6.0 EXTENDED MAXIMAL — :${PORT}`);
console.log(`    upstream: ${GATEHOUSE}`);
console.log(`    research: ${ALPHAXIV_MCP}`);
console.log(`    sheaf:    ${SIGMA_GUARD_URL}`);
console.log(`    zx:       ${ZX_MCP_URL}`);
console.log(`    petri:    ${PETRI_PILOT_URL}`);
console.log(`    tiers: ${TIER_NAMES.join(" | ")}`);
console.log(`    VoT:   ${VOT_LADDER.map(v => `${v}=${VOT_DESCRIPTION[v]}`).join(" ; ")}`);
console.log(`    agent-scoped sessions, shared pool with refcounting`);
console.log(`    monadic core: Task[F] with flatMap/attempt/raiseError`);
console.log(`    weird subsystems: sheaf, operad, coalgebra, session, petri, membrane, zx, topos, goi, realizability, choreography, cascade, dytopo`);
