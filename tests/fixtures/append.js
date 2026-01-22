/**
 * Reducer that appends items to an array
 * @param {Array} acc - Accumulator array
 * @param {*} item - Item to append
 * @returns {Array} New array with item appended
 */
export default (acc, item) => [...acc, item];
