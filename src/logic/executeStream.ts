import { WeaverRegistry } from "@/registry/WeaverRegistry";
import type { StreamSignal, LogicSignal } from "@/signals/types";
import { loadLogic } from "./loadLogic";
import { isServer } from "@/utils/environment";

/**
 * Executes a stream signal by subscribing to the source ReadableStream
 * and applying the reducer function for each item
 *
 * Stream signals are client-only for the initial implementation:
 * - SSR emits the init value
 * - Client starts the stream subscription after hydration
 * - All stream updates happen client-side
 *
 * @param registry - WeaverRegistry instance
 * @param streamId - ID of the StreamSignal to execute
 */
export async function executeStream(registry: WeaverRegistry, streamId: string): Promise<void> {
  // Streams are client-only - on server, just set init value
  if (isServer()) {
    const stream = registry.getSignal(streamId);
    if (stream?.kind === "stream") {
      registry.setValue(streamId, stream.init);
    }
    return;
  }

  // Get the stream signal definition
  const stream = registry.getSignal(streamId);
  if (stream?.kind !== "stream") {
    throw new Error(`Signal ${streamId} is not a stream signal`);
  }

  const streamSignal = stream as StreamSignal;

  // Get the source signal's value (should be a ReadableStream)
  const sourceValue = registry.getValue(streamSignal.source);
  if (!(sourceValue instanceof ReadableStream)) {
    throw new Error(`Source signal ${streamSignal.source} value is not a ReadableStream`);
  }

  // Get the reducer logic signal
  const reducerSignal = registry.getSignal(streamSignal.reducer);
  if (reducerSignal?.kind !== "logic") {
    throw new Error(`Reducer signal ${streamSignal.reducer} not found or is not a logic signal`);
  }

  // Load the reducer function

  const reducer = await loadLogic(reducerSignal as LogicSignal);

  // Initialize accumulator with init value
  let accumulator: unknown = streamSignal.init;
  registry.setValue(streamId, accumulator);

  // Read from the stream and apply reducer for each item
  const reader = sourceValue.getReader();

  try {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    while (true) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      // Apply reducer: accumulator = reducer(accumulator, item)
      accumulator = reducer(accumulator, value);

      // Update registry with new value (triggers reactive updates)
      registry.setValue(streamId, accumulator);
    }
  } finally {
    reader.releaseLock();
  }
}
