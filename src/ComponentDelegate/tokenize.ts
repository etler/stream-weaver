import { Fragment } from "@/jsx/Fragment";
import { ComponentElement, Element } from "@/jsx/types/Element";
import { Node } from "@/jsx/types/Node";
import { OpenTagToken, TokenOrExecutable, NodeExecutable, ComputedExecutable, SuspenseExecutable } from "./types/Token";
import { WeaverRegistry } from "@/registry/WeaverRegistry";
import { isSignal, isNodeSignal, isSuspenseSignal } from "@/signals/signalDetection";
import { isEventHandlerProp, eventPropToDataAttribute, propToDataAttribute } from "@/html/attributes";
import { LogicSignal, ComponentSignal, NodeSignal, ComputedSignal, SuspenseSignal } from "@/signals/types";
import { PENDING } from "@/signals/pending";

export function tokenize(node: Node, registry?: WeaverRegistry): (TokenOrExecutable | ComponentElement)[] {
  // Handle arrays of nodes (e.g., multiple children in Suspense)
  if (Array.isArray(node)) {
    return node.flatMap((child) => tokenize(child, registry));
  }

  // Don't display pending nodes
  if (node === PENDING) {
    return [];
  }

  // Check if node is a SuspenseSignal - emit executable for ComponentDelegate processing
  if (isSuspenseSignal(node)) {
    return handleSuspenseSignal(node, registry);
  }

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
    registry.registerIfAbsent(node);

    // Check for computed signals that need async execution during SSR
    if (node.kind === "computed") {
      const computed = node as ComputedSignal;
      const logicSignal = computed.logicRef;

      // Execute all contexts except client-only during SSR
      // - undefined (isomorphic): executes on both server and client
      // - "server": executes only on server (client uses RPC)
      // - "worker": executes in worker thread
      // - "client": skips on server, executes only on client
      const needsAsyncExec =
        logicSignal !== undefined && logicSignal.context !== "client" && registry.getValue(node.id) === undefined;

      if (needsAsyncExec) {
        // Register the logic signal
        registry.registerIfAbsent(logicSignal);
        // Return executable for async execution
        const executable: ComputedExecutable = {
          kind: "computed-executable",
          computed,
          logic: logicSignal,
        };
        return [
          { kind: "signal-definition", signal: logicSignal },
          { kind: "signal-definition", signal: node },
          { kind: "bind-marker-open", id: node.id },
          executable,
          { kind: "bind-marker-close", id: node.id },
        ];
      }
    }

    // Get the current value from the registry, or use init value for computed signals
    let value = registry.getValue(node.id);
    if (value === undefined && "init" in node) {
      // Check if this is a computed signal with deferred logic (timeout: 0)
      if (node.kind === "computed") {
        const computed = node as ComputedSignal;
        if (computed.logicRef?.timeout === 0) {
          // Deferred logic - value should be PENDING
          value = PENDING;
          registry.setValue(node.id, value);
        } else {
          value = node.init;
          registry.setValue(node.id, value);
        }
      } else {
        value = node.init;
        registry.setValue(node.id, value);
      }
    }

    // Collect any logic signal definitions that need to be emitted first
    const logicDefs: TokenOrExecutable[] = [];
    if ("logicRef" in node && isSignal(node.logicRef)) {
      // Register and emit the logic signal for computed/handler/action signals
      registry.registerIfAbsent(node.logicRef);
      logicDefs.push({ kind: "signal-definition", signal: node.logicRef });
    }

    // Emit: (logic-definition?) + signal-definition + bind-marker-open + content + bind-marker-close
    // For PENDING values, use empty string - the client will fill in the value when it resolves
    // eslint-disable-next-line @typescript-eslint/no-base-to-string
    const textContent = value === PENDING ? "" : String(value ?? "");
    return [
      ...logicDefs,
      { kind: "signal-definition", signal: node },
      { kind: "bind-marker-open", id: node.id },
      { kind: "text", content: textContent },
      { kind: "bind-marker-close", id: node.id },
    ];
  }

  if (node !== null && typeof node === "object" && "type" in node) {
    if (typeof node.type === "string") {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const { type, props, children } = node;

      // Collect signal definitions from props
      const signalDefinitions: TokenOrExecutable[] = [];
      if (typeof props === "object" && props !== null) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        for (const propValue of Object.values(props)) {
          if (isSignal(propValue)) {
            registry?.registerIfAbsent(propValue);

            // If this signal references a logic signal, emit that too
            if ("logicRef" in propValue && isSignal(propValue.logicRef)) {
              registry?.registerIfAbsent(propValue.logicRef);
              // Emit logic signal definition before the handler
              signalDefinitions.push({ kind: "signal-definition", signal: propValue.logicRef });
            }

            // If this signal has dependency references (handler/action), emit those too
            // This ensures MutatorSignals and other deps are available on the client
            if ("depsRef" in propValue && Array.isArray(propValue.depsRef)) {
              for (const dep of propValue.depsRef) {
                if (isSignal(dep)) {
                  registry?.registerIfAbsent(dep);
                  signalDefinitions.push({ kind: "signal-definition", signal: dep });
                }
              }
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

/** Emit SuspenseExecutable for ComponentDelegate to process */
function handleSuspenseSignal(
  suspense: SuspenseSignal,
  registry?: WeaverRegistry,
): (TokenOrExecutable | ComponentElement)[] {
  if (!registry) {
    return [];
  }

  // Register the suspense signal
  registry.registerIfAbsent(suspense);

  // Emit signal definition, bind markers, and executable (same pattern as handleNodeSignal)
  const executable: SuspenseExecutable = {
    kind: "suspense-executable",
    suspense,
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
    children: suspense.children as Node,
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
    fallback: suspense.fallback as Node,
  };
  return [
    { kind: "signal-definition", signal: suspense },
    { kind: "bind-marker-open", id: suspense.id },
    executable,
    { kind: "bind-marker-close", id: suspense.id },
  ];
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
  registry.registerIfAbsent(logicSignal);
  registry.registerIfAbsent(componentSignal);
  registry.registerIfAbsent(node);

  // Also register any signals in the node's props and set their values
  // Collect prop signal definitions to emit
  const propSignalDefs: TokenOrExecutable[] = [];
  for (const propValue of Object.values(node.props)) {
    if (isSignal(propValue)) {
      registry.registerIfAbsent(propValue);
      // Set the value from init if not already set (needed for executeNodeSignal proxy)
      if (registry.getValue(propValue.id) === undefined && "init" in propValue) {
        registry.setValue(propValue.id, propValue.init);
      }
      // Emit signal definition for prop signals so they're available on client
      propSignalDefs.push({ kind: "signal-definition", signal: propValue });
      // If this signal references a logic signal, register and emit that too
      if ("logicRef" in propValue && isSignal(propValue.logicRef)) {
        registry.registerIfAbsent(propValue.logicRef);
        propSignalDefs.push({ kind: "signal-definition", signal: propValue.logicRef });
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
    ...propSignalDefs,
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
    // Skip children, key, and ref - they're not HTML attributes
    if (key === "children" || key === "key" || key === "ref") {
      continue;
    }

    // Check if prop value is a signal
    if (isSignal(prop)) {
      if (!registry) {
        continue; // Skip signals without registry
      }

      // Register the signal if not already registered
      registry.registerIfAbsent(prop);

      // Handle event handlers (onClick, onInput, etc.)
      if (isEventHandlerProp(key)) {
        // Event handlers: only add data-w-* attribute with signal ID
        attributes[eventPropToDataAttribute(key)] = prop.id;
      } else {
        // Attribute bindings: add both current value AND data-w-* attribute
        const value = registry.getValue(prop.id);
        // For PENDING values, use empty string
        // eslint-disable-next-line @typescript-eslint/no-base-to-string
        attributes[key] = value === PENDING ? "" : String(value ?? "");
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
