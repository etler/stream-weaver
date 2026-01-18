/**
 * Base Signal interface
 * All signals extend this base interface
 */
export interface Signal {
  id: string; // Globally unique identifier
  kind: string; // Discriminator for signal type
}

/**
 * StateSignal represents a reactive state container
 * These are source signals that can be mutated
 */
export interface StateSignal<T = unknown> extends Signal {
  init: T; // Initial value
  value: T; // Current value (on server, same as init; on client, from registry)
  kind: "state";
}

/**
 * LogicSignal represents an addressable reference to executable code
 * These are const signals (immutable) that other signals reference by ID
 */
export interface LogicSignal extends Signal {
  src: string; // Module URL for runtime import
  kind: "logic";
}

/**
 * ComputedSignal represents a derived value that re-executes when dependencies change
 * These are dependent signals (read-only access to dependencies)
 */
export interface ComputedSignal extends Signal {
  logic: string; // LogicSignal ID reference
  deps: string[]; // Array of dependency signal IDs
  kind: "computed";
}

/**
 * ActionSignal represents an imperative operation that can mutate signals
 * These are source signals (writable access to dependencies)
 */
export interface ActionSignal extends Signal {
  logic: string; // LogicSignal ID reference
  deps: string[]; // Array of dependency signal IDs
  kind: "action";
}

/**
 * HandlerSignal is a specialized ActionSignal for event handling
 */
export interface HandlerSignal extends Signal {
  logic: string; // LogicSignal ID reference
  deps: string[]; // Array of dependency signal IDs
  kind: "handler";
}

/**
 * ComponentSignal represents a reusable component template
 * This is an inert definition - use createNode() to create reactive instances
 */
export interface ComponentSignal extends Signal {
  logic: LogicSignal | string; // LogicSignal definition or ID reference
  kind: "component";
}

/**
 * NodeSignal represents a component instance with bound props
 * Nodes are reactive - they re-render when prop signals change
 */
export interface NodeSignal extends Signal {
  logic: string; // LogicSignal ID reference (from the ComponentSignal)
  component: string; // ComponentSignal ID reference
  props: Record<string, unknown>; // Props object (signals or primitives)
  deps: string[]; // Array of signal IDs extracted from props
  kind: "node";
  // Non-serializable references for runtime use
  _logicRef?: LogicSignal;
  _componentRef?: ComponentSignal;
}

/**
 * Discriminated union of all signal types
 */
export type AnySignal =
  | StateSignal
  | LogicSignal
  | ComputedSignal
  | ActionSignal
  | HandlerSignal
  | ComponentSignal
  | NodeSignal;
