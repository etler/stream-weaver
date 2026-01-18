import { WeaverRegistry } from "@/registry/WeaverRegistry";
import { loadLogic } from "./loadLogic";
import { createWritableSignalInterface } from "./signalInterfaces";

/**
 * Executes a handler signal's logic function with an event
 * Handlers receive the event object plus writable access to their dependencies
 *
 * @param registry - WeaverRegistry instance
 * @param handlerId - ID of the HandlerSignal to execute
 * @param event - The event object to pass to the handler
 */
export async function executeHandler(registry: WeaverRegistry, handlerId: string, event: Event): Promise<void> {
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

  // Load the logic function
  const logicFn = await loadLogic(logicSignal);

  // Wrap dependencies as writable interfaces
  const depInterfaces = handler.deps.map((depId) => createWritableSignalInterface(registry, depId));

  // Execute the logic function with event as first parameter
  logicFn(event, ...depInterfaces);
}
