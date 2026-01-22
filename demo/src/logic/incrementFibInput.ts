/**
 * Handler logic to increment the Fibonacci input
 */
import type { WritableSignalInterface } from "stream-weaver";

export default function incrementFibInput(_event: Event, fibInput: WritableSignalInterface<number>): void {
  fibInput.value = fibInput.value + 1;
}
