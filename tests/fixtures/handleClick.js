/**
 * Click handler logic - increments count when event occurs
 * @param {Event} event - The DOM event
 * @param {object} count - Signal with writable .value property
 */
export default (event, count) => {
  count.value++;
};
