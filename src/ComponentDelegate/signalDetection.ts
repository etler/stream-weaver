import { AnySignal } from "@/signals/types";

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
      obj["kind"] === "node")
  );
}

/**
 * Checks if a prop name represents an event handler
 */
export function isEventHandlerProp(propName: string): boolean {
  return propName.startsWith("on") && propName.length > 2;
}

/**
 * Converts a React-style event prop name to a data attribute name
 * Example: onClick -> data-w-onclick
 */
export function eventPropToDataAttribute(propName: string): string {
  return `data-w-${propName.toLowerCase()}`;
}

/**
 * Converts a regular prop name to a data attribute name for signal binding
 * Example: className -> data-w-classname
 */
export function propToDataAttribute(propName: string): string {
  return `data-w-${propName.toLowerCase()}`;
}
