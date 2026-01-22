import { WeaverRegistry } from "@/registry/WeaverRegistry";
import type { ReducerSignal, LogicSignal } from "@/signals/types";
import { loadLogic } from "./loadLogic";
import { isServer } from "@/utils/environment";

/**
 * Check if a value is an async iterable
 */
function isAsyncIterable(value: unknown): value is AsyncIterable<unknown> {
  return value != null && typeof value === "object" && Symbol.asyncIterator in value;
}

/**
 * Check if a value is a sync iterable
 */
function isIterable(value: unknown): value is Iterable<unknown> {
  return value != null && typeof value === "object" && Symbol.iterator in value;
}

/**
 * Executes a reducer signal by iterating over the source iterable
 * and applying the reducer function for each item
 *
 * Reducer signals are client-only for the initial implementation:
 * - SSR emits the init value
 * - Client starts the iteration after hydration
 * - All reducer updates happen client-side
 *
 * @param registry - WeaverRegistry instance
 * @param reducerId - ID of the ReducerSignal to execute
 */
export async function executeReducer(registry: WeaverRegistry, reducerId: string): Promise<void> {
  // Reducers are client-only - on server, just set init value
  if (isServer()) {
    const reducer = registry.getSignal(reducerId);
    if (reducer?.kind === "reducer") {
      registry.setValue(reducerId, reducer.init);
    }
    return;
  }

  // Get the reducer signal definition
  const reducer = registry.getSignal(reducerId);
  if (reducer?.kind !== "reducer") {
    throw new Error(`Signal ${reducerId} is not a reducer signal`);
  }

  const reducerSignal = reducer as ReducerSignal;

  // Get the source signal's value (should be an iterable)
  const sourceValue = registry.getValue(reducerSignal.source);

  if (!isAsyncIterable(sourceValue) && !isIterable(sourceValue)) {
    throw new Error(
      `Source signal ${reducerSignal.source} value is not iterable. ` +
        `Expected ReadableStream, Array, Generator, or any Iterable/AsyncIterable.`,
    );
  }

  // Get the reducer logic signal
  const reducerLogicSignal = registry.getSignal(reducerSignal.reducer);
  if (reducerLogicSignal?.kind !== "logic") {
    throw new Error(`Reducer signal ${reducerSignal.reducer} not found or is not a logic signal`);
  }

  // Load the reducer function
  const reducerFn = await loadLogic(reducerLogicSignal as LogicSignal);

  // Initialize accumulator with init value
  let accumulator: unknown = reducerSignal.init;
  registry.setValue(reducerId, accumulator);

  // Iterate over the source and apply reducer for each item
  // This works with both sync and async iterables
  if (isAsyncIterable(sourceValue)) {
    // Async iteration (ReadableStream, AsyncGenerator, etc.)
    for await (const value of sourceValue) {
      // Apply reducer: accumulator = reducer(accumulator, item)
      accumulator = reducerFn(accumulator, value);

      // Update registry with new value (triggers reactive updates)
      registry.setValue(reducerId, accumulator);
    }
  } else {
    // Sync iteration (Array, Generator, etc.)
    for (const value of sourceValue) {
      // Apply reducer: accumulator = reducer(accumulator, item)
      accumulator = reducerFn(accumulator, value);

      // Update registry with new value (triggers reactive updates)
      registry.setValue(reducerId, accumulator);
    }
  }
}
