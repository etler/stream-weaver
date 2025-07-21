import { Node } from "@/ComponentConductor/types/Node";
import type { Element } from "./types/Element";

export function jsx(type: Element["type"], props: Element["props"]): Element {
  const { children, ...attributeProps } = props;
  return {
    type,
    props: attributeProps,
    children: [normalizeChild(children)].flat(),
  };
}

function normalizeChild(child: unknown): Node {
  if (child == null) {
    return null;
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

export { jsx as jsxs };
export { jsx as jsxDEV };
export { Fragment } from "./Fragment";
