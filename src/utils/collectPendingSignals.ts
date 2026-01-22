import { Node } from "@/jsx/types/Node";
import { isSignal } from "@/ComponentDelegate/signalDetection";
import { WeaverRegistry } from "@/registry/WeaverRegistry";
import { PENDING } from "@/signals/pending";
import { Element } from "@/jsx/types/Element";

/**
 * Walk a node tree and collect all signal IDs that have PENDING values
 *
 * Used by Suspense to determine if children are still loading.
 *
 * @param node - The node tree to walk
 * @param registry - The registry to check signal values
 * @returns Array of signal IDs that have PENDING values
 */
export function collectPendingSignals(node: Node, registry: WeaverRegistry): string[] {
  const pending: string[] = [];
  const visited = new Set<string>();

  function walk(current: Node): void {
    if (current === null || current === undefined) {
      return;
    }

    // Array of nodes
    if (Array.isArray(current)) {
      for (const child of current) {
        walk(child);
      }
      return;
    }

    // Signal node - check for PENDING value
    if (isSignal(current)) {
      // Skip if already visited
      if (visited.has(current.id)) {
        return;
      }
      visited.add(current.id);

      const value = registry.getValue(current.id);
      if (value === PENDING) {
        pending.push(current.id);
      }

      // For NodeSignal, also check props for signals
      if (current.kind === "node") {
        const nodeSignal = current;
        for (const propValue of Object.values(nodeSignal.props)) {
          if (isSignal(propValue)) {
            if (!visited.has(propValue.id)) {
              visited.add(propValue.id);
              const propVal = registry.getValue(propValue.id);
              if (propVal === PENDING) {
                pending.push(propValue.id);
              }
            }
          }
        }
      }

      // For signals with children (like SuspenseSignal), walk children
      if ("children" in current && current.children !== undefined) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
        walk(current.children as Node);
      }

      return;
    }

    // Primitive values
    if (typeof current === "string" || typeof current === "number" || typeof current === "boolean") {
      return;
    }

    // Element - walk children and props
    if (typeof current === "object" && "type" in current && "children" in current) {
      const element = current as Element;
      // Check props for signals
      if (element.props !== null && typeof element.props === "object") {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        for (const propValue of Object.values(element.props)) {
          if (isSignal(propValue)) {
            if (!visited.has(propValue.id)) {
              visited.add(propValue.id);
              const propVal = registry.getValue(propValue.id);
              if (propVal === PENDING) {
                pending.push(propValue.id);
              }
            }
          }
        }
      }

      // Walk children
      for (const child of element.children) {
        walk(child);
      }
    }
  }

  walk(node);
  return pending;
}
