import type { Node } from "@/jsx/types/Node";
import type { Element } from "@/jsx/types/Element";
import type { AnySignal } from "@/signals/types";
import type { WeaverRegistry } from "@/registry/WeaverRegistry";
import { Fragment } from "@/jsx/Fragment";

/**
 * Check if a value is a signal (has id and kind properties)
 */
function isSignal(value: unknown): value is AnySignal {
  return typeof value === "object" && value !== null && "id" in value && "kind" in value;
}

/**
 * Register a signal and any nested signals it references
 * For handlers and nodes, this includes the logic signal
 */
function registerSignalWithDependencies(signal: AnySignal, registry: WeaverRegistry): void {
  // Register the signal itself
  if (!registry.getSignal(signal.id)) {
    registry.registerSignal(signal);
  }

  // For handlers, also register the logic signal if it's a reference
  if (signal.kind === "handler" && "logicRef" in signal) {
    const logicSignal = (signal as { logicRef?: AnySignal }).logicRef;
    if (logicSignal !== undefined && !registry.getSignal(logicSignal.id)) {
      registry.registerSignal(logicSignal);
    }
  }

  // For nodes, also register the logic signal if it's a reference
  if (signal.kind === "node" && "_logicRef" in signal) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
    const logicSignal = (signal as unknown as Record<string, AnySignal | undefined>)["_logicRef"];
    if (logicSignal !== undefined && !registry.getSignal(logicSignal.id)) {
      registry.registerSignal(logicSignal);
    }
  }
}

/**
 * Check if a prop name is an event handler (onClick, onInput, etc.)
 */
function isEventHandlerProp(key: string): boolean {
  if (!key.startsWith("on") || key.length <= 2) {
    return false;
  }
  const [, , thirdChar] = key;
  return thirdChar !== undefined && thirdChar === thirdChar.toUpperCase();
}

/**
 * Convert event prop name to data attribute (onClick -> data-w-onclick)
 */
function eventPropToDataAttribute(key: string): string {
  return `data-w-${key.toLowerCase()}`;
}

/**
 * Convert prop name to data attribute for bindings (className -> data-w-classname)
 */
function propToDataAttribute(key: string): string {
  return `data-w-${key.toLowerCase()}`;
}

/**
 * Serialize a Node tree to HTML string with signal handling
 * Registers signals with the registry and adds proper data-w-* attributes
 */
export function nodeToHtml(node: Node, registry?: WeaverRegistry): string {
  if (node === null || node === undefined) {
    return "";
  }

  if (typeof node === "string" || typeof node === "number") {
    return sanitizeText(String(node));
  }

  if (Array.isArray(node)) {
    return node.map((child) => nodeToHtml(child, registry)).join("");
  }

  // Check if it's a signal object (has id and kind)
  if (isSignal(node)) {
    // Register the signal and its dependencies if we have a registry
    if (registry) {
      registerSignalWithDependencies(node, registry);
    }

    // Get current value from registry or use init value
    let value: unknown;
    if (registry) {
      value = registry.getValue(node.id);
      if (value === undefined && "init" in node) {
        value = node.init;
        registry.setValue(node.id, value);
      }
    } else if ("init" in node) {
      value = node.init;
    }

    // Output bind markers with current value
    // eslint-disable-next-line @typescript-eslint/no-base-to-string
    const content = value !== undefined && value !== null ? sanitizeText(String(value)) : "";
    return `<!--^${node.id}-->${content}<!--/${node.id}-->`;
  }

  // Check if it's an Element
  if (isElement(node)) {
    return elementToHtml(node, registry);
  }

  return "";
}

function elementToHtml(element: Element, registry?: WeaverRegistry): string {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const { type, props, children } = element;

  // Fragment - just render children
  if (type === Fragment) {
    return children.map((child) => nodeToHtml(child, registry)).join("");
  }

  // Function component - not supported in client re-render
  if (typeof type === "function") {
    return "";
  }

  // HTML element
  const tag = type;
  const attributeString = propsToAttributes(props, registry);
  const separator = attributeString ? " " : "";
  const childrenHtml = children.map((child) => nodeToHtml(child, registry)).join("");

  if (isSelfClosingTag(tag)) {
    return `<${tag}${separator}${attributeString}/>`;
  }

  return `<${tag}${separator}${attributeString}>${childrenHtml}</${tag}>`;
}

function propsToAttributes(props: Element["props"], registry?: WeaverRegistry): string {
  if (props === null || props === undefined || typeof props !== "object") {
    return "";
  }

  const attributes: string[] = [];

  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
  for (const [key, value] of Object.entries(props)) {
    if (value === null || value === undefined) {
      continue;
    }

    // Check if prop value is a signal
    if (isSignal(value)) {
      // Register the signal and its dependencies if we have a registry
      if (registry) {
        registerSignalWithDependencies(value, registry);
      }

      // Handle event handlers (onClick, onInput, etc.)
      if (isEventHandlerProp(key)) {
        // Event handlers: only add data-w-* attribute with signal ID
        attributes.push(`${eventPropToDataAttribute(key)}="${value.id}"`);
      } else {
        // Attribute bindings: add both current value AND data-w-* attribute
        let attrValue: unknown;
        if (registry) {
          attrValue = registry.getValue(value.id);
          if (attrValue === undefined && "init" in value) {
            attrValue = value.init;
            registry.setValue(value.id, attrValue);
          }
        } else if ("init" in value) {
          attrValue = value.init;
        }

        const attributeName = normalizeAttributeName(key);
        // eslint-disable-next-line @typescript-eslint/no-base-to-string
        const attributeValue = attrValue !== undefined ? sanitizeAttribute(String(attrValue)) : "";
        attributes.push(`${attributeName}="${attributeValue}"`);
        attributes.push(`${propToDataAttribute(key)}="${value.id}"`);
      }
    } else {
      // Regular prop - normalize as usual
      const attributeName = normalizeAttributeName(key);
      // eslint-disable-next-line @typescript-eslint/no-base-to-string
      const attributeValue = sanitizeAttribute(String(value));
      attributes.push(`${attributeName}="${attributeValue}"`);
    }
  }

  return attributes.join(" ");
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

function sanitizeText(text: string): string {
  return text.replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function sanitizeAttribute(text: string): string {
  return text.replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;");
}

function isElement(node: unknown): node is Element {
  return typeof node === "object" && node !== null && "type" in node && "children" in node;
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
