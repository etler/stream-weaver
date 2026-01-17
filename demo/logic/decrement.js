/**
 * Handler logic for decrementing a counter
 * @param {Event} _event - The event object (unused)
 * @param {Object} count - Signal interface with .value getter/setter
 */
export default function decrement(_event, count) {
  count.value = count.value - 1;
}
