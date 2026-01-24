import { ReducerSignal, LogicSignal, AnySignal } from "./types";
import { allocateDerivedId } from "./idAllocation";

/**
 * Creates a reducer signal that reduces items from an iterable into a reactive value
 *
 * Reducer signals provide a convenient way to reduce any iterable (sync or async)
 * into reactive signal values. As items arrive from the iterable, the reducer function
 * is applied and the signal value is updated.
 *
 * Works with:
 * - ReadableStream<T> (async iterable)
 * - Array<T> (sync iterable)
 * - Generator<T> (sync iterable)
 * - AsyncGenerator<T> (async iterable)
 * - Any Iterable<T> or AsyncIterable<T>
 *
 * The ID is content-addressable: same source + same reducer = same ID (idempotent)
 *
 * @param sourceSignal - Signal whose value is an iterable
 * @param reducerLogic - LogicSignal for reducer function: (accumulator, item) => accumulator
 * @param init - Initial accumulator value
 * @returns ReducerSignal that updates as items arrive
 *
 * @example
 * // Reduce a ReadableStream
 * const wsLogic = defineClientLogic(import("./websocket"));
 * const wsStream = defineComputed(wsLogic, [channel]); // Value is ReadableStream
 *
 * const appendLogic = defineLogic(import("./reducers/append"));
 * const messages = defineReducer(wsStream, appendLogic, []);
 * // messages.value is Message[], updates as items arrive
 *
 * @example
 * // Reduce an async generator
 * const dataLogic = defineLogic(import("./dataGenerator"));
 * const dataGen = defineComputed(dataLogic, []); // Value is AsyncGenerator
 *
 * const latestLogic = defineLogic(import("./reducers/latest"));
 * const currentValue = defineReducer(dataGen, latestLogic, null);
 * // currentValue.value is the most recent item
 */
export function defineReducer<T>(sourceSignal: AnySignal, reducerLogic: LogicSignal, init: T): ReducerSignal<T> {
  const id = allocateDerivedId(reducerLogic.id, [sourceSignal.id]);

  return {
    id,
    kind: "reducer",
    source: sourceSignal.id,
    reducer: reducerLogic.id,
    init,
    sourceRef: sourceSignal,
    reducerRef: reducerLogic,
  };
}
