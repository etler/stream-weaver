import { StreamSignal, LogicSignal, AnySignal } from "./types";
import { allocateDerivedId } from "./idAllocation";

/**
 * Creates a stream signal that reduces items from a ReadableStream into a reactive value
 *
 * Stream signals provide a convenient way to reduce ECMA Web Streams (ReadableStream)
 * into reactive signal values. As items arrive from the stream, the reducer function
 * is applied and the signal value is updated.
 *
 * The ID is content-addressable: same source + same reducer = same ID (idempotent)
 *
 * @param sourceSignal - Signal whose value is a ReadableStream<T>
 * @param reducerLogic - LogicSignal for reducer function: (accumulator, item) => accumulator
 * @param init - Initial accumulator value
 * @returns StreamSignal that updates as stream items arrive
 *
 * @example
 * // Create a stream that accumulates messages
 * const wsLogic = createClientLogic(import("./websocket"));
 * const wsStream = createComputed(wsLogic, [channel]); // Value is ReadableStream
 *
 * const appendLogic = createLogic(import("./reducers/append"));
 * const messages = createStream(wsStream, appendLogic, []);
 * // messages.value is Message[], updates as items arrive
 *
 * @example
 * // Create a stream that keeps only the latest value
 * const latestLogic = createLogic(import("./reducers/latest"));
 * const currentValue = createStream(dataStream, latestLogic, null);
 * // currentValue.value is the most recent item
 */
export function createStream<T>(sourceSignal: AnySignal, reducerLogic: LogicSignal, init: T): StreamSignal<T> {
  const id = allocateDerivedId(reducerLogic.id, [sourceSignal.id]);

  return {
    id,
    kind: "stream",
    source: sourceSignal.id,
    reducer: reducerLogic.id,
    init,
    sourceRef: sourceSignal,
    reducerRef: reducerLogic,
  };
}
