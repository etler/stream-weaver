import { ActionSignal, LogicSignal, AnySignal } from "./types";
import { allocateDerivedId } from "./idAllocation";

/**
 * Creates an action signal definition
 * Actions are imperative operations that can mutate signals
 * They receive writable access to their dependencies
 *
 * The ID is content-addressable: same logic + deps = same ID (idempotent)
 *
 * @param logic - LogicSignal reference
 * @param deps - Array of signal dependencies
 * @returns ActionSignal definition object
 */
export function createAction(logic: LogicSignal, deps: AnySignal[]): ActionSignal {
  const depIds = deps.map((dep) => dep.id);
  const id = allocateDerivedId(logic.id, depIds);

  return {
    id,
    kind: "action",
    logic: logic.id,
    deps: depIds,
    logicRef: logic, // Store reference for SSR tokenization
  } as ActionSignal;
}
