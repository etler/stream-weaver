/**
 * Client-side Node to HTML serialization
 *
 * Used for re-rendering signal values during reactive updates.
 */

import type { Node } from "@/jsx/types/Node";
import type { WeaverRegistry } from "@/registry/WeaverRegistry";
import { renderNode } from "@/html";

/**
 * Serialize a Node tree to HTML string with signal handling
 * Registers signals with the registry and adds proper data-w-* attributes
 */
export function nodeToHtml(node: Node, registry?: WeaverRegistry): string {
  // Client-side: no signal definitions needed, async content just returns empty
  return renderNode(node, { registry }) ?? "";
}
