/**
 * Reducer that keeps only the latest value
 * Used with defineReducer to always show the most recent item
 */
export default <T>(_acc: T, item: T): T => item;
