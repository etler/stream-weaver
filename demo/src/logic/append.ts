/**
 * Reducer that appends items to an array
 * Used with createReducer to accumulate all iterable values
 */
export default <T>(acc: T[], item: T): T[] => [...acc, item];
