/**
 * HTML attribute utilities
 *
 * Single source of truth for JSX to HTML attribute name mapping.
 */

/**
 * Convert JSX attribute names to HTML attribute names.
 * Handles React-style naming conventions.
 */
export function normalizeAttributeName(jsxName: string): string {
  switch (jsxName) {
    case "className":
      return "class";
    case "htmlFor":
      return "for";
    default:
      return jsxName;
  }
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
