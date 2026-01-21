/**
 * Slow increment - takes 1 second to complete
 * Used to demonstrate blocking vs deferred execution
 */
import type { WritableSignalInterface } from "stream-weaver";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export default async function slowIncrement(
  _event: Event,
  count: WritableSignalInterface<number>,
): Promise<void> {
  await delay(1000);
  count.value = count.value + 1;
}
