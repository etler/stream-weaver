/**
 * Handler logic for refreshing data
 * Increments the refresh counter to trigger a re-fetch
 */
import type { WritableSignalInterface } from "stream-weaver";

export default function incrementRefresh(_event: Event, refreshCount: WritableSignalInterface<number>): void {
  refreshCount.value = refreshCount.value + 1;
}
