/**
 * Increment logic - increments a signal value by 1
 * @param {object} count - Signal with writable .value property
 */
export default (count) => {
  count.value++;
};
