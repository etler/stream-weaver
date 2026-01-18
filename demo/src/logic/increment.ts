/**
 * Handler logic for incrementing a counter
 */
import type { WritableSignalInterface } from "stream-weaver";

export default function increment(_event: Event, count: WritableSignalInterface<number>): void {
  count.value = count.value + 1;
}
