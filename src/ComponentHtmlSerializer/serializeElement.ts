/**
 * Direct HTML serialization - bypasses Token objects entirely
 * Used by the fast path for static content
 */

import {
  isSignal,
  isEventHandlerProp,
  eventPropToDataAttribute,
  propToDataAttribute,
} from "@/ComponentDelegate/signalDetection";
import { Node } from "@/jsx/types/Node";
import { Fragment } from "@/jsx/jsx-runtime";
import { WeaverRegistry } from "@/registry/WeaverRegistry";
import { AnySignal } from "@/signals/types";

// Self-closing tag check using switch (faster than Set.has for small fixed sets)
function isSelfClosingTag(tag: string): boolean {
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

/**
 * Directly serialize a JSX element tree to HTML string
 * Returns null if the tree contains async content (function components)
 */
export function serializeElement(node: Node, registry?: WeaverRegistry): string | null {
  // Null/undefined/boolean - skip
  if (node === null || node === undefined || typeof node === "boolean") {
    return "";
  }

  // String - escape and return
  if (typeof node === "string") {
    return escapeText(node);
  }

  // Number - convert to string
  if (typeof node === "number") {
    return String(node);
  }

  // Signal - serialize with bind markers
  if (isSignal(node)) {
    return serializeSignalNode(node, registry);
  }

  // Element
  if (typeof node === "object" && "type" in node) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const { type, props, children } = node;

    // Function component - can't use fast path
    if (typeof type === "function") {
      return null;
    }

    // Fragment - just serialize children
    if (type === Fragment) {
      return serializeChildren(children, registry);
    }

    // Regular HTML element
    const tag = type;
    const isSelfClosing = isSelfClosingTag(tag);

    // Start with any signal definitions from attributes
    let html = "";

    // Serialize attributes
    // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
    if (props && typeof props === "object") {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
      const attrResult = serializeAttributes(props as Record<string, unknown>, registry);
      if (attrResult === null) {
        return null; // Props contain something that requires async path
      }

      // Emit signal definitions before the element
      html += attrResult.signalDefs;

      // Build opening tag
      html += `<${tag}`;
      if (attrResult.attributes) {
        html += ` ${attrResult.attributes}`;
      }
    } else {
      html += `<${tag}`;
    }

    if (isSelfClosing) {
      html += "/>";
      return html;
    }

    html += ">";

    // Serialize children
    const childrenHtml = serializeChildren(children, registry);
    if (childrenHtml === null) {
      return null; // Children contain async content
    }
    html += childrenHtml;

    // Close tag
    html += `</${tag}>`;

    return html;
  }

  // Unknown node type - skip
  return "";
}

function serializeChildren(children: Node[], registry?: WeaverRegistry): string | null {
  let html = "";
  for (const child of children) {
    const childHtml = serializeElement(child, registry);
    if (childHtml === null) {
      return null; // Child contains async content
    }
    html += childHtml;
  }
  return html;
}

interface AttributeResult {
  attributes: string;
  signalDefs: string;
}

function serializeAttributes(props: Record<string, unknown>, registry?: WeaverRegistry): AttributeResult | null {
  const parts: string[] = [];
  let signalDefs = "";

  // Use for...in instead of Object.entries() to avoid array allocation
  for (const key in props) {
    // Skip children and internal props
    if (key === "children" || key === "key" || key === "ref") {
      continue;
    }

    const value = props[key];

    // Handle signal values in attributes
    if (isSignal(value)) {
      if (!registry) {
        continue;
      }

      // Type assertion - we know value is AnySignal after isSignal check
      const signal = value;

      // Register the signal
      if (!registry.getSignal(signal.id)) {
        registry.registerSignal(signal);
      }

      // Handle logic signal reference
      if ("logicRef" in signal && isSignal(signal.logicRef)) {
        const logicSignal = signal.logicRef as AnySignal;
        if (!registry.getSignal(logicSignal.id)) {
          registry.registerSignal(logicSignal);
        }
        signalDefs += serializeSignalDefinition(logicSignal);
      }

      signalDefs += serializeSignalDefinition(signal);

      // Handle event handlers (onClick, onInput, etc.)
      if (isEventHandlerProp(key)) {
        // Event handlers: only add data-w-* attribute with signal ID
        const dataAttr = eventPropToDataAttribute(key);
        parts.push(`${dataAttr}="${escapeAttribute(signal.id)}"`);
      } else {
        // Attribute bindings: add both current value AND data-w-* attribute
        const currentValue = registry.getValue(signal.id) ?? ("init" in signal ? signal.init : "");
        const attrName = normalizeAttributeName(key);
        parts.push(`${attrName}="${escapeAttribute(String(currentValue))}"`);
        const dataAttr = propToDataAttribute(key);
        parts.push(`${dataAttr}="${escapeAttribute(signal.id)}"`);
      }
      continue;
    }

    // Skip null/undefined/false attributes
    if (value === null || value === undefined || value === false) {
      continue;
    }

    // Boolean true - render as boolean attribute
    if (value === true) {
      const attrName = normalizeAttributeName(key);
      parts.push(attrName);
      continue;
    }

    // String/number - render normally
    if (typeof value === "string" || typeof value === "number") {
      const attrName = normalizeAttributeName(key);
      parts.push(`${attrName}="${escapeAttribute(String(value))}"`);
      continue;
    }

    // Function - skip (event handlers without signals)
    if (typeof value === "function") {
      continue;
    }
  }

  return { attributes: parts.join(" "), signalDefs };
}

function serializeSignalNode(signal: AnySignal, registry?: WeaverRegistry): string | null {
  if (!registry) {
    return "";
  }

  // Register the signal
  if (!registry.getSignal(signal.id)) {
    registry.registerSignal(signal);
  }

  // Get current value
  let value = registry.getValue(signal.id);
  if (value === undefined && "init" in signal) {
    value = signal.init;
    registry.setValue(signal.id, value);
  }

  let html = "";

  // Emit logic signal definition if present
  if ("logicRef" in signal && isSignal(signal.logicRef)) {
    const logicSignal = signal.logicRef as AnySignal;
    if (!registry.getSignal(logicSignal.id)) {
      registry.registerSignal(logicSignal);
    }
    html += serializeSignalDefinition(logicSignal);
  }

  // Emit signal definition
  html += serializeSignalDefinition(signal);

  // Emit bind markers and content
  html += `<!--^${signal.id}-->`;
  // eslint-disable-next-line @typescript-eslint/no-base-to-string
  html += escapeText(String(value ?? ""));
  html += `<!--/${signal.id}-->`;

  return html;
}

function serializeSignalDefinition(signal: AnySignal): string {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { logicRef, ...serializableSignal } = signal as AnySignal & { logicRef?: unknown };
  const signalData = JSON.stringify({ kind: "signal-definition", signal: serializableSignal });
  return `<script>weaver.push(${signalData})</script>`;
}

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

// Optimized single-pass escape functions (inspired by SolidJS)
const TEXT_ESCAPE_RE = /[&<>]/g;
const TEXT_ESCAPE_MAP: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;" };

const ATTR_ESCAPE_RE = /[&<>"']/g;
const ATTR_ESCAPE_MAP: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&apos;",
};

function escapeText(text: string): string {
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  return text.replace(TEXT_ESCAPE_RE, (char) => TEXT_ESCAPE_MAP[char]!);
}

function escapeAttribute(text: string): string {
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  return text.replace(ATTR_ESCAPE_RE, (char) => ATTR_ESCAPE_MAP[char]!);
}
