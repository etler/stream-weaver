import { ComponentSignal, NodeSignal } from "./types";
import { allocateDerivedId } from "./idAllocation";
import { isSignal } from "@/ComponentDelegate/signalDetection";

/**
 * Creates a node signal - a component instance with bound props
 *
 * Nodes are the reactive entities in the component tree. They re-render
 * when their prop signals change. Node IDs are content-addressable based
 * on the component and props, so identical instances share the same ID.
 *
 * @param component - ComponentSignal template
 * @param props - Props object containing signals or primitives
 * @returns NodeSignal instance
 *
 * @example
 * ```typescript
 * const UserCard = createComponent(createLogic("/components/UserCard.tsx"));
 * const nameSignal = createSignal("Alice");
 *
 * // Create a node instance
 * const node = createNode(UserCard, { name: nameSignal, age: 25 });
 *
 * // Same component + props = same node ID (content-addressable)
 * const node2 = createNode(UserCard, { name: nameSignal, age: 25 });
 * // node.id === node2.id
 * ```
 */
export function createNode(component: ComponentSignal, props: Record<string, unknown>): NodeSignal {
  // Extract signal dependencies from props
  const deps: string[] = [];
  for (const value of Object.values(props)) {
    if (isSignal(value)) {
      deps.push(value.id);
    }
  }

  // Get logic ID from the component
  const logicId = typeof component.logic === "string" ? component.logic : component.logic.id;

  // Serialize props for hashing (signal IDs for signals, values for primitives)
  const propsForHash: Record<string, string> = {};
  for (const [key, value] of Object.entries(props)) {
    if (isSignal(value)) {
      propsForHash[key] = value.id;
    } else if (value === undefined) {
      propsForHash[key] = "undefined";
    } else if (value === null) {
      propsForHash[key] = "null";
    } else {
      propsForHash[key] = JSON.stringify(value);
    }
  }
  const propsString = JSON.stringify(propsForHash);

  // Generate content-addressable ID based on component + props
  const id = allocateDerivedId(component.id, [propsString]);

  // Get the logic reference if available (for runtime use)
  const logicRef = typeof component.logic === "object" ? component.logic : undefined;

  return {
    id,
    kind: "node",
    logic: logicId,
    component: component.id,
    props,
    deps,
    // Non-serializable references for runtime use
    _logicRef: logicRef,
    _componentRef: component,
  };
}
