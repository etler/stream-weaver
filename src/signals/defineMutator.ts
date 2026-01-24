import type { MutatorSignal, StateSignal } from "./types";
import { allocateDerivedId } from "./idAllocation";

/**
 * Creates a mutator signal that wraps a state signal for mutation access.
 *
 * Mutator signals provide a writable interface when passed to action or handler logic.
 * This is the ONLY way to get mutation access to a signal from within logic.
 *
 * By default, all logic (computed, action, handler, component) receives unwrapped values
 * from dependencies. When you need to mutate a state signal from within action or handler
 * logic, wrap it with defineMutator().
 *
 * TypeScript enforces two constraints:
 * 1. defineMutator() can only wrap StateSignal (not computed or other derived signals)
 * 2. MutatorSignal can only be passed to defineAction() or defineHandler()
 *
 * Uses content-addressable IDs: same wrapped signal = same mutator ID.
 *
 * @template T - The value type of the wrapped StateSignal
 * @param signal - The StateSignal to wrap
 * @returns MutatorSignal containing the wrapped signal's ID
 *
 * @example
 * ```typescript
 * const count = defineSignal(0);
 * const countMutator = defineMutator(count);
 *
 * // Action receives writable interface for mutator
 * const increment = defineAction(import("./increment"), [countMutator]);
 *
 * // increment.ts
 * export default (count: WritableSignalInterface<number>) => {
 *   count.value++;
 * };
 * ```
 */
export function defineMutator<T>(signal: StateSignal<T>): MutatorSignal<T> {
  // Content-addressable ID: hash of "mut" prefix + wrapped signal ID
  // Same wrapped signal always produces the same mutator ID
  const id = allocateDerivedId("mut", [signal.id]);

  return {
    id,
    kind: "mutator",
    ref: signal.id,
  };
}
