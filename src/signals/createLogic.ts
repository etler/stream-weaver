import { LogicSignal } from "./types";
import { allocateSourceId } from "./idAllocation";

/**
 * Creates a new logic signal definition
 * Logic signals are immutable references to executable code modules
 * In M2, this is a basic version that takes a src string
 * In M3+, this will be enhanced to handle Promise<Module> for type inference
 *
 * @param src - Module URL for runtime import
 * @returns LogicSignal definition object
 */
export function createLogic(src: string): LogicSignal {
  return {
    id: allocateSourceId(),
    kind: "logic",
    src,
  };
}
