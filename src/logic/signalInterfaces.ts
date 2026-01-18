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
export interface WritableSignalInterface<T = unknown> {
  value: T;
}

/**
 * Creates a read-only signal interface
 * Used for computed signals and components - they can only read dependencies
 *
 * @param registry - WeaverRegistry instance
 * @param id - Signal ID
 * @returns Read-only interface with .value getter
 */
export function createReadOnlySignalInterface<T = unknown>(registry: WeaverRegistry, id: string): SignalInterface<T> {
  return {
    get value(): T {
      // Type assertion is safe here - caller provides correct type parameter
      // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
      return registry.getValue(id) as T;
    },
  };
}

/**
 * Creates a writable signal interface
 * Used for actions and handlers - they can mutate dependencies
 * In M3, this directly mutates the registry
 * In M4+, this will emit events to the SignalDelegate stream
 *
 * @param registry - WeaverRegistry instance
 * @param id - Signal ID
 * @returns Writable interface with .value getter and setter
 */
export function createWritableSignalInterface<T = unknown>(
  registry: WeaverRegistry,
  id: string,
): WritableSignalInterface<T> {
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
