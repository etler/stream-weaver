/**
 * Type utilities for type-safe logic signals
 *
 * These types enable compile-time validation of logic function parameters
 * against signal dependencies, providing full type safety when using
 * createLogic(import("./path")) syntax.
 */

import type { SignalInterface, WritableSignalInterface } from "@/logic/signalInterfaces";
import type { StateSignal, ComputedSignal, AnySignal } from "./types";

// ========== Module Type Extraction ==========

/**
 * Extracts the function type from an import() expression's type
 *
 * @example
 * type Fn = ExtractLogicFunction<typeof import("./double")>;
 * // Fn = (count: SignalInterface<number>) => number
 */
export type ExtractLogicFunction<T> = T extends Promise<{ default: infer F }> ? F : never;

/**
 * Base type constraint for all logic functions
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type LogicFunction = (...args: any[]) => any;

// ========== Signal Value Extraction ==========

/**
 * Gets the value type stored in a signal
 */
export type SignalValueType<S extends AnySignal> =
  S extends StateSignal<infer T> ? T : S extends ComputedSignal<infer T> ? T : unknown;

// ========== Signal to Interface Mapping ==========

/**
 * Maps a tuple of signals to read-only interfaces
 * Used for computed signal dependency validation
 *
 * @example
 * type Interfaces = SignalsToReadOnlyInterfaces<[StateSignal<number>, StateSignal<string>]>;
 * // = [SignalInterface<number>, SignalInterface<string>]
 */
export type SignalsToReadOnlyInterfaces<T extends readonly AnySignal[]> = {
  [K in keyof T]: T[K] extends AnySignal ? SignalInterface<SignalValueType<T[K]>> : never;
};

/**
 * Maps a tuple of signals to writable interfaces
 * Used for action/handler dependency validation
 *
 * @example
 * type Interfaces = SignalsToWritableInterfaces<[StateSignal<number>]>;
 * // = [WritableSignalInterface<number>]
 */
export type SignalsToWritableInterfaces<T extends readonly AnySignal[]> = {
  [K in keyof T]: T[K] extends AnySignal ? WritableSignalInterface<SignalValueType<T[K]>> : never;
};

// ========== Tuple Utilities ==========

/**
 * Drops the first element from a tuple type
 * Used to extract deps from handler function signature (after event param)
 *
 * @example
 * type Rest = DropFirst<[Event, SignalInterface<number>]>;
 * // = [SignalInterface<number>]
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type DropFirst<T extends readonly any[]> = T extends [unknown, ...infer Rest] ? Rest : never;

/**
 * Gets the first element type from a tuple
 * Used to extract event type from handler function signature
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type First<T extends readonly any[]> = T extends [infer F, ...unknown[]] ? F : never;
