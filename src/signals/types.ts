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
  kind: "state";
}

/**
 * Discriminated union of all signal types
 * This will be extended as more signal types are added in later milestones
 */
export type AnySignal = StateSignal;
