import { WeaverRegistry } from "@/registry/WeaverRegistry";
import type { ComputedSignal, LogicSignal } from "@/signals/types";
import { isClient } from "@/utils/environment";
import { PENDING } from "@/signals/pending";
import { executeLogic } from "./executeLogic";
import { createReadOnlySignalInterface } from "./signalInterfaces";
import { executeRemote } from "./remoteExecution";
import { executeInWorker } from "./workerExecution";

/**
 * Result from executeComputed indicating if execution was deferred
 */
export interface ExecuteComputedResult {
  /** The immediate value (may be PENDING for deferred execution) */
  value: unknown;
  /** If execution was deferred, this promise resolves when the actual value is ready */
  deferred?: Promise<unknown>;
}

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
 * Handles worker-context logic (M16):
 * - If logic has context: 'worker', executes in worker thread
 * - On server: Uses Node.js worker_threads
 * - On client: Uses Web Workers API
 *
 * @param registry - WeaverRegistry instance
 * @param computedId - ID of the ComputedSignal to execute
 * @returns Result with immediate value and optional deferred promise
 */
export async function executeComputed(registry: WeaverRegistry, computedId: string): Promise<ExecuteComputedResult> {
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
    return { value: result };
  }

  // Check for worker-context logic (M16)
  if (logicSignal.context === "worker") {
    return executeWorkerLogic(registry, computedId, computed as ComputedSignal, logicSignal);
  }

  // Wrap dependencies as read-only interfaces
  const depInterfaces = computed.deps.map((depId) => createReadOnlySignalInterface(registry, depId));

  // Get init value from computed signal (used as fallback when deferring)

  const initValue = (computed as ComputedSignal).init;

  // Execute the logic function (handles async, timeout, and context)
  const result = await executeLogic(logicSignal, depInterfaces, initValue);

  // Cache the immediate result in the registry (may be PENDING)
  registry.setValue(computedId, result.value);

  // If execution was deferred, return the deferred promise for the caller to handle
  if (result.deferred) {
    return {
      value: result.value,
      deferred: result.deferred.then((deferredValue) => {
        registry.setValue(computedId, deferredValue);
        return deferredValue;
      }),
    };
  }

  return { value: result.value };
}

/**
 * Execute worker-context logic
 * Handles timeout/deferred execution for worker logic
 *
 * Worker logic executes on both server (Node.js worker_threads) and client (Web Workers).
 * - No timeout: Blocking execution, waits for result
 * - timeout: 0: Deferred execution, returns PENDING immediately
 * - timeout > 0: Races execution against timer
 */
async function executeWorkerLogic(
  registry: WeaverRegistry,
  computedId: string,
  computed: ComputedSignal,
  logicSignal: LogicSignal,
): Promise<ExecuteComputedResult> {
  const initValue = computed.init;
  const pendingValue = initValue !== undefined ? initValue : PENDING;

  // Get dependency values (resolved values, not interfaces)
  const depValues = computed.deps.map((depId) => registry.getValue(depId));

  const { timeout } = logicSignal;

  // timeout === 0: always defer immediately
  if (timeout === 0) {
    registry.setValue(computedId, pendingValue);
    // Return deferred promise that resolves when worker completes
    const deferred = executeInWorker(logicSignal, depValues).then((result) => {
      registry.setValue(computedId, result);
      return result;
    });
    return { value: pendingValue, deferred };
  }

  // timeout > 0: race execution against timer
  if (timeout !== undefined && timeout > 0) {
    const executionPromise = executeInWorker(logicSignal, depValues);

    const timeoutPromise = new Promise<typeof PENDING>((resolve) => {
      setTimeout(() => {
        resolve(PENDING);
      }, timeout);
    });

    const raceResult = await Promise.race([executionPromise, timeoutPromise]);

    if (raceResult === PENDING) {
      // Timer won - set pending value, return deferred promise
      registry.setValue(computedId, pendingValue);
      const deferred = executionPromise.then((result) => {
        registry.setValue(computedId, result);
        return result;
      });
      return { value: pendingValue, deferred };
    }

    // Execution completed within timeout
    registry.setValue(computedId, raceResult);
    return { value: raceResult };
  }

  // No timeout: execute inline (blocking)
  const result = await executeInWorker(logicSignal, depValues);
  registry.setValue(computedId, result);
  return { value: result };
}
