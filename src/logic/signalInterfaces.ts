import { WeaverRegistry } from "@/registry/WeaverRegistry";

/**
 * Signal interface that provides .value access to the registry
 * This is what logic functions receive as parameters
 */
export interface SignalInterface<T = unknown> {
  readonly value: T;
}

/**
 * Writable signal interface for actions and handlers
 */
export interface SignalMutator<T = unknown> {
  value: T;
}

/**
 * Creates a writable signal interface
 * Used internally for MutatorSignal resolution
 * In M3, this directly mutates the registry
 * In M4+, this will emit events to the SignalDelegate stream
 *
 * @param registry - WeaverRegistry instance
 * @param id - Signal ID
 * @returns Writable interface with .value getter and setter
 */
export function createSignalMutator<T = unknown>(registry: WeaverRegistry, id: string): SignalMutator<T> {
  return {
    get value(): T {
      // Type assertion is safe here - caller provides correct type parameter
      // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
      return registry.getValue(id) as T;
    },
    set value(newValue: T) {
      // In M3: direct mutation for testing
      // In M4+: this will emit signal-update events to the stream
      registry.setValue(id, newValue);
    },
  };
}

/**
 * Creates the appropriate interface for an action/handler dependency
 *
 * - MutatorSignal: returns WritableSignalInterface to wrapped StateSignal
 * - Other signals: returns raw value from registry (read-only)
 *
 * This implements the mutation model where actions/handlers receive unwrapped values
 * by default, and only get writable access through explicit MutatorSignal wrapping.
 *
 * @param registry - WeaverRegistry instance
 * @param depId - Dependency signal ID
 * @returns WritableSignalInterface for mutators, raw value for others
 */
export function createActionDependencyInterface(registry: WeaverRegistry, depId: string): unknown {
  const signal = registry.getSignal(depId);

  if (!signal) {
    // Signal not found, return undefined
    return undefined;
  }

  if (signal.kind === "mutator") {
    // MutatorSignal: return writable interface to the wrapped StateSignal
    return createSignalMutator(registry, signal.ref);
  }

  // All other signals: return raw value (read-only)
  return registry.getValue(depId);
}
