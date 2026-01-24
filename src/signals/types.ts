import type { LogicFunction } from "./logicTypes";

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
 *
 * @template F - The function signature of the logic module's default export
 *               Used for compile-time type checking of dependencies
 */
export interface LogicSignal<F extends LogicFunction = LogicFunction> extends Signal {
  src: string; // Client-side module path (absolute, for /@fs/ loading)
  ssrSrc?: string; // SSR module path (relative, for Node.js import)
  kind: "logic";
  /**
   * Timeout in milliseconds for deferred execution (M12)
   * - undefined = no timeout, always inline (blocking)
   * - 0 = always defer immediately (never block)
   * - > 0 = wait up to N ms, then defer if not complete
   * Note: timeout only affects async logic; sync functions execute immediately regardless
   */
  timeout?: number;
  /**
   * Execution context restriction (M12)
   * - undefined = execute anywhere
   * - 'client' = only execute on client (returns PENDING on server)
   * - 'server' = only execute on server (M13)
   * - 'worker' = execute in worker thread (M16)
   */
  context?: "server" | "client" | "worker";
  /** @internal Phantom property for compile-time function signature tracking - never set at runtime */
  readonly _functionType?: F;
}

/**
 * ComputedSignal represents a derived value that re-executes when dependencies change
 * These are dependent signals (read-only access to dependencies)
 *
 * @template T - The computed value type (inferred from logic return type)
 */
export interface ComputedSignal<T = unknown> extends Signal {
  logic: string; // LogicSignal ID reference
  deps: string[]; // Array of dependency signal IDs
  kind: "computed";
  init?: T; // Optional initial value
  logicRef?: LogicSignal; // Reference for SSR tokenization
  depsRef?: AnySignal[]; // References to dependency signals for SSR serialization
}

/**
 * ActionSignal represents an imperative operation that can mutate signals
 * These are source signals (writable access to dependencies)
 */
export interface ActionSignal extends Signal {
  logic: string; // LogicSignal ID reference
  deps: string[]; // Array of dependency signal IDs
  kind: "action";
  logicRef?: LogicSignal; // Reference for SSR tokenization
  depsRef?: AnySignal[]; // References to dependency signals for SSR serialization
}

/**
 * HandlerSignal is a specialized ActionSignal for event handling
 *
 * @template TEvent - The event type this handler expects (default: Event)
 */
export interface HandlerSignal<TEvent extends Event = Event> extends Signal {
  logic: string; // LogicSignal ID reference
  deps: string[]; // Array of dependency signal IDs
  kind: "handler";
  logicRef?: LogicSignal; // Reference for SSR tokenization
  depsRef?: AnySignal[]; // References to dependency signals for SSR serialization
  /** @internal Phantom property for compile-time event type tracking - never set at runtime */
  readonly _eventType?: TEvent;
}

/**
 * ComponentSignal represents a reusable component template
 * This is an inert definition - use defineNode() to create reactive instances
 *
 * The call signature is for JSX type compatibility - ComponentSignal objects
 * are not actually callable at runtime, but TypeScript requires element types
 * to be callable. The jsx() function handles ComponentSignal specially.
 */
export interface ComponentSignal extends Signal {
  logic: LogicSignal | string; // LogicSignal definition or ID reference
  kind: "component";
  // JSX call signature - allows <ComponentSignal props={...} /> syntax
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (props: Record<string, any>): NodeSignal;
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
 * SuspenseSignal represents a suspense boundary that shows fallback while children are pending
 * Used to handle async loading states in React-style JSX
 */
export interface SuspenseSignal extends Signal {
  kind: "suspense";
  fallback: unknown; // Fallback JSX content to show while pending (Node type)
  children: unknown; // Children JSX content (Node type)
  pendingDeps: string[]; // Signal IDs that are currently PENDING
  // Pre-rendered children HTML for client-side resolution
  _childrenHtml?: string;
}

/**
 * ReducerSignal represents a derived value that reduces items from an iterable
 * As items arrive from the iterable, the reducer is applied and the value is updated
 *
 * Works with any iterable including ReadableStream, Array, Generator, AsyncGenerator
 *
 * @template T - The accumulated value type
 */
export interface ReducerSignal<T = unknown> extends Signal {
  kind: "reducer";
  source: string; // Signal ID whose value is an iterable
  reducer: string; // LogicSignal ID for reducer function (acc, item) => acc
  init: T; // Initial accumulator value
  // Runtime references for convenience
  sourceRef?: AnySignal;
  reducerRef?: LogicSignal;
}

/**
 * ReferenceSignal wraps another signal definition, preventing resolution to its value.
 * Used to pass signal definitions themselves to computed logic or component props,
 * instead of their resolved values.
 *
 * This is a derived signal that uses content-addressable IDs based on the wrapped signal.
 * Same wrapped signal = same reference ID.
 *
 * @template T - The type of the wrapped signal (for TypeScript inference)
 */
export interface ReferenceSignal<T extends Signal = Signal> extends Signal {
  kind: "reference";
  ref: string; // ID of the wrapped signal
  /** @internal Phantom property for compile-time type tracking - never set at runtime */
  readonly _type?: T;
}

/**
 * MutatorSignal wraps a StateSignal to provide writable interface access in actions/handlers.
 * This is the ONLY way to get mutation access to a signal from within logic.
 *
 * Constraints enforced by TypeScript:
 * 1. Can only wrap StateSignal (not computed or other derived signals)
 * 2. Can only be passed to defineAction() or defineHandler() (not defineComputed or components)
 *
 * This is a derived signal that uses content-addressable IDs based on the wrapped signal.
 * Same wrapped signal = same mutator ID.
 *
 * @template T - The value type of the wrapped StateSignal
 */
export interface MutatorSignal<T = unknown> extends Signal {
  kind: "mutator";
  ref: string; // ID of the wrapped StateSignal
  /** @internal Phantom property for compile-time type tracking - never set at runtime */
  readonly _type?: T;
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
  | NodeSignal
  | SuspenseSignal
  | ReducerSignal
  | ReferenceSignal
  | MutatorSignal;
