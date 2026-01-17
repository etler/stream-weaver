import { Node } from "./types/Node";
import type { Element } from "./types/Element";
import { Fragment } from "./Fragment";
import { isSignal, isComponentSignal } from "@/ComponentDelegate/signalDetection";
import { createNode } from "@/signals/createNode";
import type { ComponentSignal, NodeSignal } from "@/signals/types";

type UnknownRecord<T extends string = string> = Record<T, unknown>;

// Function overloads for proper return type inference
export function jsx(type: ComponentSignal, props: UnknownRecord): NodeSignal;
export function jsx(type: Element["type"], props: UnknownRecord): Element;
export function jsx(type: Element["type"] | ComponentSignal, props: UnknownRecord): Element | NodeSignal;
export function jsx(type: Element["type"] | ComponentSignal, props: UnknownRecord): Element | NodeSignal {
  // Handle ComponentSignals - create a NodeSignal instance
  if (isComponentSignal(type)) {
    const { children, ...nodeProps } = props;
    // If there are children, add them to props
    if (children !== undefined) {
      nodeProps["children"] = normalizeChild(children);
    }
    return createNode(type, nodeProps);
  }

  if (type === Fragment) {
    const { children } = props;
    return {
      type,
      props: undefined,
      children: [normalizeChild(children)].flat(),
    };
  } else if (typeof type === "string") {
    const { children, ...attributeProps } = props;
    return {
      type,
      props: attributeProps,
      children: [normalizeChild(children)].flat(),
    };
  } else {
    // Function component
    return {
      type,
      props,
      children: [],
    };
  }
}

function normalizeChild(child: unknown): Node {
  if (child == null) {
    return null;
  }
  if (isElement(child)) {
    return child;
  }
  if (isSignal(child)) {
    return child;
  }
  if (Array.isArray(child)) {
    return child.map(normalizeChild);
  }
  switch (typeof child) {
    case "string":
    case "number":
      return String(child);
    default:
      throw new Error("Error: Invalid value for child");
  }
}

function isElement(node: unknown): node is Element {
  if (isUnknownRecord<"type" | "props">(node)) {
    const { type, props } = node;
    if (typeof type === "function" && isUnknownRecord(props)) {
      return true;
    }
  }
  if (isUnknownRecord<"type" | "props" | "children">(node)) {
    const { type, props, children } = node;
    if ((typeof type === "string" || type === Fragment) && isUnknownRecord(props) && Array.isArray(children)) {
      return true;
    }
  }
  return false;
}

function isUnknownRecord<T extends string = string>(node: unknown): node is UnknownRecord<T> {
  return typeof node === "object" && node !== null;
}
