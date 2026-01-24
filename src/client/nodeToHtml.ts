import type { Node } from "@/jsx/types/Node";
import type { Element } from "@/jsx/types/Element";
import type { AnySignal } from "@/signals/types";
import type { WeaverRegistry } from "@/registry/WeaverRegistry";
import { Fragment } from "@/jsx/Fragment";
import { PENDING } from "@/signals/pending";
import {
  isSignal,
  isEventHandlerProp,
  eventPropToDataAttribute,
  propToDataAttribute,
} from "@/ComponentDelegate/signalDetection";

/**
 * Register a signal and any nested signals it references
 * For handlers/actions, this includes the logic signal and depsRef signals (MutatorSignals, etc.)
 * For nodes, this includes the logic signal
 */
function registerSignalWithDependencies(signal: AnySignal, registry: WeaverRegistry): void {
  // Register the signal itself
  if (!registry.getSignal(signal.id)) {
    registry.registerSignal(signal);
  }

  // For handlers/actions, also register the logic signal and depsRef signals
  if ((signal.kind === "handler" || signal.kind === "action") && "logicRef" in signal) {
    const logicSignal = (signal as { logicRef?: AnySignal }).logicRef;
    if (logicSignal !== undefined && !registry.getSignal(logicSignal.id)) {
      registry.registerSignal(logicSignal);
    }
  }

  // Register depsRef signals (MutatorSignals, etc.) for handlers/actions
  if ((signal.kind === "handler" || signal.kind === "action") && "depsRef" in signal) {
    const { depsRef } = signal as { depsRef?: AnySignal[] };
    if (Array.isArray(depsRef)) {
      for (const depSignal of depsRef) {
        if (!registry.getSignal(depSignal.id)) {
          registry.registerSignal(depSignal);
        }
      }
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
    // For PENDING values, use empty string - the client will fill in the value when it resolves
    // eslint-disable-next-line @typescript-eslint/no-base-to-string
    const content = value !== undefined && value !== null && value !== PENDING ? sanitizeText(String(value)) : "";
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
    // Skip children, key, and ref - they're not HTML attributes
    if (key === "children" || key === "key" || key === "ref") {
      continue;
    }

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
        // For PENDING values, use empty string
        const attributeValue =
          // eslint-disable-next-line @typescript-eslint/no-base-to-string
          attrValue !== undefined && attrValue !== PENDING ? sanitizeAttribute(String(attrValue)) : "";
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
