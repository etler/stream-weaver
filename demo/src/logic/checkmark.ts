/**
 * Computed logic that returns a checkmark when value is true
 */

export default function checkmark(completed: boolean): string {
  return completed ? "✓" : "";
}
