import { WeaverRegistry, getLogicSignal } from "@/registry";
import { executeLogic } from "./executeLogic";
import type { Node } from "@/jsx/types/Node";
import type { NodeSignal } from "@/signals/types";
import { isSignal } from "@/signals/signalDetection";

/**
 * Executes a NodeSignal's component logic and returns the rendered Node
 * NodeSignals receive read-only access to their prop signal dependencies
 *
 * Note: Components don't support deferred execution - they always execute inline
 * because they need to return their Node tree for rendering.
 *
 * @param registry - WeaverRegistry instance
 * @param nodeId - ID of the NodeSignal to execute
 * @returns The rendered Node tree from the component
 */
export async function executeNode(registry: WeaverRegistry, nodeId: string): Promise<Node> {
  // Get the node signal definition
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
  const node = registry.getSignal(nodeId) as NodeSignal | undefined;
  if (node?.kind !== "node") {
    throw new Error(`Signal ${nodeId} is not a node signal`);
  }

  // Get the logic signal (prefer cached reference, fallback to registry lookup)
  // eslint-disable-next-line no-underscore-dangle
  const logicSignal = node._logicRef ?? getLogicSignal(registry, node.logic);

  // Build props object with signal interfaces for signal props
  const propsWithInterfaces: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(node.props)) {
    if (isSignal(value)) {
      // Return read-only value for signal props
      propsWithInterfaces[key] = registry.getValue(value.id);
    } else {
      // Pass primitive values through
      propsWithInterfaces[key] = value;
    }
  }

  // Execute the component (handles async logic automatically)
  const result = await executeLogic(logicSignal, [propsWithInterfaces]);

  // If execution was deferred, wait for completion (shouldn't happen for components)
  if (result.deferred) {
    const deferredResult = await result.deferred;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
    return deferredResult as Node;
  }

  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
  return result.value as Node;
}
