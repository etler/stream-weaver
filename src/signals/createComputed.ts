import { ComputedSignal, LogicSignal, AnySignal } from "./types";
import { LogicFunction, ValidateComputedDeps } from "./logicTypes";
import { allocateDerivedId } from "./idAllocation";
import type { Serializable } from "./serializableTypes";

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
 * The init value must be JSON-serializable so it can be transmitted
 * between server and client during SSR/resumption.
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

// Single signature with validation - const Deps ensures tuple inference
// Init must be both the correct return type AND Serializable for SSR transmission
export function createComputed<F extends LogicFunction, const Deps extends readonly AnySignal[]>(
  logic: LogicSignal<F>,
  deps: ValidateComputedDeps<F, Deps>,
  init?: ReturnType<F> & Serializable,
): ComputedSignal<ReturnType<F>>;

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
    depsRef: deps,
  };
}
