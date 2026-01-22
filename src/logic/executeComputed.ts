import { WeaverRegistry } from "@/registry/WeaverRegistry";
import type { ComputedSignal } from "@/signals/types";
import { isClient } from "@/utils/environment";
import { executeLogic } from "./executeLogic";
import { createReadOnlySignalInterface } from "./signalInterfaces";
import { executeRemote } from "./remoteExecution";

/**
 * Executes a computed signal's logic function and caches the result
 * Computed signals receive read-only access to their dependencies
 *
 * Handles deferred execution (M12):
 * - If logic has timeout, may return PENDING immediately
 * - Deferred execution continues in background and updates registry when done
 *
 * Handles server-context logic (M13):
 * - If logic has context: 'server' and running on client, calls executeRemote
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

  // Check for server-context logic on client - use remote execution (M13)
  if (logicSignal.context === "server" && isClient()) {
    const result = await executeRemote(registry, computedId);
    registry.setValue(computedId, result);
    return;
  }

  // Wrap dependencies as read-only interfaces
  const depInterfaces = computed.deps.map((depId) => createReadOnlySignalInterface(registry, depId));

  // Get init value from computed signal (used as fallback when deferring)

  const initValue = (computed as ComputedSignal).init;

  // Execute the logic function (handles async, timeout, and context)
  const result = await executeLogic(logicSignal, depInterfaces, initValue);

  // Cache the immediate result in the registry (may be PENDING)
  registry.setValue(computedId, result.value);

  // If execution was deferred, wait for completion and update registry
  if (result.deferred) {
    const deferredValue = await result.deferred;
    registry.setValue(computedId, deferredValue);
  }
}
