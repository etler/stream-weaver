import { Fragment } from "@/ComponentConductor/Fragment";
import { ComponentElement, Element } from "@/ComponentConductor/types/Element";
import { Node } from "@/ComponentConductor/types/Node";
import { OpenTagToken, Token } from "@/ComponentConductor/types/Token";

export function tokenize(node: Node): (Token | ComponentElement)[] {
  if (node !== null && typeof node === "object" && "type" in node) {
    const { type, props, children } = node;
    if (typeof type === "string") {
      return [
        { kind: "open", tag: type, attributes: propsToAttributes(props) },
        ...children.flatMap(tokenize),
        { kind: "close", tag: type },
      ];
    } else if (type === Fragment) {
      return [...children.flatMap(tokenize)];
    }
    {
      return [{ type, props, children }];
    }
  }
  switch (typeof node) {
    // Serializable
    case "string":
    case "number":
      return [{ kind: "text", content: String(node) }];
    default:
      return [];
  }
}

function propsToAttributes(props: Element["props"]): OpenTagToken["attributes"] {
  return Object.fromEntries(
    Object.entries(props).flatMap<[string, string | null]>(([key, prop]) => {
      try {
        const attribute = normalizeAttribute(prop);
        return [[key, attribute]];
      } catch {
        console.error(`Warning: Invalid value for prop ${key}`);
        return [];
      }
    }),
  );
}

function normalizeAttribute(prop: unknown): OpenTagToken["attributes"][string] {
  if (prop == null) {
    return null;
  }
  switch (typeof prop) {
    case "string":
    case "number":
    case "bigint":
    case "boolean":
    case "object":
      // Disabled to match spec renderer behavior
      // eslint-disable-next-line @typescript-eslint/no-base-to-string
      return prop === "" ? null : String(prop);
    default:
      throw new Error("Warning: Invalid value for prop");
  }
}
