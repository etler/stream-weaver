import type { LogicSignal } from "@/signals/types";
import { loadLogic } from "./loadLogic";

/**
 * Executes a logic function with the provided arguments
 * Handles async logic by awaiting when the result is a Promise
 *
 * @param logicSignal - The LogicSignal containing the module to execute
 * @param args - Arguments to pass to the logic function
 * @returns The result of the logic function (awaited if async)
 */
export async function executeLogic(logicSignal: LogicSignal, args: unknown[]): Promise<unknown> {
  // Load the logic function
  const logicFn = await loadLogic(logicSignal);

  // Execute the logic function
  const result = logicFn(...args);

  // Await result only when it's a Promise
  if (result instanceof Promise) {
    return await result;
  }

  return result;
}
