import { Fragment } from "@/jsx/Fragment";
import { ComponentElement, Element } from "@/jsx/types/Element";
import { Node } from "@/jsx/types/Node";
import { OpenTagToken, Token } from "./types/Token";
import { WeaverRegistry } from "@/registry";
import { isSignal, isEventHandlerProp, eventPropToDataAttribute, propToDataAttribute } from "./signalDetection";

export function tokenize(node: Node, registry?: WeaverRegistry): (Token | ComponentElement)[] {
  // Check if node is a signal object
  if (isSignal(node)) {
    if (!registry) {
      // No registry - can't serialize signal, skip it
      return [];
    }

    // Register the signal if not already registered
    if (!registry.getSignal(node.id)) {
      registry.registerSignal(node);
    }

    // Get the current value from the registry
    const value = registry.getValue(node.id);

    // Emit: signal-definition + bind-marker-open + content + bind-marker-close
    return [
      { kind: "signal-definition", signal: node },
      { kind: "bind-marker-open", id: node.id },
      // eslint-disable-next-line @typescript-eslint/no-base-to-string
      { kind: "text", content: String(value ?? "") },
      { kind: "bind-marker-close", id: node.id },
    ];
  }

  if (node !== null && typeof node === "object" && "type" in node) {
    if (typeof node.type === "string") {
      const { type, props, children } = node;

      // Collect signal definitions from props
      const signalDefinitions: Token[] = [];
      if (typeof props === "object" && props !== null) {
        for (const propValue of Object.values(props)) {
          if (isSignal(propValue)) {
            if (registry && !registry.getSignal(propValue.id)) {
              registry.registerSignal(propValue);
            }
            signalDefinitions.push({ kind: "signal-definition", signal: propValue });
          }
        }
      }

      return [
        ...signalDefinitions,
        { kind: "open", tag: type, attributes: propsToAttributes(props, registry) },
        ...children.flatMap((child) => tokenize(child, registry)),
        { kind: "close", tag: type },
      ];
    } else if (node.type === Fragment) {
      const { children } = node;
      return [...children.flatMap((child) => tokenize(child, registry))];
    } else {
      return [node];
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

function propsToAttributes(props: Element["props"], registry?: WeaverRegistry): OpenTagToken["attributes"] {
  if (typeof props !== "object" || props === null) {
    return {};
  }

  const attributes: Record<string, string | null> = {};

  for (const [key, prop] of Object.entries(props)) {
    // Check if prop value is a signal
    if (isSignal(prop)) {
      if (!registry) {
        continue; // Skip signals without registry
      }

      // Register the signal if not already registered
      if (!registry.getSignal(prop.id)) {
        registry.registerSignal(prop);
      }

      // Handle event handlers (onClick, onInput, etc.)
      if (isEventHandlerProp(key)) {
        // Event handlers: only add data-w-* attribute with signal ID
        attributes[eventPropToDataAttribute(key)] = prop.id;
      } else {
        // Attribute bindings: add both current value AND data-w-* attribute
        const value = registry.getValue(prop.id);
        // eslint-disable-next-line @typescript-eslint/no-base-to-string
        attributes[key] = String(value ?? "");
        attributes[propToDataAttribute(key)] = prop.id;
      }
    } else {
      // Regular prop - normalize as usual
      try {
        const attribute = normalizeAttribute(prop);
        attributes[key] = attribute;
      } catch {
        console.error(`Warning: Invalid value for prop ${key}`);
      }
    }
  }

  return attributes;
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
