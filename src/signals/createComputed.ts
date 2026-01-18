import { ComputedSignal, LogicSignal, AnySignal } from "./types";
import { SignalsToReadOnlyInterfaces } from "./logicTypes";
import { allocateDerivedId } from "./idAllocation";

/**
 * Creates a computed signal definition with full type safety
 *
 * Computed signals are derived values that re-execute when dependencies change.
 * They receive read-only access to their dependencies via SignalInterface<T>.
 *
 * When using a typed LogicSignal (from import()), the function validates:
 * - Dependencies match the expected function parameter types
 * - Return type is inferred from the logic function
 *
 * The ID is content-addressable: same logic + deps = same ID (idempotent)
 *
 * @example
 * // With typed logic (full type checking)
 * const count = createSignal(5);  // StateSignal<number>
 * const doubleLogic = createLogic(import("./double"));
 * const doubled = createComputed(doubleLogic, [count]);  // ComputedSignal<number>
 *
 * @example
 * // With untyped logic (backwards compatible)
 * const legacyLogic = createLogic("./legacy.js");
 * const result = createComputed(legacyLogic, [count]);  // ComputedSignal<unknown>
 */

// Overload 1: Typed logic with dependency validation
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createComputed<F extends (...args: any[]) => any, Deps extends readonly AnySignal[]>(
  logic: LogicSignal<F>,
  deps: Deps & (SignalsToReadOnlyInterfaces<Deps> extends Parameters<F> ? Deps : never),
  init?: ReturnType<F>,
): ComputedSignal<ReturnType<F>>;

// Overload 2: Untyped logic (backwards compatible)
export function createComputed(logic: LogicSignal, deps: AnySignal[], init?: unknown): ComputedSignal;

// Implementation
export function createComputed(logic: LogicSignal, deps: AnySignal[], init?: unknown): ComputedSignal {
  const depIds = deps.map((dep) => dep.id);
  const id = allocateDerivedId(logic.id, depIds);

  return {
    id,
    kind: "computed",
    logic: logic.id,
    deps: depIds,
    init,
    logicRef: logic,
  };
}
