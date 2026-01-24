import { WorkerPool } from "@/worker";
import { isClient } from "@/utils/environment";
import type { LogicSignal } from "@/signals/types";

/**
 * Executes logic in a worker thread
 *
 * @param logicSignal - The logic signal to execute
 * @param args - Arguments to pass to the logic function (already resolved values)
 * @returns Promise resolving to the logic result
 */
export async function executeInWorker(logicSignal: LogicSignal, args: unknown[]): Promise<unknown> {
  // Workers always use absolute paths (src) because:
  // - Worker threads don't have the same module resolution context
  // - Relative paths (ssrSrc) won't resolve correctly from worker context
  const { src } = logicSignal;

  if (src === "") {
    throw new Error(`Logic signal ${logicSignal.id} has no src path for worker execution`);
  }

  let finalPath = src;

  // For browser, add /@fs/ prefix for absolute paths (Vite dev server)
  // Exclude /assets/ paths (production build) and /@ paths (already prefixed)
  if (isClient() && finalPath.startsWith("/") && !finalPath.startsWith("/@") && !finalPath.startsWith("/assets/")) {
    finalPath = `/@fs${finalPath}`;
  }

  // Execute in worker pool
  return WorkerPool.execute(finalPath, args);
}
