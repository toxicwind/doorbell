/**
 * Tier surfaces + resolveSurface deadlock fix.
 * Catalog is truth; tiers are views. Never hide select_tier behind auto-only
 * while auto itself requires select_tier. No silent full — unresolved → router.
 */
import type { TierName } from "./config.ts";
import { TIER_NAMES } from "./config.ts";
import { classifyTool, isReadOnly, type McpTool } from "./catalog.ts";

export function selectTierTool() {
  return {
    name: "select_tier",
    description:
      "Choose the tool surface for this agent session. Recommended: tier=router " +
      "(dispatchers without dumping the full catalog). Also: full | classified | " +
      "minimal | auto. Surface swaps and tools/list_changed fires.",
    inputSchema: {
      type: "object",
      properties: {
        tier: { type: "string", enum: TIER_NAMES },
      },
      required: ["tier"],
    },
  };
}

export function routerTool() {
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

export function listRoutesTool() {
  return {
    name: "list_routes",
    description: "List every tool on the underlying surface (name + class).",
    inputSchema: { type: "object", properties: {} },
  };
}

function classDispatcherTool(cls: "read" | "write" | "destructive") {
  const desc =
    cls === "read"
      ? "Dispatch to a read-only tool."
      : cls === "write"
        ? "Dispatch to a write or read tool. Destructive rejected."
        : "Dispatch to any tool. Requires confirm:true.";
  const props: any = { tool: { type: "string" }, args: { type: "object" } };
  if (cls === "destructive") props.confirm = { type: "boolean" };
  return {
    name: `call_${cls}`,
    description: desc,
    inputSchema: {
      type: "object",
      properties: props,
      required: cls === "destructive" ? ["tool", "confirm"] : ["tool"],
    },
  };
}

export function requestUpgradeTool() {
  return {
    name: "request_upgrade",
    description:
      "Request a higher tier with a short justification (JustificationPolicy). " +
      "Args: target_tier, reason.",
    inputSchema: {
      type: "object",
      properties: {
        target_tier: { type: "string", enum: TIER_NAMES },
        reason: { type: "string" },
      },
      required: ["target_tier", "reason"],
    },
  };
}

/** Base view for a resolved tier (without select_tier OR). */
export function tierView(tier: TierName, catalog: McpTool[]): any[] {
  switch (tier) {
    case "router":
      return [routerTool(), listRoutesTool(), classDispatcherTool("read"), classDispatcherTool("write"), classDispatcherTool("destructive")];
    case "classified":
      return [
        classDispatcherTool("read"),
        classDispatcherTool("write"),
        classDispatcherTool("destructive"),
        listRoutesTool(),
      ];
    case "minimal":
      return catalog.filter(isReadOnly);
    case "auto":
      // auto alone must still expose select_tier — never empty
      return [selectTierTool()];
    case "full":
      return catalog.slice();
    default:
      return [routerTool(), listRoutesTool()];
  }
}

export interface ResolveSurfaceInput {
  tier: TierName | null;
  exposeSelectTier: boolean;
  catalog: McpTool[];
  includeRequestUpgrade?: boolean;
}

/**
 * Deadlock-free surface resolution:
 * - If tier is null → select_tier only (agent must pick; policies should have
 *   already set router when no initialTier — null is transitional).
 * - Base = tierView(tier)
 * - If exposeSelectTier OR'd → ensure select_tier present
 * - auto view already includes select_tier; OR is idempotent
 */
export function resolveSurface(input: ResolveSurfaceInput): any[] {
  const { tier, exposeSelectTier, catalog, includeRequestUpgrade } = input;
  let tools: any[];
  // v7: null tier is router. select_tier is a view, not a gate.
  tools = tierView(tier ?? "router", catalog);
  if (exposeSelectTier && !tools.some((t) => t.name === "select_tier")) {
    tools = [...tools, selectTierTool()];
  }
  if (includeRequestUpgrade && !tools.some((t) => t.name === "request_upgrade")) {
    tools = [...tools, requestUpgradeTool()];
  }
  return tools.slice().sort((a, b) => String(a.name).localeCompare(String(b.name)));
}

export function snapshotTools(tools: any[]) {
  return tools.map((t) => ({
    name: t.name,
    description: t.description,
    class: t.name.startsWith("call_") || t.name === "route" || t.name === "select_tier" || t.name === "list_routes" || t.name === "request_upgrade"
      ? "synthetic"
      : classifyTool(t),
  }));
}
