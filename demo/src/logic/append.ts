/**
 * Reducer that appends items to an array
 * Used with createStream to accumulate all stream values
 */
export default <T>(acc: T[], item: T): T[] => [...acc, item];
