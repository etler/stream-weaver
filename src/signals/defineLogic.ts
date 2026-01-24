import { LogicSignal } from "./types";
import { LogicFunction } from "./logicTypes";
import { allocateSourceId, allocateLogicId } from "./idAllocation";

/**
 * Input types that defineLogic accepts at compile time:
 * 1. Promise<Module> - from import("./path"), transformed to object at build time
 * 2. LogicSignal object - the pre-transformed object from the plugin
 * 3. string - backwards compatible path string
 * 4. Object with src - manual specification { src: './path' }
 */

/**
 * Options for defineLogic
 */
export interface CreateLogicOptions {
  /**
   * Timeout in milliseconds for deferred execution
   * - undefined = no timeout, always inline (blocking)
   * - 0 = always defer immediately (never block)
   * - > 0 = wait up to N ms, then defer if not complete
   */
  timeout?: number;
  /**
   * Execution context restriction
   * - undefined = execute anywhere
   * - 'client' = only execute on client (returns PENDING on server)
   * - 'server' = only execute on server (M13)
   * - 'worker' = execute in worker thread (M16)
   */
  context?: "server" | "client" | "worker";
}

/**
 * Creates a new logic signal definition with full type inference
 *
 * When used with import(), the logic function's type is captured:
 * @example
 * // Type-safe (with build plugin)
 * const doubleLogic = defineLogic(import("./double"));
 * // doubleLogic is LogicSignal<(count: number) => number>
 *
 * @example
 * // With timeout option (deferred execution)
 * const slowLogic = defineLogic(import("./slow"), { timeout: 0 });
 *
 * @example
 * // Backwards compatible (no type info)
 * const legacyLogic = defineLogic("./double.js");
 * // legacyLogic is LogicSignal<LogicFunction>
 */

// Overload 1: Type-safe import() syntax - extracts type from module promise
export function defineLogic<M extends { default: LogicFunction }>(
  mod: Promise<M>,
  options?: CreateLogicOptions,
): LogicSignal<M["default"]>;

// Overload 2: Pre-transformed LogicSignal object from plugin
export function defineLogic<F extends LogicFunction>(
  input: LogicSignal<F>,
  options?: CreateLogicOptions,
): LogicSignal<F>;

// Overload 3: Legacy string path or object with src (no type info)
export function defineLogic(input: string | { src: string }, options?: CreateLogicOptions): LogicSignal;

// Implementation
export function defineLogic(input: unknown, options?: CreateLogicOptions): LogicSignal {
  // Handle string input (legacy usage)
  if (typeof input === "string") {
    return {
      id: allocateSourceId(),
      kind: "logic",
      src: input,
      timeout: options?.timeout,
      context: options?.context,
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
  const maybeLogic = input as Record<string, unknown>;

  // Handle object with src property: { src: './path' }
  if (typeof maybeLogic["src"] === "string" && maybeLogic["kind"] === undefined) {
    return {
      id: allocateSourceId(),
      kind: "logic",
      src: maybeLogic["src"],
      timeout: options?.timeout,
      context: options?.context,
    };
  }

  // At runtime, plugin has transformed import() to a LogicSignal object
  // Check if it's already a complete LogicSignal
  if (maybeLogic["kind"] === "logic" && typeof maybeLogic["id"] === "string" && typeof maybeLogic["src"] === "string") {
    // Already a complete LogicSignal from plugin transform
    // Merge in any additional options
    if (options?.timeout !== undefined || options?.context !== undefined) {
      // Generate a content-addressable ID that includes the options
      // This ensures same module with different options gets different IDs
      // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
      const baseLogic = maybeLogic as unknown as LogicSignal;
      return {
        ...baseLogic,
        id: allocateLogicId(baseLogic.src, options.timeout, options.context),
        timeout: options.timeout,
        context: options.context,
      };
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
    return maybeLogic as unknown as LogicSignal;
  }

  // Fallback: If somehow we got here without proper input, throw
  // This shouldn't happen with correct plugin setup
  throw new Error(
    "defineLogic received unexpected input. " +
      "When using import(), ensure the stream-weaver plugin is configured. " +
      "For legacy usage, pass a string path or { src: './path' }.",
  );
}

/**
 * Options for context-specific logic builders (defineClientLogic, defineServerLogic, defineWorkerLogic)
 */
export interface ContextLogicOptions {
  /**
   * Timeout in milliseconds for deferred execution
   * - undefined = no timeout, always inline (blocking)
   * - 0 = always defer immediately (never block)
   * - > 0 = wait up to N ms, then defer if not complete
   */
  timeout?: number;
}

/**
 * Creates a client-only logic signal
 *
 * Client logic only executes in the browser. On the server, it returns PENDING
 * (or the init value if provided to defineComputed).
 *
 * Use this for browser-specific APIs like localStorage, window dimensions, etc.
 *
 * @example
 * const viewportLogic = defineClientLogic(import("./getViewport"));
 * const viewport = defineComputed(viewportLogic, [], { width: 1024, height: 768 });
 *
 * @example
 * // With deferred execution (non-blocking)
 * const deferredLogic = defineClientLogic(import("./heavyComputation"), { timeout: 0 });
 */

// Overload 1: Type-safe import() syntax
export function defineClientLogic<M extends { default: LogicFunction }>(
  mod: Promise<M>,
  options?: ContextLogicOptions,
): LogicSignal<M["default"]>;

// Overload 2: Pre-transformed LogicSignal object from plugin
export function defineClientLogic<F extends LogicFunction>(
  input: LogicSignal<F>,
  options?: ContextLogicOptions,
): LogicSignal<F>;

// Overload 3: Legacy string path
export function defineClientLogic(src: string, options?: ContextLogicOptions): LogicSignal;

// Implementation
export function defineClientLogic(input: unknown, options?: ContextLogicOptions): LogicSignal {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
  return defineLogic(input as string | { src: string }, { ...options, context: "client" });
}

/**
 * Creates a server-only logic signal
 *
 * Server logic only executes on the server. On the client, it triggers an RPC call
 * to the server endpoint which executes the logic and returns the result.
 *
 * Use this for server-side operations like database access, file system, etc.
 *
 * @example
 * const fetchUserLogic = defineServerLogic(import("./fetchUser"));
 * const user = defineComputed(fetchUserLogic, [userId]);
 *
 * @example
 * // With deferred execution (non-blocking)
 * const deferredLogic = defineServerLogic(import("./slowQuery"), { timeout: 0 });
 */

// Overload 1: Type-safe import() syntax
export function defineServerLogic<M extends { default: LogicFunction }>(
  mod: Promise<M>,
  options?: ContextLogicOptions,
): LogicSignal<M["default"]>;

// Overload 2: Pre-transformed LogicSignal object from plugin
export function defineServerLogic<F extends LogicFunction>(
  input: LogicSignal<F>,
  options?: ContextLogicOptions,
): LogicSignal<F>;

// Overload 3: Legacy string path
export function defineServerLogic(src: string, options?: ContextLogicOptions): LogicSignal;

// Implementation
export function defineServerLogic(input: unknown, options?: ContextLogicOptions): LogicSignal {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
  return defineLogic(input as string | { src: string }, { ...options, context: "server" });
}

/**
 * Creates a worker logic signal
 *
 * Worker logic executes in a separate thread (Web Worker in browser/Bun,
 * worker_threads in Node.js), keeping the main thread responsive during
 * CPU-intensive operations.
 *
 * Use this for heavy computation like image processing, data parsing, etc.
 *
 * @example
 * const fibLogic = defineWorkerLogic(import("./fibonacci"));
 * const result = defineComputed(fibLogic, [n]);
 *
 * @example
 * // With deferred execution (non-blocking, shows loading state)
 * const deferredFibLogic = defineWorkerLogic(import("./fibonacci"), { timeout: 0 });
 * const result = defineComputed(deferredFibLogic, [n]);
 */

// Overload 1: Type-safe import() syntax
export function defineWorkerLogic<M extends { default: LogicFunction }>(
  mod: Promise<M>,
  options?: ContextLogicOptions,
): LogicSignal<M["default"]>;

// Overload 2: Pre-transformed LogicSignal object from plugin
export function defineWorkerLogic<F extends LogicFunction>(
  input: LogicSignal<F>,
  options?: ContextLogicOptions,
): LogicSignal<F>;

// Overload 3: Legacy string path
export function defineWorkerLogic(src: string, options?: ContextLogicOptions): LogicSignal;

// Implementation
export function defineWorkerLogic(input: unknown, options?: ContextLogicOptions): LogicSignal {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
  return defineLogic(input as string | { src: string }, { ...options, context: "worker" });
}
