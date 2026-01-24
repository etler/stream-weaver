/**
 * Generic logic executor worker script for Node.js
 *
 * This worker receives messages with:
 * - id: Task ID for response matching
 * - src: Module path to import
 * - args: Arguments to pass to the default export function
 *
 * It imports the module, executes the default export with args,
 * and posts the result back via parentPort.
 */

import { parentPort } from "worker_threads";

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

if (!parentPort) {
  throw new Error("This script must be run as a worker thread");
}

// Store port reference after null check
const port = parentPort;

async function handleMessage(data: WorkerRequest): Promise<void> {
  const { id, src, args } = data;

  try {
    // Dynamically import the logic module
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
    const mod = (await import(src)) as { default: (...args: unknown[]) => unknown };

    // Execute the default export with provided args
    const result = await mod.default(...args);

    // Post result back
    const response: WorkerResponse = { id, result };
    port.postMessage(response);
  } catch (error) {
    // Post error back
    const response: WorkerResponse = {
      id,
      error: error instanceof Error ? error.message : String(error),
    };
    port.postMessage(response);
  }
}

port.on("message", (data: WorkerRequest) => {
  void handleMessage(data);
});
