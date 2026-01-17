/**
 * Computed logic for doubling a value
 * @param {Object} count - Signal interface with .value getter
 * @returns {number} The doubled value
 */
export default function double(count) {
  return count.value * 2;
}
