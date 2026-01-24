import { WeaverRegistry, getLogicSignal, getActionSignal } from "@/registry";
import { executeLogic } from "./executeLogic";
import { createActionDependencyInterface } from "./signalInterfaces";

/**
 * Executes an action signal's logic function
 * Actions receive unwrapped values from dependencies, except MutatorSignal
 * which provides a writable interface for mutation.
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
  const action = getActionSignal(registry, actionId);

  // Get the logic signal
  const logicSignal = getLogicSignal(registry, action.logic);

  // Create dependency interfaces:
  // - MutatorSignal -> WritableSignalInterface
  // - Other signals -> raw value
  const depInterfaces = action.deps.map((depId) => createActionDependencyInterface(registry, depId));

  // Execute the logic function (handles async, timeout, and context)
  const result = await executeLogic(logicSignal, depInterfaces);

  // If execution was deferred, wait for completion
  if (result.deferred) {
    await result.deferred;
  }
}
