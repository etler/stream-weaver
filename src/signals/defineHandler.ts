import { HandlerSignal, LogicSignal, AnySignal } from "./types";
import { LogicFunction, ValidateHandlerDeps, First } from "./logicTypes";
import { allocateDerivedId } from "./idAllocation";

/**
 * Creates a handler signal definition with full type safety
 *
 * Handlers are specialized actions for event handling.
 * They receive the event object as the first parameter, followed by
 * writable access to their dependencies via WritableSignalInterface<T>.
 *
 * When using a typed LogicSignal (from import()), the function validates:
 * - Dependencies match the expected function parameter types (after the event param)
 * - Event type is captured in the return type
 *
 * The ID is content-addressable: same logic + deps = same ID (idempotent)
 *
 * @example
 * // With typed logic (full type checking)
 * const count = defineSignal(5);  // StateSignal<number>
 * const clickLogic = defineLogic(import("./handleClick"));
 * // handleClick = (e: MouseEvent, count: WritableSignalInterface<number>) => void
 * const onClick = defineHandler(clickLogic, [count]);  // HandlerSignal<MouseEvent>
 *
 * @example
 * // With untyped logic (backwards compatible)
 * const legacyLogic = defineLogic("./legacy.js");
 * const handler = defineHandler(legacyLogic, [count]);  // HandlerSignal<Event>
 */

// Extract event type from handler function, defaulting to Event
type ExtractEventType<F extends LogicFunction> = First<Parameters<F>> extends Event ? First<Parameters<F>> : Event;

// Single signature with validation - no fallback overload
// Use [...Deps] to encourage tuple inference instead of array inference
export function defineHandler<F extends LogicFunction, const Deps extends readonly AnySignal[]>(
  logic: LogicSignal<F>,
  deps: ValidateHandlerDeps<F, Deps>,
): HandlerSignal<ExtractEventType<F>>;

// Implementation
export function defineHandler(logic: LogicSignal, deps: AnySignal[]): HandlerSignal {
  const depIds = deps.map((dep) => dep.id);
  const id = allocateDerivedId(logic.id, depIds);

  return {
    id,
    kind: "handler",
    logic: logic.id,
    deps: depIds,
    logicRef: logic,
    depsRef: deps,
  };
}
