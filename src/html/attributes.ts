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
