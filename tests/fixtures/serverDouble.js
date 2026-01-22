/**
 * Server-side double logic - multiplies a signal value by 2
 * This would typically contain server-specific code like DB access
 * @param {object} count - Signal with .value property
 * @returns {number} The doubled value
 */
export default (count) => count.value * 2;
