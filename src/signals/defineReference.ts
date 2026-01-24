import type { ReferenceSignal, Signal } from "./types";
import { allocateDerivedId } from "./idAllocation";

/**
 * Creates a reference signal that wraps another signal definition.
 *
 * Reference signals prevent the wrapped signal from being resolved to its value
 * when passed as a dependency to computed signals or as a prop to components.
 * Instead, the receiving code gets access to the signal definition itself.
 *
 * This is useful for:
 * - Passing signals to computed logic that needs the definition, not the value
 * - Passing signals to components so they can create handlers that mutate them
 * - Forwarding signals through multiple component levels
 *
 * Note: Actions and handlers already receive writable StateSignal objects directly,
 * so they don't need defineReference.
 *
 * Uses content-addressable IDs: same wrapped signal = same reference ID.
 *
 * @template T - The type of the wrapped signal
 * @param signal - The signal definition to wrap
 * @returns ReferenceSignal containing the wrapped signal's ID
 *
 * @example
 * ```typescript
 * const count = defineSignal(0);
 * const countRef = defineReference(count);
 *
 * // Pass to computed - receives signal definition instead of value
 * const derived = defineComputed(import("./logic"), [countRef]);
 *
 * // Pass to component - child can create handlers for it
 * <Counter signal={countRef} />
 * ```
 */
export function defineReference<T extends Signal>(signal: T): ReferenceSignal<T> {
  // Content-addressable ID: hash of "ref" prefix + wrapped signal ID
  // Same wrapped signal always produces the same reference ID
  const id = allocateDerivedId("ref", [signal.id]);

  return {
    id,
    kind: "reference",
    ref: signal.id,
  };
}
