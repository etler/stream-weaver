import { OpenTagToken, Token } from "@/ComponentDelegate/types/Token";
import { AnySignal } from "@/signals/types";

export class ComponentSerializer extends TransformStream<Token, string> {
  constructor() {
    super({
      transform: (token, controller) => {
        controller.enqueue(serializeToken(token));
      },
    });
  }
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
  // Create a serializable version of the signal
  const signalData = JSON.stringify({ kind: "signal-definition", signal });
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
