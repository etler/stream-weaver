import { isNodeOnly } from "@/utils/environment";

/**
 * Message sent to worker
 */
interface WorkerRequest {
  id: number;
  src: string;
  args: unknown[];
}

/**
 * Message received from worker
 */
interface WorkerResponse {
  id: number;
  result?: unknown;
  error?: string;
}

/**
 * Pending task waiting for a worker
 */
interface PendingTask {
  id: number;
  src: string;
  args: unknown[];
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
}

/**
 * Worker wrapper that tracks availability and current task
 */
interface PooledWorker {
  worker: Worker;
  busy: boolean;
  currentTask?: PendingTask;
}

/**
 * Singleton WorkerPool for executing logic in worker threads
 *
 * Handles runtime differences between:
 * - Browser/Bun: Web Workers API
 * - Node.js: worker_threads module
 *
 * Workers are reused to avoid creation overhead.
 * Pool size is limited to available CPU cores.
 */
class WorkerPoolImpl {
  private workers: PooledWorker[] = [];
  private pending: PendingTask[] = [];
  private taskIdCounter = 0;
  private maxWorkers: number;
  private workerUrl: string | null = null;
  private nodeWorkerPath: string | null = null;
  private nodeWorkerModule: typeof import("worker_threads") | null = null;

  constructor(maxWorkers?: number) {
    // Default to CPU core count, with fallback of 4
    this.maxWorkers = maxWorkers ?? (typeof navigator !== "undefined" ? navigator.hardwareConcurrency || 4 : 4);
  }

  /**
   * Get current number of workers in pool
   */
  get workerCount(): number {
    return this.workers.length;
  }

  /**
   * Set the worker script URL for browser/Bun
   */
  setWorkerUrl(url: string): void {
    this.workerUrl = url;
  }

  /**
   * Set the worker script path for Node.js
   */
  setNodeWorkerPath(path: string): void {
    this.nodeWorkerPath = path;
  }

  /**
   * Execute logic in a worker thread
   *
   * @param src - Module path to import in worker
   * @param args - Arguments to pass to the logic function
   * @returns Promise resolving to the logic result
   */
  async execute(src: string, args: unknown[]): Promise<unknown> {
    const taskId = ++this.taskIdCounter;

    return new Promise((resolve, reject) => {
      const task: PendingTask = { id: taskId, src, args, resolve, reject };

      // Try to find an available worker
      const availableWorker = this.workers.find((pw) => !pw.busy);

      if (availableWorker) {
        this.runTask(availableWorker, task);
      } else if (this.workers.length < this.maxWorkers) {
        // Create a new worker asynchronously
        this.createWorker()
          .then((pooledWorker) => {
            this.workers.push(pooledWorker);
            this.runTask(pooledWorker, task);
          })
          .catch(reject);
      } else {
        // Queue the task
        this.pending.push(task);
      }
    });
  }

  /**
   * Get the Node.js worker_threads module (lazy loaded)
   */
  private async getNodeWorkerModule(): Promise<typeof import("worker_threads")> {
    this.nodeWorkerModule ??= await import("worker_threads");
    return this.nodeWorkerModule;
  }

  /**
   * Create a new worker for the current runtime
   */
  private async createWorker(): Promise<PooledWorker> {
    let worker: Worker;

    if (isNodeOnly()) {
      // Node.js: use worker_threads (dynamic import for ESM compatibility)
      const { Worker: NodeWorker } = await this.getNodeWorkerModule();

      // Determine worker path - prefer .ts in development (tsx), .js in production
      let workerPath = this.nodeWorkerPath;
      if (workerPath === null) {
        // Check if we're running in tsx/ts-node development mode
        const isTsRuntime = process.execArgv.some((arg) => arg.includes("tsx") || arg.includes("ts-node"));
        const ext = isTsRuntime ? ".ts" : ".js";
        workerPath = new URL(`./nodeWorker${ext}`, import.meta.url).pathname;
      }

      // For tsx, we need to use the tsx loader in execArgv
      const isTsFile = workerPath.endsWith(".ts");
      const workerOptions = isTsFile ? { execArgv: ["--import", "tsx"] } : {};

      // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
      worker = new NodeWorker(workerPath, workerOptions) as unknown as Worker;
    } else {
      // Browser/Bun: use Web Workers
      const workerUrl = this.workerUrl ?? new URL("./worker.js", import.meta.url).href;
      worker = new Worker(workerUrl, { type: "module" });
    }

    const pooledWorker: PooledWorker = { worker, busy: false };

    // Set up message handler
    if (isNodeOnly()) {
      // Node.js worker_threads uses .on('message')
      // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
      const nodeWorker = worker as unknown as import("worker_threads").Worker;
      nodeWorker.on("message", (data: WorkerResponse) => {
        this.handleWorkerMessage(pooledWorker, data);
      });
      nodeWorker.on("error", (error: Error) => {
        this.handleWorkerError(pooledWorker, error);
      });
    } else {
      // Browser/Bun uses onmessage
      worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
        this.handleWorkerMessage(pooledWorker, event.data);
      };
      worker.onerror = (error: ErrorEvent) => {
        this.handleWorkerError(pooledWorker, new Error(error.message));
      };
    }

    return pooledWorker;
  }

  /**
   * Run a task on a worker
   */
  private runTask(pooledWorker: PooledWorker, task: PendingTask): void {
    pooledWorker.busy = true;

    // Store task info on the worker for response matching
    pooledWorker.currentTask = task;

    const request: WorkerRequest = {
      id: task.id,
      src: task.src,
      args: task.args,
    };

    pooledWorker.worker.postMessage(request);
  }

  /**
   * Handle message from worker
   */
  private handleWorkerMessage(pooledWorker: PooledWorker, data: WorkerResponse): void {
    const task = pooledWorker.currentTask;

    if (task !== undefined && task.id === data.id) {
      if (data.error !== undefined) {
        task.reject(new Error(data.error));
      } else {
        task.resolve(data.result);
      }
    }

    // Mark worker as available
    pooledWorker.busy = false;
    pooledWorker.currentTask = undefined;

    // Process next pending task if any
    this.processNextPending(pooledWorker);
  }

  /**
   * Handle worker error
   */
  private handleWorkerError(pooledWorker: PooledWorker, error: Error): void {
    const task = pooledWorker.currentTask;

    if (task !== undefined) {
      task.reject(error);
    }

    // Mark worker as available
    pooledWorker.busy = false;
    pooledWorker.currentTask = undefined;

    // Process next pending task if any
    this.processNextPending(pooledWorker);
  }

  /**
   * Process next pending task on an available worker
   */
  private processNextPending(pooledWorker: PooledWorker): void {
    if (this.pending.length > 0 && !pooledWorker.busy) {
      const nextTask = this.pending.shift();
      if (nextTask) {
        this.runTask(pooledWorker, nextTask);
      }
    }
  }

  /**
   * Terminate all workers and clear the pool
   */
  terminate(): void {
    for (const { worker } of this.workers) {
      if (isNodeOnly() && this.nodeWorkerModule !== null) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
        const nodeWorker = worker as unknown as import("worker_threads").Worker;
        void nodeWorker.terminate();
      } else {
        worker.terminate();
      }
    }
    this.workers = [];
    this.pending = [];
  }
}

/**
 * Singleton instance of the worker pool
 */
export const WorkerPool = new WorkerPoolImpl();
