import { StateSignal } from "./types";

/**
 * Module-level counter for generating unique signal IDs
 * This counter persists across all createSignal calls
 */
let signalIdCounter = 0;

/**
 * Generates a unique ID for a source signal
 * @returns A unique signal ID (e.g., 's1', 's2', ...)
 */
function allocateSignalId(): string {
  signalIdCounter++;
  return `s${signalIdCounter}`;
}

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
    id: allocateSignalId(),
    kind: "state",
    init,
  };
}
