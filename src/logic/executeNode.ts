import { WeaverRegistry } from "@/registry/WeaverRegistry";
import { loadLogic } from "./loadLogic";
import { createReadOnlySignalInterface } from "./signalInterfaces";
import type { Node } from "@/jsx/types/Node";
import type { NodeSignal, LogicSignal } from "@/signals/types";
import { isSignal } from "@/ComponentDelegate/signalDetection";

/**
 * Executes a NodeSignal's component logic and returns the rendered Node
 * NodeSignals receive read-only access to their prop signal dependencies
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

  // Get the logic signal
  // eslint-disable-next-line no-underscore-dangle
  let logicSignal = node._logicRef;
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
  logicSignal ??= registry.getSignal(node.logic) as LogicSignal | undefined;
  if (logicSignal?.kind !== "logic") {
    throw new Error(`Logic signal ${node.logic} not found for node ${nodeId}`);
  }

  // Load the component function
  const componentFn = await loadLogic(logicSignal);
  if (typeof componentFn !== "function") {
    throw new Error(`Component module ${logicSignal.src} does not export a function`);
  }

  // Build props object with signal interfaces for signal props
  const propsWithInterfaces: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(node.props)) {
    if (isSignal(value)) {
      // Create a read-only interface for signal props
      propsWithInterfaces[key] = createReadOnlySignalInterface(registry, value.id);
    } else {
      // Pass primitive values through
      propsWithInterfaces[key] = value;
    }
  }

  // Execute the component
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
  const result = componentFn(propsWithInterfaces) as Node | Promise<Node>;

  // Handle async components
  if (result instanceof Promise) {
    return await result;
  }

  return result;
}
