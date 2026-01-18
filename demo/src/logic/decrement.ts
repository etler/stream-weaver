/**
 * Handler logic for decrementing a counter
 */
import type { WritableSignalInterface } from "stream-weaver";

export default function decrement(_event: Event, count: WritableSignalInterface<number>): void {
  count.value = count.value - 1;
}
