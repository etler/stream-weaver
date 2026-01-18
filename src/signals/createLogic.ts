import { LogicSignal } from "./types";
import { LogicFunction } from "./logicTypes";
import { allocateSourceId } from "./idAllocation";

/**
 * Input types that createLogic accepts at compile time:
 * 1. Promise<Module> - from import("./path"), transformed to object at build time
 * 2. LogicSignal object - the pre-transformed object from the plugin
 * 3. string - backwards compatible path string
 */

/**
 * Creates a new logic signal definition with full type inference
 *
 * When used with import(), the logic function's type is captured:
 * @example
 * // Type-safe (with build plugin)
 * const doubleLogic = createLogic(import("./double"));
 * // doubleLogic is LogicSignal<(count: SignalInterface<number>) => number>
 *
 * @example
 * // Backwards compatible (no type info)
 * const legacyLogic = createLogic("./double.js");
 * // legacyLogic is LogicSignal<LogicFunction>
 */

// Overload 1: Type-safe import() syntax - extracts type from module promise
export function createLogic<M extends { default: LogicFunction }>(mod: Promise<M>): LogicSignal<M["default"]>;

// Overload 2: Pre-transformed LogicSignal object from plugin
export function createLogic<F extends LogicFunction>(input: LogicSignal<F>): LogicSignal<F>;

// Overload 3: Legacy string path (no type info)
export function createLogic(src: string): LogicSignal;

// Implementation
export function createLogic(input: unknown): LogicSignal {
  // Handle string input (legacy usage)
  if (typeof input === "string") {
    return {
      id: allocateSourceId(),
      kind: "logic",
      src: input,
    };
  }

  // At runtime, plugin has transformed import() to a LogicSignal object
  // Check if it's already a complete LogicSignal
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
  const maybeLogic = input as Record<string, unknown>;
  if (maybeLogic["kind"] === "logic" && typeof maybeLogic["id"] === "string" && typeof maybeLogic["src"] === "string") {
    // Already a complete LogicSignal from plugin transform - return as-is
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
    return maybeLogic as unknown as LogicSignal;
  }

  // Fallback: If somehow we got here without proper input, throw
  // This shouldn't happen with correct plugin setup
  throw new Error(
    "createLogic received unexpected input. " +
      "When using import(), ensure the stream-weaver plugin is configured. " +
      "For legacy usage, pass a string path.",
  );
}
