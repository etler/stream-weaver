/**
 * Computed logic for doubling a value
 */
import type { SignalInterface } from "stream-weaver";

export default function double(count: SignalInterface<number>): number {
  return count.value * 2;
}
