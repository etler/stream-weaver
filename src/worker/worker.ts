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

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const { id, src, args } = event.data;

  try {
    // Dynamically import the logic module
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
    const mod = (await import(/* @vite-ignore */ src)) as { default: (...args: unknown[]) => unknown };

    // Execute the default export with provided args
    const result = await mod.default(...args);

    // Post result back
    const response: WorkerResponse = { id, result };
    self.postMessage(response);
  } catch (error) {
    // Post error back
    const response: WorkerResponse = {
      id,
      error: error instanceof Error ? error.message : String(error),
    };
    self.postMessage(response);
  }
};
