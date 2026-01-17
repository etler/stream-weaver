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
 * HandlerExecuteEvent represents a request to execute a handler
 */
export interface HandlerExecuteEvent {
  kind: "handler-execute";
  id: string; // Handler signal ID
  event: Event; // DOM event that triggered the handler
}

/**
 * Union type for all signal events
 */
export type SignalEvent = SignalUpdateEvent | HandlerExecuteEvent;

/**
 * Token represents output from the SignalDelegate stream
 */
export type SignalToken = SignalUpdateEvent;
