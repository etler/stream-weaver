import { ActionSignal, LogicSignal, AnySignal } from "./types";
import { LogicFunction, ValidateActionDeps } from "./logicTypes";
import { allocateDerivedId } from "./idAllocation";

/**
 * Creates an action signal definition with full type safety
 *
 * Actions are imperative operations that can mutate signals.
 * They receive writable access to their dependencies via WritableSignalInterface<T>.
 *
 * When using a typed LogicSignal (from import()), the function validates:
 * - Dependencies match the expected function parameter types
 *
 * The ID is content-addressable: same logic + deps = same ID (idempotent)
 *
 * @example
 * // With typed logic (full type checking)
 * const count = createSignal(5);  // StateSignal<number>
 * const incrementLogic = createLogic(import("./increment"));
 * const increment = createAction(incrementLogic, [count]);  // Type-checked!
 *
 * @example
 * // With untyped logic (backwards compatible)
 * const legacyLogic = createLogic("./legacy.js");
 * const action = createAction(legacyLogic, [count]);  // No type checking
 */

// Single signature with validation - const Deps ensures tuple inference
export function createAction<F extends LogicFunction, const Deps extends readonly AnySignal[]>(
  logic: LogicSignal<F>,
  deps: ValidateActionDeps<F, Deps>,
): ActionSignal;

// Implementation
export function createAction(logic: LogicSignal, deps: AnySignal[]): ActionSignal {
  const depIds = deps.map((dep) => dep.id);
  const id = allocateDerivedId(logic.id, depIds);

  return {
    id,
    kind: "action",
    logic: logic.id,
    deps: depIds,
    logicRef: logic,
  };
}
