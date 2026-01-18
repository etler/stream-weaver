import { ActionSignal, LogicSignal, AnySignal } from "./types";
import { SignalsToWritableInterfaces } from "./logicTypes";
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

// Overload 1: Typed logic with dependency validation
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createAction<F extends (...args: any[]) => void, Deps extends readonly AnySignal[]>(
  logic: LogicSignal<F>,
  deps: Deps & (SignalsToWritableInterfaces<Deps> extends Parameters<F> ? Deps : never),
): ActionSignal;

// Overload 2: Untyped logic (backwards compatible)
export function createAction(logic: LogicSignal, deps: AnySignal[]): ActionSignal;

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
