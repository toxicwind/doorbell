/** Shared doorbell ADTs */
export type VoT = "R" | "C" | "H" | "O";
export type ToolClass = "read" | "write" | "destructive" | "admin";
export type AgentRole =
  | "researcher" | "implementer" | "reviewer" | "orchestrator"
  | "observer" | "admin" | "sheaf-keeper" | "petri-master" | "membrane-warden";

export type Tier =
  | { _tag: "Full" } | { _tag: "Router" } | { _tag: "Classified" }
  | { _tag: "Minimal" } | { _tag: "Sheaf" } | { _tag: "Operad" }
  | { _tag: "Coalgebra" } | { _tag: "Session" } | { _tag: "Petri" }
  | { _tag: "Membrane" } | { _tag: "ZX" } | { _tag: "Topos" }
  | { _tag: "GoI" } | { _tag: "Realizability" } | { _tag: "Choreography" }
  | { _tag: "Cascade" } | { _tag: "DyTopo" } | { _tag: "Research" }
  | { _tag: "Emergent"; topology: VoT } | { _tag: "Auto" };

export interface AgentContext {
  agentId: string;
  role?: string;
  model?: string;
  sparkSid?: string;
  [k: string]: unknown;
}

export interface AgentSession {
  ctx: AgentContext;
  tier: Tier | null;
  autoTierPending: boolean;
  clientInfoName?: string;
  [k: string]: unknown;
}
