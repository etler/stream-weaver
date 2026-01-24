/**
 * Handler logic to increment the prime limit by 10000
 */
import type { WritableSignalInterface } from "stream-weaver";

export default function incrementPrimeLimit(_event: Event, primeLimit: WritableSignalInterface<number>): void {
  primeLimit.value = primeLimit.value + 100000;
}
