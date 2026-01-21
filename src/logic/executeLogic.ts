import type { LogicSignal } from "@/signals/types";
import { PENDING } from "@/signals/pending";
import { isServer } from "@/utils/environment";
import { loadLogic } from "./loadLogic";

/**
 * Result of executeLogic
 */
export interface ExecuteLogicResult {
  /** Immediate value (could be PENDING if deferred) */
  value: unknown;
  /** Promise that resolves with actual value if execution was deferred */
  deferred?: Promise<unknown>;
}

/**
 * Helper to execute logic after module is loaded
 */
async function executeLoadedLogic(logicSignal: LogicSignal, args: unknown[]): Promise<unknown> {
  const logicFn = await loadLogic(logicSignal);
  const result = logicFn(...args);

  if (result instanceof Promise) {
    return await result;
  }
  return result;
}

/**
 * Executes a logic function with the provided arguments
 * Handles:
 * - Async logic by awaiting when the result is a Promise
 * - Context restrictions (client-only logic returns PENDING on server)
 * - Timeout-based deferral (returns PENDING immediately, continues in background)
 *
 * @param logicSignal - The LogicSignal containing the module to execute
 * @param args - Arguments to pass to the logic function
 * @param initValue - Optional init value to use instead of PENDING when deferring
 * @returns ExecuteLogicResult with immediate value and optional deferred promise
 */
export async function executeLogic(
  logicSignal: LogicSignal,
  args: unknown[],
  initValue?: unknown,
): Promise<ExecuteLogicResult> {
  const pendingValue = initValue !== undefined ? initValue : PENDING;

  // Check context restrictions
  if (logicSignal.context === "client" && isServer()) {
    // Client-only logic on server: return PENDING (or init value)
    return { value: pendingValue };
  }

  const { timeout } = logicSignal;

  // timeout === 0: always defer immediately (don't even wait for module load)
  if (timeout === 0) {
    // Start execution in background, return PENDING immediately
    const deferredPromise = executeLoadedLogic(logicSignal, args);
    return {
      value: pendingValue,
      deferred: deferredPromise,
    };
  }

  // timeout > 0: race execution against timer
  if (timeout !== undefined && timeout > 0) {
    const executionPromise = executeLoadedLogic(logicSignal, args);

    const timeoutPromise = new Promise<typeof PENDING>((resolve) => {
      setTimeout(() => {
        resolve(PENDING);
      }, timeout);
    });

    const raceResult = await Promise.race([executionPromise, timeoutPromise]);

    if (raceResult === PENDING) {
      // Timer won - defer the execution
      return {
        value: pendingValue,
        deferred: executionPromise,
      };
    }

    // Execution completed within timeout - return inline
    return { value: raceResult };
  }

  // No timeout (undefined): execute inline (blocking)
  const logicFn = await loadLogic(logicSignal);
  const result = logicFn(...args);

  if (result instanceof Promise) {
    return { value: await result };
  }

  return { value: result };
}
