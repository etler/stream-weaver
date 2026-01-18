/**
 * Computed logic that returns a checkmark when value is true
 */
interface SignalInterface {
  value: boolean;
}

export default function checkmark(completed: SignalInterface): string {
  return completed.value ? "✓" : "";
}
