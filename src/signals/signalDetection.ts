import { AnySignal, ComponentSignal, NodeSignal, SuspenseSignal } from "@/signals/types";

/**
 * Type guard to check if a value is a signal definition object
 */
export function isSignal(value: unknown): value is AnySignal {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
  const obj = value as Record<string, unknown>;

  // Check for required Signal properties
  return (
    typeof obj["id"] === "string" &&
    typeof obj["kind"] === "string" &&
    (obj["kind"] === "state" ||
      obj["kind"] === "logic" ||
      obj["kind"] === "computed" ||
      obj["kind"] === "action" ||
      obj["kind"] === "handler" ||
      obj["kind"] === "component" ||
      obj["kind"] === "node" ||
      obj["kind"] === "suspense" ||
      obj["kind"] === "reducer" ||
      obj["kind"] === "mutator" ||
      obj["kind"] === "reference")
  );
}

/**
 * Type guard to check if a value is a ComponentSignal (template)
 */
export function isComponentSignal(value: unknown): value is ComponentSignal {
  return isSignal(value) && value.kind === "component";
}

/**
 * Type guard to check if a value is a NodeSignal (instance)
 */
export function isNodeSignal(value: unknown): value is NodeSignal {
  return isSignal(value) && value.kind === "node";
}

/**
 * Type guard to check if a value is a SuspenseSignal (boundary)
 */
export function isSuspenseSignal(value: unknown): value is SuspenseSignal {
  return isSignal(value) && value.kind === "suspense";
}
