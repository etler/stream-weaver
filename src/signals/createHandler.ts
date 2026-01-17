import { HandlerSignal, LogicSignal, AnySignal } from "./types";
import { allocateDerivedId } from "./idAllocation";

/**
 * Creates a handler signal definition
 * Handlers are specialized actions for event handling
 * They receive writable access to their dependencies and the event object
 *
 * The ID is content-addressable: same logic + deps = same ID (idempotent)
 *
 * @param logic - LogicSignal reference
 * @param deps - Array of signal dependencies
 * @returns HandlerSignal definition object
 */
export function createHandler(logic: LogicSignal, deps: AnySignal[]): HandlerSignal {
  const depIds = deps.map((dep) => dep.id);
  const id = allocateDerivedId(logic.id, depIds);

  return {
    id,
    kind: "handler",
    logic: logic.id,
    deps: depIds,
    logicRef: logic, // Store reference for SSR tokenization
  } as HandlerSignal;
}
