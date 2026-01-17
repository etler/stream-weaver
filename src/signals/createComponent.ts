import { ComponentSignal, LogicSignal } from "./types";
import { allocateDerivedId } from "./idAllocation";
import { isSignal } from "@/ComponentDelegate/signalDetection";

/**
 * Creates a component signal with bound props
 * Components are reactive entities that re-render when prop signals change
 *
 * @param logic - LogicSignal or logic definition object
 * @param props - Props object containing signals or primitives
 * @returns ComponentSignal with extracted dependencies
 */
export function createComponent(logic: LogicSignal | { src: string }, props: Record<string, unknown>): ComponentSignal {
  // Extract signal dependencies from props
  const deps: string[] = [];
  for (const value of Object.values(props)) {
    if (isSignal(value)) {
      deps.push(value.id);
    }
  }

  // Get logic ID for content-addressable hash
  const logicId = typeof logic === "object" && "id" in logic ? logic.id : JSON.stringify(logic);

  // Serialize props for hashing (signal IDs for signals, values for primitives)
  const propsForHash: Record<string, string> = {};
  for (const [key, value] of Object.entries(props)) {
    if (isSignal(value)) {
      propsForHash[key] = value.id;
    } else {
      propsForHash[key] = String(value);
    }
  }
  const propsString = JSON.stringify(propsForHash);

  // Generate content-addressable ID
  const id = allocateDerivedId(logicId, [propsString]);

  return {
    id,
    kind: "component",
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
    logic: logic as LogicSignal | string,
    props,
    deps,
  };
}
