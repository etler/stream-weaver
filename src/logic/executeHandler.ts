import { WeaverRegistry } from "@/registry/WeaverRegistry";
import { executeLogic } from "./executeLogic";
import { createWritableSignalInterface } from "./signalInterfaces";

/**
 * Result of executeHandler
 */
export interface ExecuteHandlerResult {
  /** Promise that resolves when deferred execution completes (if any) */
  deferred?: Promise<unknown>;
}

/**
 * Executes a handler signal's logic function with an event
 * Handlers receive the event object plus writable access to their dependencies
 *
 * Handles deferred execution (M12):
 * - If logic has timeout, may return immediately while execution continues
 * - Returns deferred promise so caller can trigger updates when it completes
 *
 * @param registry - WeaverRegistry instance
 * @param handlerId - ID of the HandlerSignal to execute
 * @param event - The event object to pass to the handler
 * @returns Result with optional deferred promise
 */
export async function executeHandler(
  registry: WeaverRegistry,
  handlerId: string,
  event: Event,
): Promise<ExecuteHandlerResult> {
  // Get the handler signal definition
  const handler = registry.getSignal(handlerId);
  if (handler?.kind !== "handler") {
    throw new Error(`Signal ${handlerId} is not a handler signal`);
  }

  // Get the logic signal
  const logicSignal = registry.getSignal(handler.logic);
  if (logicSignal?.kind !== "logic") {
    throw new Error(`Logic signal ${handler.logic} not found`);
  }

  // Wrap dependencies as writable interfaces
  const depInterfaces = handler.deps.map((depId) => createWritableSignalInterface(registry, depId));

  // Execute the logic function with event as first parameter (handles async, timeout, and context)
  const result = await executeLogic(logicSignal, [event, ...depInterfaces]);

  // Return the deferred promise so caller can handle updates when it completes
  return { deferred: result.deferred };
}
