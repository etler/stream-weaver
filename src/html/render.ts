/**
 * Unified HTML rendering utilities
 *
 * Shared logic for converting JSX elements to HTML strings.
 * Used by both client-side (nodeToHtml) and server-side (serializeElement) rendering.
 */

import type { Node } from "@/jsx/types/Node";
import type { Element } from "@/jsx/types/Element";
import type { AnySignal } from "@/signals/types";
import type { WeaverRegistry } from "@/registry/WeaverRegistry";
import { Fragment } from "@/jsx/Fragment";
import { PENDING } from "@/signals/pending";
import { isSignal } from "@/signals/signalDetection";
import { escapeText, escapeAttribute } from "./escaping";
import { isSelfClosingTag } from "./tags";
import {
  normalizeAttributeName,
  isEventHandlerProp,
  eventPropToDataAttribute,
  propToDataAttribute,
} from "./attributes";
import { serializeSignalDefinition } from "./signals";

/**
 * Options for HTML rendering
 */
export interface RenderOptions {
  /** Registry for signal value lookup and registration */
  registry?: WeaverRegistry;
  /** Whether to emit signal definitions as inline scripts (server-side) */
  emitSignalDefinitions?: boolean;
  /** Return null if async content is encountered (server fast-path) */
  rejectAsync?: boolean;
  /** Custom async check - return true if node requires async processing */
  asyncCheck?: (node: AnySignal) => boolean;
}

/**
 * Result of attribute rendering
 */
export interface AttributeRenderResult {
  /** The rendered attribute string */
  attributes: string;
  /** Signal definition scripts to emit before the element */
  signalDefs: string;
}

/**
 * Register a signal and its dependencies (logicRef, depsRef) in the registry
 */
export function registerSignalWithDeps(signal: AnySignal, registry: WeaverRegistry): void {
  registry.registerIfAbsent(signal);

  // Register logicRef for computed/handler/action/node signals
  if ("logicRef" in signal && isSignal(signal.logicRef)) {
    registry.registerIfAbsent(signal.logicRef);
  }

  // Register _logicRef for node signals (using in operator for type narrowing)
  if ("_logicRef" in signal) {
    const logicRef = signal["_logicRef" as keyof typeof signal];
    if (isSignal(logicRef)) {
      registry.registerIfAbsent(logicRef);
    }
  }

  // Register depsRef for handler/action signals
  if ("depsRef" in signal && Array.isArray(signal.depsRef)) {
    for (const dep of signal.depsRef) {
      if (isSignal(dep)) {
        registry.registerIfAbsent(dep);
      }
    }
  }
}

/**
 * Get a signal's current value, falling back to init if not set
 */
export function resolveSignalValue(signal: AnySignal, registry?: WeaverRegistry): unknown {
  if (!registry) {
    return "init" in signal ? signal.init : undefined;
  }

  let value = registry.getValue(signal.id);
  if (value === undefined && "init" in signal) {
    value = signal.init;
    registry.setValue(signal.id, value);
  }
  return value;
}

/**
 * Render element props to an HTML attribute string
 */
export function renderAttributes(props: Element["props"], options: RenderOptions = {}): AttributeRenderResult {
  const { registry, emitSignalDefinitions = false } = options;
  const parts: string[] = [];
  let signalDefs = "";

  if (props === null || props === undefined || typeof props !== "object") {
    return { attributes: "", signalDefs: "" };
  }

  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
  for (const [key, value] of Object.entries(props)) {
    // Skip internal props
    if (key === "children" || key === "key" || key === "ref") {
      continue;
    }

    // Handle signal props
    if (isSignal(value)) {
      if (!registry) {
        continue;
      }

      // Register signal and dependencies
      registerSignalWithDeps(value, registry);

      // Emit signal definitions if requested
      if (emitSignalDefinitions) {
        if ("logicRef" in value && isSignal(value.logicRef)) {
          signalDefs += serializeSignalDefinition(value.logicRef);
        }
        if ("depsRef" in value && Array.isArray(value.depsRef)) {
          for (const dep of value.depsRef) {
            if (isSignal(dep)) {
              signalDefs += serializeSignalDefinition(dep);
            }
          }
        }
        signalDefs += serializeSignalDefinition(value);
      }

      // Event handlers: only data attribute
      if (isEventHandlerProp(key)) {
        parts.push(`${eventPropToDataAttribute(key)}="${escapeAttribute(value.id)}"`);
      } else {
        // Attribute binding: value + data attribute
        const attrValue = resolveSignalValue(value, registry);
        const attrName = normalizeAttributeName(key);
        // eslint-disable-next-line @typescript-eslint/no-base-to-string
        const escapedValue = attrValue !== undefined && attrValue !== PENDING ? escapeAttribute(String(attrValue)) : "";
        parts.push(`${attrName}="${escapedValue}"`);
        parts.push(`${propToDataAttribute(key)}="${escapeAttribute(value.id)}"`);
      }
      continue;
    }

    // Skip null/undefined/false
    if (value === null || value === undefined || value === false) {
      continue;
    }

    // Boolean true: boolean attribute
    if (value === true) {
      parts.push(normalizeAttributeName(key));
      continue;
    }

    // String/number: regular attribute
    if (typeof value === "string" || typeof value === "number") {
      parts.push(`${normalizeAttributeName(key)}="${escapeAttribute(String(value))}"`);
      continue;
    }

    // Skip functions (non-signal event handlers)
    if (typeof value === "function") {
      continue;
    }
  }

  return { attributes: parts.join(" "), signalDefs };
}

/**
 * Render a Node tree to HTML string
 *
 * @param node - The node to render
 * @param options - Rendering options
 * @returns HTML string, or null if rejectAsync is true and async content is found
 */
export function renderNode(node: Node, options: RenderOptions = {}): string | null {
  // Null/undefined/boolean
  if (node === null || node === undefined || typeof node === "boolean") {
    return "";
  }

  // PENDING
  if (node === PENDING) {
    return "";
  }

  // Array
  if (Array.isArray(node)) {
    let html = "";
    for (const child of node) {
      const childHtml = renderNode(child, options);
      if (childHtml === null) {
        return null;
      }
      html += childHtml;
    }
    return html;
  }

  // Primitives
  if (typeof node === "string") {
    return escapeText(node);
  }
  if (typeof node === "number") {
    return String(node);
  }

  // Signal
  if (isSignal(node)) {
    return renderSignalNode(node, options);
  }

  // Element
  if (typeof node === "object" && "type" in node) {
    return renderElement(node as Element, options);
  }

  return "";
}

/**
 * Render an Element to HTML string
 */
function renderElement(element: Element, options: RenderOptions): string | null {
  const { rejectAsync = false } = options;
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const { type, props, children } = element;

  // Function component - async content
  if (typeof type === "function") {
    return rejectAsync ? null : "";
  }

  // Fragment
  if (type === Fragment) {
    return renderChildren(children, options);
  }

  // HTML element
  const tag = type;
  const attrResult = renderAttributes(props, options);

  let html = attrResult.signalDefs;
  html += `<${tag}`;
  if (attrResult.attributes) {
    html += ` ${attrResult.attributes}`;
  }

  if (isSelfClosingTag(tag)) {
    html += "/>";
    return html;
  }

  html += ">";

  const childrenHtml = renderChildren(children, options);
  if (childrenHtml === null) {
    return null;
  }
  html += childrenHtml;
  html += `</${tag}>`;

  return html;
}

/**
 * Render children array to HTML string
 */
function renderChildren(children: Node[], options: RenderOptions): string | null {
  let html = "";
  for (const child of children) {
    const childHtml = renderNode(child, options);
    if (childHtml === null) {
      return null;
    }
    html += childHtml;
  }
  return html;
}

/**
 * Render a signal node to HTML with bind markers
 */
function renderSignalNode(signal: AnySignal, options: RenderOptions): string | null {
  const { registry, emitSignalDefinitions = false, rejectAsync = false, asyncCheck } = options;

  if (!registry) {
    return "";
  }

  // Register signal and dependencies
  registerSignalWithDeps(signal, registry);

  // Check for async signals that need special handling
  const needsAsync = asyncCheck !== undefined ? asyncCheck(signal) : false;
  if (rejectAsync && needsAsync) {
    return null;
  }

  // Suspense and Node signals always need async path on server
  if (rejectAsync && (signal.kind === "suspense" || signal.kind === "node")) {
    return null;
  }

  // Get value
  const value = resolveSignalValue(signal, registry);

  let html = "";

  // Emit signal definitions
  if (emitSignalDefinitions) {
    if ("logicRef" in signal && isSignal(signal.logicRef)) {
      registry.registerIfAbsent(signal.logicRef);
      html += serializeSignalDefinition(signal.logicRef);
    }
    if ("depsRef" in signal && Array.isArray(signal.depsRef)) {
      for (const dep of signal.depsRef) {
        if (isSignal(dep)) {
          registry.registerIfAbsent(dep);
          html += serializeSignalDefinition(dep);
        }
      }
    }
    html += serializeSignalDefinition(signal);
  }

  // Bind markers and content
  html += `<!--^${signal.id}-->`;
  // eslint-disable-next-line @typescript-eslint/no-base-to-string
  html += value !== undefined && value !== null && value !== PENDING ? escapeText(String(value)) : "";
  html += `<!--/${signal.id}-->`;

  return html;
}
