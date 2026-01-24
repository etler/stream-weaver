/**
 * HTML tag utilities
 *
 * Single source of truth for self-closing tag detection.
 * Uses switch statement for O(1) performance.
 */

/**
 * Check if an HTML tag is self-closing (void element).
 * Self-closing tags cannot have children and don't need closing tags.
 */
export function isSelfClosingTag(tag: string): boolean {
  switch (tag) {
    case "area":
    case "base":
    case "br":
    case "col":
    case "embed":
    case "hr":
    case "img":
    case "input":
    case "link":
    case "meta":
    case "param":
    case "source":
    case "track":
    case "wbr":
      return true;
    default:
      return false;
  }
}
