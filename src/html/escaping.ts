/**
 * HTML escaping utilities
 *
 * Single source of truth for text and attribute escaping.
 * Uses regex with lookup maps for performance.
 */

const TEXT_ESCAPE_RE = /[&<>]/g;
const TEXT_ESCAPE_MAP: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
};

const ATTR_ESCAPE_RE = /[&<>"']/g;
const ATTR_ESCAPE_MAP: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&apos;",
};

/**
 * Escape text content for safe HTML insertion.
 * Escapes &, <, and >.
 */
export function escapeText(text: string): string {
  return text.replace(TEXT_ESCAPE_RE, (char) => TEXT_ESCAPE_MAP[char] ?? char);
}

/**
 * Escape attribute values for safe HTML insertion.
 * Escapes &, <, >, ", and '.
 */
export function escapeAttribute(text: string): string {
  return text.replace(ATTR_ESCAPE_RE, (char) => ATTR_ESCAPE_MAP[char] ?? char);
}
