/**
 * Generic logic executor worker script for Browser and Bun
 *
 * This worker receives messages with:
 * - id: Task ID for response matching
 * - src: Module path to import
 * - args: Arguments to pass to the default export function
 *
 * It imports the module, executes the default export with args,
 * and posts the result back.
 */

interface WorkerRequest {
  id: number;
  src: string;
  args: unknown[];
}

interface WorkerResponse {
  id: number;
  result?: unknown;
  error?: string;
}

// Track current task for global error handling
let currentTaskId: number | null = null;

// Global error handler to catch any uncaught errors
// Return true to prevent the error from propagating to the main thread
self.onerror = (event: Event | string): boolean => {
  console.error("[Worker] Global onerror:", event);
  const message = typeof event === "string" ? event : event instanceof ErrorEvent ? event.message : "Unknown error";
  if (currentTaskId !== null) {
    const response: WorkerResponse = { id: currentTaskId, error: message || "Worker error" };
    self.postMessage(response);
    currentTaskId = null;
  }
  return true; // Prevent propagation to main thread
};

// Global unhandled rejection handler
self.onunhandledrejection = (event: PromiseRejectionEvent) => {
  console.error("[Worker] Global onunhandledrejection:", event.reason);
  event.preventDefault(); // Prevent propagation to main thread
  const message = event.reason instanceof Error ? event.reason.message : String(event.reason);
  if (currentTaskId !== null) {
    const response: WorkerResponse = { id: currentTaskId, error: message || "Unhandled rejection" };
    self.postMessage(response);
    currentTaskId = null;
  }
};

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const { id, src, args } = event.data;
  currentTaskId = id;
  console.log("[Worker] Received task:", id, "src:", src);

  try {
    // Dynamically import the logic module
    // Use indirect eval to prevent Vite from transforming this import
    // This is necessary because Vite's __vite__injectQuery isn't available in workers
    console.log("[Worker] Importing module:", src);
    // eslint-disable-next-line no-new-func, @typescript-eslint/no-implied-eval, @typescript-eslint/no-unsafe-type-assertion
    const importFn = new Function("src", "return import(src)") as (
      src: string,
    ) => Promise<{ default: (...args: unknown[]) => unknown }>;
    const mod = await importFn(src);
    console.log("[Worker] Module loaded, executing with args:", args);

    // Execute the default export with provided args
    const result = await mod.default(...args.map((arg) => ({ value: arg })));
    console.log("[Worker] Execution complete, result:", result);

    // Post result back
    const response: WorkerResponse = { id, result };
    self.postMessage(response);
  } catch (error) {
    // Post error back
    console.error("[Worker] Error:", error);
    const response: WorkerResponse = {
      id,
      error: error instanceof Error ? error.message : String(error),
    };
    self.postMessage(response);
  } finally {
    currentTaskId = null;
  }
};
