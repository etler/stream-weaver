import { WeaverRegistry } from "@/registry/WeaverRegistry";
import { AnySignal } from "@/signals/types";
import { JsonValue } from "@/signals/serializableTypes";

/**
 * Serialized signal with its value
 * Values are included for state signals and computed signals that have been evaluated
 */
export interface SerializedSignal {
  signal: AnySignal;
  value?: JsonValue;
}

/**
 * Serialized signal chain
 * Contains all signals and values needed to execute a target signal on the server
 */
export interface SignalChain {
  /** Target signal ID to execute */
  targetId: string;
  /** All signals in the dependency graph */
  signals: SerializedSignal[];
}

/**
 * Checks if a value is JSON-serializable
 * Used to determine if a computed value can be used as a pruning point
 *
 * @param value - Value to check
 * @returns true if value is JSON-serializable
 */
function isSerializable(value: unknown): value is JsonValue {
  if (value === null || value === undefined) {
    return true;
  }
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return true;
  }
  if (Array.isArray(value)) {
    return value.every(isSerializable);
  }
  if (typeof value === "object") {
    // Check for plain object (not class instance, Date, etc.)
    if (Object.getPrototypeOf(value) !== Object.prototype) {
      return false;
    }
    return Object.values(value).every(isSerializable);
  }
  return false;
}

/**
 * Serializes a signal chain for remote execution
 *
 * Walks the dependency graph starting from the target signal and collects
 * all signals and values needed for execution. Prunes at computed signals
 * that have serializable values (no need to include their dependencies).
 *
 * @param registry - The registry containing signal definitions and values
 * @param signalId - The target signal to execute on the server
 * @returns Serialized chain ready for transmission
 */
export function serializeSignalChain(registry: WeaverRegistry, signalId: string): SignalChain {
  const signals: SerializedSignal[] = [];
  const visited = new Set<string>();

  /**
   * Recursively walks the dependency graph
   * @param id - Current signal ID to process
   * @param isTarget - If true, this is the target signal we want to execute (don't prune)
   */
  function walk(id: string, isTarget = false): void {
    if (visited.has(id)) {
      return;
    }
    visited.add(id);

    const signal = registry.getSignal(id);
    if (!signal) {
      return;
    }

    const value = registry.getValue(id);

    // Check if this is a computed signal with a serializable value
    // If so, we can prune here - no need to include its dependencies
    // EXCEPT if this is the target signal - we always need to re-execute it
    if (!isTarget && signal.kind === "computed" && value !== undefined && isSerializable(value)) {
      // Include this signal with its value but don't walk its dependencies
      // isSerializable already narrowed value to JsonValue
      signals.push({
        signal: sanitizeSignal(signal),
        value,
      });
      return;
    }

    // Include the signal
    const serializedSignal: SerializedSignal = {
      signal: sanitizeSignal(signal),
    };

    // Include value for state signals and computed signals
    // isSerializable already narrowed value to JsonValue
    if ((signal.kind === "state" || signal.kind === "computed") && value !== undefined && isSerializable(value)) {
      serializedSignal.value = value;
    }

    signals.push(serializedSignal);

    // Walk dependencies
    if (signal.kind === "computed" || signal.kind === "action" || signal.kind === "handler" || signal.kind === "node") {
      // Walk the logic signal
      walk(signal.logic);

      // Walk dependency signals
      for (const depId of signal.deps) {
        walk(depId);
      }
    }
  }

  walk(signalId, true); // true = this is the target signal, don't prune it

  return {
    targetId: signalId,
    signals,
  };
}

/**
 * Sanitizes a signal for serialization by removing non-serializable references
 *
 * @param signal - Signal to sanitize
 * @returns Clean signal object safe for JSON serialization
 */
function sanitizeSignal(signal: AnySignal): AnySignal {
  // Create a copy without non-serializable references
  if (signal.kind === "node") {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { _logicRef: _lr, _componentRef: _cr, ...rest } = signal;
    return rest;
  }
  if (signal.kind === "computed" || signal.kind === "action" || signal.kind === "handler") {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { logicRef: _ref, ...rest } = signal;
    return rest;
  }
  // For logic signals, keep both src and ssrSrc for server execution
  // The server needs the path to load the module
  if (signal.kind === "logic") {
    return {
      id: signal.id,
      kind: "logic",
      src: signal.src,
      ssrSrc: signal.ssrSrc,
      timeout: signal.timeout,
      context: signal.context,
    };
  }
  return signal;
}

/**
 * Default endpoint for remote execution
 */
const DEFAULT_ENDPOINT = "/weaver/execute";

/**
 * Detects if running in browser environment
 */
function isClient(): boolean {
  return typeof window !== "undefined" && typeof document !== "undefined";
}

/**
 * Executes a signal chain on the server via RPC
 *
 * Called by the client when encountering server-context logic.
 * Serializes the signal chain and sends it to the server endpoint.
 *
 * @param registry - The registry containing signal definitions and values
 * @param signalId - The target signal to execute on the server
 * @returns The result from server execution
 */
export async function executeRemote(registry: WeaverRegistry, signalId: string): Promise<unknown> {
  if (!isClient()) {
    throw new Error("executeRemote should only be called from the client");
  }

  const chain = serializeSignalChain(registry, signalId);

  const response = await fetch(DEFAULT_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(chain),
  });

  if (!response.ok) {
    throw new Error(`Server execution failed: ${response.status} ${response.statusText}`);
  }

  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
  const result = (await response.json()) as { value: unknown };
  return result.value;
}

/**
 * Executes a signal from a serialized chain on the server
 *
 * Rebuilds the registry from the chain and executes the target signal.
 * Called by the server endpoint handler.
 *
 * @param chain - The serialized signal chain from the client
 * @returns The execution result
 */
export async function executeFromChain(chain: SignalChain): Promise<unknown> {
  // Import executeComputed dynamically to avoid circular dependencies
  const { executeComputed } = await import("./executeComputed");

  // Rebuild registry from chain
  const registry = new WeaverRegistry();

  // Register all signals
  for (const { signal, value } of chain.signals) {
    registry.registerSignal(signal);
    // Set values for signals that have them
    if (value !== undefined) {
      registry.setValue(signal.id, value);
    }
  }

  // Get the target signal
  const targetSignal = registry.getSignal(chain.targetId);
  if (!targetSignal) {
    throw new Error(`Target signal ${chain.targetId} not found in chain`);
  }

  // Execute based on signal type
  if (targetSignal.kind === "computed") {
    await executeComputed(registry, chain.targetId);
    return registry.getValue(chain.targetId);
  }

  throw new Error(`Unsupported signal type for remote execution: ${targetSignal.kind}`);
}
