import { Fragment } from "@/jsx/Fragment";
import { ComponentElement, Element } from "@/jsx/types/Element";
import { Node } from "@/jsx/types/Node";
import { OpenTagToken, Token, TokenOrExecutable, NodeExecutable } from "./types/Token";
import { WeaverRegistry } from "@/registry/WeaverRegistry";
import {
  isSignal,
  isEventHandlerProp,
  eventPropToDataAttribute,
  propToDataAttribute,
  isNodeSignal,
} from "./signalDetection";
import { LogicSignal, ComponentSignal, NodeSignal } from "@/signals/types";

export function tokenize(node: Node, registry?: WeaverRegistry): (TokenOrExecutable | ComponentElement)[] {
  // Check if node is a NodeSignal - needs special handling for component execution
  if (isNodeSignal(node)) {
    return handleNodeSignal(node, registry);
  }

  // Check if node is a signal object (but not a NodeSignal)
  if (isSignal(node)) {
    if (!registry) {
      // No registry - can't serialize signal, skip it
      return [];
    }

    // Register the signal if not already registered
    if (!registry.getSignal(node.id)) {
      registry.registerSignal(node);
    }

    // Get the current value from the registry, or use init value for computed signals
    let value = registry.getValue(node.id);
    if (value === undefined && "init" in node) {
      value = node.init;
      // Also set the init value in the registry for consistency
      registry.setValue(node.id, value);
    }

    // Collect any logic signal definitions that need to be emitted first
    const logicDefs: Token[] = [];
    if ("logicRef" in node && isSignal(node.logicRef)) {
      // Register and emit the logic signal for computed/handler/action signals
      if (!registry.getSignal(node.logicRef.id)) {
        registry.registerSignal(node.logicRef);
      }
      logicDefs.push({ kind: "signal-definition", signal: node.logicRef });
    }

    // Emit: (logic-definition?) + signal-definition + bind-marker-open + content + bind-marker-close
    return [
      ...logicDefs,
      { kind: "signal-definition", signal: node },
      { kind: "bind-marker-open", id: node.id },
      // eslint-disable-next-line @typescript-eslint/no-base-to-string
      { kind: "text", content: String(value ?? "") },
      { kind: "bind-marker-close", id: node.id },
    ];
  }

  if (node !== null && typeof node === "object" && "type" in node) {
    if (typeof node.type === "string") {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const { type, props, children } = node;

      // Collect signal definitions from props
      const signalDefinitions: Token[] = [];
      if (typeof props === "object" && props !== null) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        for (const propValue of Object.values(props)) {
          if (isSignal(propValue)) {
            if (registry && !registry.getSignal(propValue.id)) {
              registry.registerSignal(propValue);
            }

            // If this signal references a logic signal, emit that too
            if ("logicRef" in propValue && isSignal(propValue.logicRef)) {
              // Register the logic signal
              if (registry && !registry.getSignal(propValue.logicRef.id)) {
                registry.registerSignal(propValue.logicRef);
              }
              // Emit logic signal definition before the handler
              signalDefinitions.push({ kind: "signal-definition", signal: propValue.logicRef });
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
      // Function component - return as ComponentElement for async processing
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

/**
 * Handle NodeSignal - emit signal definitions and return executable for component execution
 */
function handleNodeSignal(node: NodeSignal, registry?: WeaverRegistry): (TokenOrExecutable | ComponentElement)[] {
  if (!registry) {
    return [];
  }

  // Get signals from runtime references (preferred) or registry (fallback)
  // eslint-disable-next-line no-underscore-dangle
  let componentSignal = node._componentRef;
  // eslint-disable-next-line no-underscore-dangle
  let logicSignal = node._logicRef;

  // Fallback to registry if runtime references not available
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
  componentSignal ??= registry.getSignal(node.component) as ComponentSignal | undefined;

  if (!logicSignal) {
    // Try to get from ComponentSignal first
    if (componentSignal && typeof componentSignal.logic === "object") {
      logicSignal = componentSignal.logic;
    } else {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
      logicSignal = registry.getSignal(node.logic) as LogicSignal | undefined;
    }
  }

  if (!componentSignal || !logicSignal) {
    console.warn(`NodeSignal ${node.id} is missing component or logic signal`);
    return [];
  }

  // Register all signals if not already registered
  if (!registry.getSignal(logicSignal.id)) {
    registry.registerSignal(logicSignal);
  }
  if (!registry.getSignal(componentSignal.id)) {
    registry.registerSignal(componentSignal);
  }
  if (!registry.getSignal(node.id)) {
    registry.registerSignal(node);
  }

  // Also register any signals in the node's props
  for (const propValue of Object.values(node.props)) {
    if (isSignal(propValue)) {
      if (!registry.getSignal(propValue.id)) {
        registry.registerSignal(propValue);
      }
      // If this signal references a logic signal, register that too
      if ("logicRef" in propValue && isSignal(propValue.logicRef)) {
        if (!registry.getSignal(propValue.logicRef.id)) {
          registry.registerSignal(propValue.logicRef);
        }
      }
    }
  }

  // Emit signal definitions, bind markers, and the executable
  // The ComponentDelegate will:
  // 1. Emit the signal definitions
  // 2. Emit bind-marker-open
  // 3. Execute the component and process its output
  // 4. Emit bind-marker-close
  const executable: NodeExecutable = {
    kind: "node-executable",
    node,
    logic: logicSignal,
    component: componentSignal,
  };

  return [
    { kind: "signal-definition", signal: logicSignal },
    { kind: "signal-definition", signal: componentSignal },
    { kind: "signal-definition", signal: node },
    { kind: "bind-marker-open", id: node.id },
    executable,
    { kind: "bind-marker-close", id: node.id },
  ];
}

function propsToAttributes(props: Element["props"], registry?: WeaverRegistry): OpenTagToken["attributes"] {
  if (typeof props !== "object" || props === null) {
    return {};
  }

  const attributes: Record<string, string | null> = {};

  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
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
