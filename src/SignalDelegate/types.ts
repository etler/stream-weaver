/**
 * SignalEvent represents an event in the reactive stream
 * These events flow through the SignalDelegate to trigger reactive updates
 */
export interface SignalUpdateEvent {
  kind: "signal-update";
  id: string; // Signal ID that was updated
  value: unknown; // New value
}

/**
 * Union type for all signal events
 * Currently only signal-update, but could be extended for other event types
 */
export type SignalEvent = SignalUpdateEvent;

/**
 * Token represents output from the SignalDelegate stream
 * For M4, we emit signal-update events as tokens
 * In later milestones, we may add other token types
 */
export type SignalToken = SignalUpdateEvent;
