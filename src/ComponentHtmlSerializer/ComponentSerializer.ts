import { OpenTagToken, Token } from "@/ComponentDelegate/types/Token";
import {
  escapeText,
  escapeAttribute,
  isSelfClosingTag,
  normalizeAttributeName,
  serializeSignalDefinition,
} from "@/html";

// Buffer target size for chunks after the first one
const BUFFER_TARGET_SIZE = 2048;

export class ComponentSerializer extends TransformStream<Token, string> {
  constructor() {
    let buffer = "";
    let firstChunkSent = false;

    super({
      transform: (token, controller) => {
        const serialized = serializeToken(token);
        buffer += serialized;

        if (!firstChunkSent) {
          // Flush immediately on first content to optimize TTFB
          controller.enqueue(buffer);
          buffer = "";
          firstChunkSent = true;
        } else if (buffer.length >= BUFFER_TARGET_SIZE) {
          // Buffer subsequent content into larger chunks for HTTP efficiency
          controller.enqueue(buffer);
          buffer = "";
        }
      },
      flush: (controller) => {
        if (buffer.length > 0) {
          controller.enqueue(buffer);
        }
      },
    });
  }
}

/**
 * Convert an array of tokens to HTML string
 * Optionally skip signal-definition tokens (for content-only HTML)
 */
export function tokensToHtml(tokens: Token[], skipSignalDefs = false): string {
  let html = "";
  for (const token of tokens) {
    if (skipSignalDefs && token.kind === "signal-definition") {
      continue;
    }
    html += serializeToken(token);
  }
  return html;
}

function serializeToken(token: Token): string {
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

function serializeAttributes(token: OpenTagToken): string {
  const attributeStrings = Object.entries(token.attributes).map(([key, value]) => {
    const attributeName = normalizeAttributeName(key);
    const valueString = value !== null ? `=${JSON.stringify(escapeAttribute(value))}` : "";
    return `${attributeName}${valueString}`;
  });
  return attributeStrings.join(" ");
}
