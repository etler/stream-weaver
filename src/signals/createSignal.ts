import { StateSignal } from "./types";
import { allocateSourceId } from "./idAllocation";

/**
 * Creates a new state signal definition
 * This returns an inert metadata object - the actual value
 * is stored in the WeaverRegistry when the signal is registered
 *
 * @param init - Initial value for the signal
 * @returns StateSignal definition object
 */
export function createSignal<T>(init: T): StateSignal<T> {
  return {
    id: allocateSourceId(),
    kind: "state",
    init,
  };
}
