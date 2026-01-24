/**
 * Type utilities for type-safe logic signals
 *
 * These types enable compile-time validation of logic function parameters
 * against signal dependencies, providing full type safety when using
 * defineLogic(import("./path")) syntax.
 */

import type { WritableSignalInterface } from "@/logic/signalInterfaces";
import type { StateSignal, ComputedSignal, MutatorSignal, AnySignal } from "./types";

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
  [K in keyof T]: T[K] extends AnySignal ? SignalValueType<T[K]> : never;
};

/**
 * Maps a tuple of signals to writable interfaces
 * @deprecated Use SignalsToActionInterfaces for new code
 */
export type SignalsToWritableInterfaces<T extends readonly AnySignal[]> = {
  [K in keyof T]: T[K] extends AnySignal ? WritableSignalInterface<SignalValueType<T[K]>> : never;
};

/**
 * Gets the interface type for a signal in action/handler context
 * - MutatorSignal<T> → WritableSignalInterface<T> (mutable access)
 * - Other signals → raw value T (read-only, unwrapped)
 */
export type ActionSignalInterface<S extends AnySignal> =
  S extends MutatorSignal<infer T>
    ? WritableSignalInterface<T>
    : S extends StateSignal<infer T>
      ? T
      : S extends ComputedSignal<infer T>
        ? T
        : unknown;

/**
 * Maps a tuple of signals to their action/handler interfaces
 * - MutatorSignal → WritableSignalInterface (for mutation)
 * - Other signals → raw value (read-only)
 *
 * @example
 * type Interfaces = SignalsToActionInterfaces<[MutatorSignal<number>, StateSignal<string>]>;
 * // = [WritableSignalInterface<number>, string]
 */
export type SignalsToActionInterfaces<T extends readonly AnySignal[]> = {
  [K in keyof T]: T[K] extends AnySignal ? ActionSignalInterface<T[K]> : never;
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

/**
 * Removes readonly modifier from a tuple/array type
 * This is necessary because mapped types preserve readonly, but function parameters are mutable
 *
 * @example
 * type T = Mutable<readonly [number, string]>;
 * // = [number, string]
 */
export type Mutable<T> = { -readonly [K in keyof T]: T[K] };

/**
 * Checks if F is a specific typed function or the generic LogicFunction
 * Used to determine if dependency validation should be applied
 *
 * We detect if F has typed parameters by checking if its parameter types
 * are more specific than `any[]`. Since `any` is bi-directionally assignable,
 * we use a tuple check: typed functions have tuple parameters, untyped have `any[]`.
 */
export type IsTypedLogic<F extends LogicFunction> =
  // Check if Parameters<F> is a tuple (has specific length) vs any[]
  // any[] has length `number`, tuples have specific numeric literal lengths
  number extends Parameters<F>["length"] ? false : true;

/**
 * Validates handler dependencies against function parameters
 * Returns Deps if valid, or a descriptive error type if invalid
 *
 * For untyped logic (LogicFunction), always returns Deps (no validation)
 * For typed logic, validates that signal types match function parameters
 *
 * Handler receives: (event: Event, ...deps) where deps are:
 * - MutatorSignal<T> → WritableSignalInterface<T>
 * - Other signals → raw value T
 */
export type ValidateHandlerDeps<F extends LogicFunction, Deps extends readonly AnySignal[]> =
  IsTypedLogic<F> extends true
    ? Mutable<SignalsToActionInterfaces<Deps>> extends DropFirst<Parameters<F>>
      ? Deps
      : "Error: Signal types don't match handler function parameters"
    : Deps;

/**
 * Validates computed dependencies against function parameters
 */
export type ValidateComputedDeps<F extends LogicFunction, Deps extends readonly AnySignal[]> =
  IsTypedLogic<F> extends true
    ? Mutable<SignalsToReadOnlyInterfaces<Deps>> extends Parameters<F>
      ? Deps
      : "Error: Signal types don't match computed function parameters"
    : Deps;

/**
 * Validates action dependencies against function parameters
 *
 * Action receives deps where:
 * - MutatorSignal<T> → WritableSignalInterface<T>
 * - Other signals → raw value T
 */
export type ValidateActionDeps<F extends LogicFunction, Deps extends readonly AnySignal[]> =
  IsTypedLogic<F> extends true
    ? Mutable<SignalsToActionInterfaces<Deps>> extends Parameters<F>
      ? Deps
      : "Error: Signal types don't match action function parameters"
    : Deps;
