/**
 * Handler logic for toggling a boolean value
 * @param {Event} _event - The event object (unused)
 * @param {Object} value - Signal interface with .value getter/setter
 */
export default function toggle(_event, value) {
  value.value = !value.value;
}
