import { type Node } from "@/jsx/types/Node";
import { type WeaverRegistry } from "@/registry/WeaverRegistry";
import { isSignal } from "@/ComponentDelegate/signalDetection";

/**
 * Recursively walks a JSX tree and registers all signals found in the registry
 * This should be called before streaming to ensure all signals are available
 */
export function registerSignalsInTree(node: Node, registry: WeaverRegistry): void {
  // Handle null/undefined
  if (node === null || node === undefined) {
    return;
  }

  // Handle signals
  if (isSignal(node)) {
    registry.registerIfAbsent(node);

    // Register referenced signals (logicRef, depsRef, sourceRef, reducerRef)
    if ("logicRef" in node && isSignal(node.logicRef)) {
      registry.registerIfAbsent(node.logicRef);
    }

    if ("depsRef" in node && Array.isArray(node.depsRef)) {
      for (const dep of node.depsRef) {
        if (isSignal(dep)) {
          registry.registerIfAbsent(dep);
        }
      }
    }

    if ("sourceRef" in node && isSignal(node.sourceRef)) {
      registry.registerIfAbsent(node.sourceRef);
    }

    if ("reducerRef" in node && isSignal(node.reducerRef)) {
      registry.registerIfAbsent(node.reducerRef);
    }

    return;
  }

  // Handle primitives
  if (typeof node !== "object") {
    return;
  }

  // Handle arrays
  if (Array.isArray(node)) {
    for (const child of node) {
      registerSignalsInTree(child, registry);
    }
    return;
  }

  // Handle JSX elements
  if ("type" in node && typeof node === "object") {
    const element = node as { type: unknown; props?: unknown; children?: unknown };

    // Process props - they can contain signals or other nodes
    if (element.props !== null && element.props !== undefined && typeof element.props === "object") {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
      const props = element.props as Record<string, unknown>;
      for (const propValue of Object.values(props)) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
        registerSignalsInTree(propValue as Node, registry);
      }
    }

    // Process children
    if (element.children !== null && element.children !== undefined) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
      registerSignalsInTree(element.children as Node, registry);
    }
  }
}
