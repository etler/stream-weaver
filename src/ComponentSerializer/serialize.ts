/**
 * Direct HTML serialization - bypasses Token objects entirely
 * Used by the fast path for static content
 */

import { isSignal, isSuspenseSignal } from "@/signals/signalDetection";
import { Node } from "@/jsx/types/Node";
import { WeaverRegistry } from "@/registry/WeaverRegistry";
import {
  escapeAttribute,
  escapeText,
  isSelfClosingTag,
  normalizeAttributeName,
  renderNode,
  serializeSignalDefinition,
  type RenderOptions,
} from "@/html";
import { requiresAsyncProcessing } from "@/registry/helpers";
import { OpenTagToken, Token } from "@/ComponentDelegate/types/Token";

/**
 * Directly serialize a JSX element tree to HTML string
 * Returns null if the tree contains async content (function components)
 */
export function serializeElement(node: Node, registry?: WeaverRegistry): string | null {
  // SuspenseSignal requires processing via ComponentDelegate
  if (isSuspenseSignal(node)) {
    return null;
  }

  // Check for signals that need async handling
  if (isSignal(node) && registry && requiresAsyncProcessing(node, registry)) {
    return null;
  }

  const options: RenderOptions = {
    registry,
    emitSignalDefinitions: true,
    rejectAsync: true,
    asyncCheck: registry ? (signal) => requiresAsyncProcessing(signal, registry) : undefined,
  };

  return renderNode(node, options);
}

/**
 * Convert an array of tokens to HTML string
 * Optionally skip signal-definition tokens (for content-only HTML)
 */
export function serializeTokenArray(tokens: Token[], skipSignalDefs = false): string {
  let html = "";
  for (const token of tokens) {
    if (skipSignalDefs && token.kind === "signal-definition") {
      continue;
    }
    html += serializeToken(token);
  }
  return html;
}

export function serializeToken(token: Token): string {
  switch (token.kind) {
    case "open": {
      const attributeString = serializeAttributes(token);
      const separator = attributeString ? " " : "";
      if (isSelfClosingTag(token.tag)) {
        return `<${token.tag}${separator}${attributeString}/>`;
      } else {
        return `<${token.tag}${separator}${attributeString}>`;
      }
    }
    case "text":
      return escapeText(token.content);
    case "close":
      if (!isSelfClosingTag(token.tag)) {
        return `</${token.tag}>`;
      } else {
        return "";
      }
    case "bind-marker-open":
      return `<!--^${token.id}-->`;
    case "bind-marker-close":
      return `<!--/${token.id}-->`;
    case "signal-definition":
      return serializeSignalDefinition(token.signal);
    case "raw-html":
      // Pre-serialized HTML from fast path - pass through directly
      return token.content;
  }
}

export function serializeAttributes(token: OpenTagToken): string {
  const attributeStrings = Object.entries(token.attributes).map(([key, value]) => {
    const attributeName = normalizeAttributeName(key);
    const valueString = value !== null ? `=${JSON.stringify(escapeAttribute(value))}` : "";
    return `${attributeName}${valueString}`;
  });
  return attributeStrings.join(" ");
}
