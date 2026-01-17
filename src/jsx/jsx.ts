import { Node } from "./types/Node";
import type { Element } from "./types/Element";
import { Fragment } from "./Fragment";
import { isSignal } from "@/ComponentDelegate/signalDetection";

type UnknownRecord<T extends string = string> = Record<T, unknown>;

export function jsx(type: Element["type"], props: UnknownRecord): Element {
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
