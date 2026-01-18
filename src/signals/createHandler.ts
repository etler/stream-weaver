import { HandlerSignal, LogicSignal, AnySignal } from "./types";
import { SignalsToWritableInterfaces, DropFirst } from "./logicTypes";
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
 * const count = createSignal(5);  // StateSignal<number>
 * const clickLogic = createLogic(import("./handleClick"));
 * // handleClick = (e: MouseEvent, count: WritableSignalInterface<number>) => void
 * const onClick = createHandler(clickLogic, [count]);  // HandlerSignal<MouseEvent>
 *
 * @example
 * // With untyped logic (backwards compatible)
 * const legacyLogic = createLogic("./legacy.js");
 * const handler = createHandler(legacyLogic, [count]);  // HandlerSignal<Event>
 */

// Overload 1: Typed logic with event type and dependency validation
export function createHandler<
  TEvent extends Event,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  F extends (event: TEvent, ...args: any[]) => void,
  Deps extends readonly AnySignal[],
>(
  logic: LogicSignal<F>,
  deps: Deps & (SignalsToWritableInterfaces<Deps> extends DropFirst<Parameters<F>> ? Deps : never),
): HandlerSignal<TEvent>;

// Overload 2: Untyped logic (backwards compatible)
export function createHandler(logic: LogicSignal, deps: AnySignal[]): HandlerSignal;

// Implementation
export function createHandler(logic: LogicSignal, deps: AnySignal[]): HandlerSignal {
  const depIds = deps.map((dep) => dep.id);
  const id = allocateDerivedId(logic.id, depIds);

  return {
    id,
    kind: "handler",
    logic: logic.id,
    deps: depIds,
    logicRef: logic,
  };
}
