import { WeaverRegistry } from "@/registry/WeaverRegistry";
import { ComputedSignal } from "@/signals/types";
import { executeComputed } from "./executeComputed";

/**
 * Pre-executes all server-context computed signals during SSR
 *
 * During SSR, computed signals with server-context logic need to be
 * executed before serialization so their values are available in the
 * initial HTML. This function finds all such signals in the registry
 * and executes them.
 *
 * @param registry - The WeaverRegistry containing signal definitions
 */
export async function preExecuteServerLogic(registry: WeaverRegistry): Promise<void> {
  const toExecute: string[] = [];

  // Find all computed signals with non-client-context logic
  for (const [id, signal] of registry.getAllSignals()) {
    if (signal.kind !== "computed") {
      continue;
    }

    const computed = signal as ComputedSignal;
    const logicSignal = registry.getSignal(computed.logic);

    // Check if this computed uses logic that should execute during SSR
    // Execute all contexts except client-only:
    // - undefined (isomorphic): executes on both server and client
    // - "server": executes only on server (client uses RPC)
    // - "worker": executes in worker thread
    // Skip "client": executes only on client
    if (logicSignal?.kind === "logic" && logicSignal.context !== "client") {
      // Only execute if we don't already have a value
      if (registry.getValue(id) === undefined) {
        toExecute.push(id);
      }
    }
  }

  // Execute all server-context computed signals in parallel
  await Promise.all(toExecute.map(async (id) => executeComputed(registry, id)));
}
