import { ComputedSignal, LogicSignal, AnySignal } from "./types";
import { LogicFunction, ValidateComputedDeps } from "./logicTypes";
import { allocateDerivedId } from "./idAllocation";
import type { Serializable } from "./serializableTypes";

/**
 * Creates a computed signal definition with full type safety
 *
 * Computed signals are derived values that re-execute when dependencies change.
 * They receive read-only access to their signal dependency values.
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
 * const count = defineSignal(5);  // StateSignal<number>
 * const doubleLogic = defineLogic(import("./double"));
 * const doubled = defineComputed(doubleLogic, [count]);  // ComputedSignal<number>
 *
 * @example
 * // With untyped logic (backwards compatible)
 * const legacyLogic = defineLogic("./legacy.js");
 * const result = defineComputed(legacyLogic, [count]);  // ComputedSignal<unknown>
 */

// Single signature with validation - const Deps ensures tuple inference
// Init must be both the correct return type AND Serializable for SSR transmission
export function defineComputed<F extends LogicFunction, const Deps extends readonly AnySignal[]>(
  logic: LogicSignal<F>,
  deps: ValidateComputedDeps<F, Deps>,
  init?: Awaited<ReturnType<F>> & Serializable,
): ComputedSignal<ReturnType<F>>;

// Implementation
export function defineComputed(logic: LogicSignal, deps: AnySignal[], init?: unknown): ComputedSignal {
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
