import { StateSignal } from "./types";
import { allocateSourceId } from "./idAllocation";
import type { Serializable } from "./serializableTypes";

/**
 * Creates a new state signal definition
 * This returns an inert metadata object - the actual value
 * is stored in the WeaverRegistry when the signal is registered
 *
 * The init value must be JSON-serializable so it can be transmitted
 * between server and client during SSR/resumption.
 *
 * @param init - Initial value for the signal (must be JSON-serializable)
 * @returns StateSignal definition object
 */
export function createSignal<T extends Serializable>(init: T): StateSignal<T> {
  return {
    id: allocateSourceId(),
    kind: "state",
    init,
    value: init, // On server, value equals init
  };
}
