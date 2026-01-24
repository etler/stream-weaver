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
 * Uses the web-worker npm package for isomorphic Worker API across
 * Browser, Node.js, and Bun environments.
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
   * Set the worker script URL
   */
  setWorkerUrl(url: string): void {
    this.workerUrl = url;
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
   * Create a new worker using the web-worker package (isomorphic)
   */
  private async createWorker(): Promise<PooledWorker> {
    // Detect TypeScript runtime (tsx/ts-node) to use correct file extension
    const isTsRuntime =
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      typeof process !== "undefined" && process.execArgv?.some((arg) => arg.includes("tsx") || arg.includes("ts-node"));
    const ext = isTsRuntime ? ".ts" : ".js";
    const workerUrl = this.workerUrl ?? new URL(`./worker${ext}`, import.meta.url).href;

    // Use web-worker package for isomorphic Worker API (works in Browser, Node.js, and Bun)
    const WebWorker = (await import("web-worker")).default;
    // For TypeScript files in Node.js, pass tsx loader via execArgv
    const workerOptions: { type: "module"; execArgv?: string[] } = { type: "module" };
    if (isTsRuntime) {
      workerOptions.execArgv = ["--import", "tsx"];
    }
    const worker: Worker = new WebWorker(workerUrl, workerOptions);

    const pooledWorker: PooledWorker = { worker, busy: false };

    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      this.handleWorkerMessage(pooledWorker, event.data);
    };
    worker.onerror = (error: ErrorEvent) => {
      // Extract as much info as possible from the error event
      const message = error.message || error.filename || "Worker error";
      const details = error.filename ? ` (${error.filename}:${String(error.lineno)}:${String(error.colno)})` : "";
      this.handleWorkerError(pooledWorker, new Error(message + details));
    };

    return pooledWorker;
  }

  /**
   * Run a task on a worker
   */
  private runTask(pooledWorker: PooledWorker, task: PendingTask): void {
    pooledWorker.busy = true;
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
      worker.terminate();
    }
    this.workers = [];
    this.pending = [];
  }
}

/**
 * Singleton instance of the worker pool
 */
export const WorkerPool = new WorkerPoolImpl();
