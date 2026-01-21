import { WeaverRegistry } from "@/registry/WeaverRegistry";
import { executeLogic } from "./executeLogic";
import { createReadOnlySignalInterface } from "./signalInterfaces";

/**
 * Executes a computed signal's logic function and caches the result
 * Computed signals receive read-only access to their dependencies
 *
 * @param registry - WeaverRegistry instance
 * @param computedId - ID of the ComputedSignal to execute
 */
export async function executeComputed(registry: WeaverRegistry, computedId: string): Promise<void> {
  // Get the computed signal definition
  const computed = registry.getSignal(computedId);
  if (computed?.kind !== "computed") {
    throw new Error(`Signal ${computedId} is not a computed signal`);
  }

  // Get the logic signal
  const logicSignal = registry.getSignal(computed.logic);
  if (logicSignal?.kind !== "logic") {
    throw new Error(`Logic signal ${computed.logic} not found`);
  }

  // Wrap dependencies as read-only interfaces
  const depInterfaces = computed.deps.map((depId) => createReadOnlySignalInterface(registry, depId));

  // Execute the logic function (handles async logic automatically)
  const result = await executeLogic(logicSignal, depInterfaces);

  // Cache the result in the registry
  registry.setValue(computedId, result);
}
