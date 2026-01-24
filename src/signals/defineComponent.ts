import { ComponentSignal, LogicSignal } from "./types";
import { allocateDerivedId } from "./idAllocation";

/**
 * Creates a component template signal
 *
 * Component templates are inert definitions that can be instantiated
 * multiple times with different props using defineNode() or JSX.
 *
 * @param logic - LogicSignal referencing the component module
 * @returns ComponentSignal template
 *
 * @example
 * ```typescript
 * // Create a component template
 * const UserCard = defineComponent(defineLogic("/components/UserCard.tsx"));
 *
 * // Use in JSX (automatically creates nodes)
 * <UserCard name={nameSignal} age={25} />
 * ```
 */
export function defineComponent(logic: LogicSignal): ComponentSignal {
  // Get logic ID for content-addressable hash
  const logicId = logic.id;

  // Generate content-addressable ID based on logic only
  const id = allocateDerivedId("component", [logicId]);

  return {
    id,
    kind: "component",
    logic,
  };
}
