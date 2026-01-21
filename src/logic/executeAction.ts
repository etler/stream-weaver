import { WeaverRegistry } from "@/registry/WeaverRegistry";
import { executeLogic } from "./executeLogic";
import { createWritableSignalInterface } from "./signalInterfaces";

/**
 * Executes an action signal's logic function
 * Actions receive writable access to their dependencies
 *
 * Handles deferred execution (M12):
 * - If logic has timeout, may return immediately while execution continues
 * - Deferred execution completes in background
 *
 * @param registry - WeaverRegistry instance
 * @param actionId - ID of the ActionSignal to execute
 */
export async function executeAction(registry: WeaverRegistry, actionId: string): Promise<void> {
  // Get the action signal definition
  const action = registry.getSignal(actionId);
  if (action?.kind !== "action") {
    throw new Error(`Signal ${actionId} is not an action signal`);
  }

  // Get the logic signal
  const logicSignal = registry.getSignal(action.logic);
  if (logicSignal?.kind !== "logic") {
    throw new Error(`Logic signal ${action.logic} not found`);
  }

  // Wrap dependencies as writable interfaces
  const depInterfaces = action.deps.map((depId) => createWritableSignalInterface(registry, depId));

  // Execute the logic function (handles async, timeout, and context)
  const result = await executeLogic(logicSignal, depInterfaces);

  // If execution was deferred, wait for completion
  if (result.deferred) {
    await result.deferred;
  }
}
