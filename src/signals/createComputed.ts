import { ComputedSignal, LogicSignal, AnySignal } from "./types";
import { allocateDerivedId } from "./idAllocation";

/**
 * Creates a computed signal definition
 * Computed signals are derived values that re-execute when dependencies change
 * They receive read-only access to their dependencies
 *
 * The ID is content-addressable: same logic + deps = same ID (idempotent)
 *
 * @param logic - LogicSignal reference
 * @param deps - Array of signal dependencies
 * @param init - Optional initial value for SSR (since logic can't execute server-side)
 * @returns ComputedSignal definition object
 */
export function createComputed(logic: LogicSignal, deps: AnySignal[], init?: unknown): ComputedSignal {
  const depIds = deps.map((dep) => dep.id);
  const id = allocateDerivedId(logic.id, depIds);

  return {
    id,
    kind: "computed",
    logic: logic.id,
    deps: depIds,
    init,
    logicRef: logic, // Store reference for SSR tokenization
  } as ComputedSignal;
}
