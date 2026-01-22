import { OpenTagToken, Token } from "@/ComponentDelegate/types/Token";
import { AnySignal } from "@/signals/types";

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
      return sanitizeText(token.content);
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
  }
}

function serializeSignalDefinition(signal: AnySignal): string {
  // Create a serializable version of the signal, filtering out non-serializable references
  const serializableSignal = { ...signal } as Record<string, unknown>;
  delete serializableSignal["logicRef"];
  delete serializableSignal["depsRef"];
  delete serializableSignal["_logicRef"];
  delete serializableSignal["_componentRef"];
  // Note: _childrenHtml is kept for Suspense client-side resolution
  const signalData = JSON.stringify({ kind: "signal-definition", signal: serializableSignal });
  return `<script>weaver.push(${signalData})</script>`;
}

function serializeAttributes(token: OpenTagToken): string {
  const attributeStrings = Object.entries(token.attributes).map(([key, value]) => {
    const attributeName = normalizeAttributeName(key);
    const valueString = value !== null ? `=${JSON.stringify(sanitizeAttribute(value))}` : "";
    return `${attributeName}${valueString}`;
  });
  return attributeStrings.join(" ");
}

// Convert JSX attribute names to HTML attribute names
function normalizeAttributeName(jsxName: string): string {
  switch (jsxName) {
    case "className":
      return "class";
    case "htmlFor":
      return "for";
    default:
      return jsxName;
  }
}

// Sanitize reserved characters with HTML entities
function sanitizeText(text: string): string {
  return text.replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

// Sanitize attribute reserved characters with HTML entities
function sanitizeAttribute(text: string): string {
  return text.replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;");
}

const selfClosingTags = [
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "param",
  "source",
  "track",
  "wbr",
];

function isSelfClosingTag(tag: string): boolean {
  return selfClosingTags.includes(tag);
}
