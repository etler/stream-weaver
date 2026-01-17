/**
 * Computed logic that returns a checkmark when value is true
 * @param {Object} completed - Signal interface with .value getter
 * @returns {string} Checkmark character or empty string
 */
export default function checkmark(completed) {
  return completed.value ? "✓" : "";
}
