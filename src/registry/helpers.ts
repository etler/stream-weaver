import type {
  LogicSignal,
  ComputedSignal,
  ActionSignal,
  HandlerSignal,
  ReducerSignal,
  AnySignal,
} from "@/signals/types";
import type { WeaverRegistry } from "./WeaverRegistry";

/**
 * Registry helper functions
 *
 * Common patterns for working with the registry that are repeated across the codebase.
 */

/**
 * Get and validate a logic signal from the registry.
 * Throws if the signal doesn't exist or isn't a logic signal.
 *
 * @param registry - The registry to query
 * @param logicId - The ID of the logic signal to retrieve
 * @returns The validated LogicSignal
 * @throws Error if the signal doesn't exist or isn't a logic signal
 */
export function getLogicSignal(registry: WeaverRegistry, logicId: string): LogicSignal {
  const signal = registry.getSignal(logicId);
  if (signal?.kind !== "logic") {
    throw new Error(`Logic signal ${logicId} not found or invalid`);
  }
  return signal;
}

/**
 * Get and validate a computed signal from the registry.
 * Throws if the signal doesn't exist or isn't a computed signal.
 */
export function getComputedSignal(registry: WeaverRegistry, computedId: string): ComputedSignal {
  const signal = registry.getSignal(computedId);
  if (signal?.kind !== "computed") {
    throw new Error(`Signal ${computedId} is not a computed signal`);
  }
  return signal;
}

/**
 * Get and validate an action signal from the registry.
 * Throws if the signal doesn't exist or isn't an action signal.
 */
export function getActionSignal(registry: WeaverRegistry, actionId: string): ActionSignal {
  const signal = registry.getSignal(actionId);
  if (signal?.kind !== "action") {
    throw new Error(`Signal ${actionId} is not an action signal`);
  }
  return signal;
}

/**
 * Get and validate a handler signal from the registry.
 * Throws if the signal doesn't exist or isn't a handler signal.
 */
export function getHandlerSignal(registry: WeaverRegistry, handlerId: string): HandlerSignal {
  const signal = registry.getSignal(handlerId);
  if (signal?.kind !== "handler") {
    throw new Error(`Signal ${handlerId} is not a handler signal`);
  }
  return signal;
}

/**
 * Get and validate a reducer signal from the registry.
 * Throws if the signal doesn't exist or isn't a reducer signal.
 */
export function getReducerSignal(registry: WeaverRegistry, reducerId: string): ReducerSignal {
  const signal = registry.getSignal(reducerId);
  if (signal?.kind !== "reducer") {
    throw new Error(`Signal ${reducerId} is not a reducer signal`);
  }
  return signal;
}

/**
 * Check if a signal requires async processing (server fast-path rejection)
 */
export function requiresAsyncProcessing(signal: AnySignal, registry: WeaverRegistry): boolean {
  // Suspense and Node signals always need streaming path
  if (signal.kind === "suspense" || signal.kind === "node") {
    return true;
  }

  // Computed signals with non-client context need async execution during SSR
  if (signal.kind === "computed") {
    const computed = signal as ComputedSignal;
    const logicSignal = computed.logicRef;

    // Any non-client context (undefined=isomorphic, "server", "worker") needs async execution
    // if the value hasn't been computed yet. This matches the check in tokenize.ts.
    if (logicSignal !== undefined && logicSignal.context !== "client" && registry.getValue(signal.id) === undefined) {
      return true;
    }

    // Deferred computed signals (timeout: 0) need streaming for Suspense detection
    if (logicSignal?.timeout === 0) {
      return true;
    }
  }

  return false;
}
