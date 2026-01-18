/**
 * Computed logic that returns a checkmark when value is true
 */
import type { SignalInterface } from "stream-weaver";

export default function checkmark(completed: SignalInterface<boolean>): string {
  return completed.value ? "✓" : "";
}
