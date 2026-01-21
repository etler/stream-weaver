/**
 * PENDING sentinel for deferred logic execution
 *
 * Used to represent a value that is still being computed asynchronously.
 * This allows the stream to continue while async logic executes in the background.
 */
export const PENDING: unique symbol = Symbol("PENDING");

/**
 * Type helper for values that may be pending
 * Use this for signal values that could be in a pending state
 */
export type MaybePending<T> = T | typeof PENDING;
