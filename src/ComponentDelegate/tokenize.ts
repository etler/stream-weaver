import { Fragment } from "@/jsx/Fragment";
import { ComponentElement, Element } from "@/jsx/types/Element";
import { Node } from "@/jsx/types/Node";
import { OpenTagToken, TokenOrExecutable, NodeExecutable, ComputedExecutable, SuspenseExecutable } from "./types/Token";
import { WeaverRegistry } from "@/registry/WeaverRegistry";
import {
  isSignal,
  isEventHandlerProp,
  eventPropToDataAttribute,
  propToDataAttribute,
  isNodeSignal,
  isSuspenseSignal,
} from "./signalDetection";
import { LogicSignal, ComponentSignal, NodeSignal, ComputedSignal, SuspenseSignal } from "@/signals/types";
import { PENDING } from "@/signals/pending";

/**
 * Internal node type for resolved Suspense boundaries
 * Created by executeSuspenseSignal after determining fallback vs children
 */
export interface SuspenseResolutionNode {
  __suspenseResolution: true;
  suspenseId: string;
  showFallback: boolean;
  fallback: Node;
  // Pre-collected tokens from children processing
  childrenTokens: TokenOrExecutable[];
  // The suspense signal (for emitting signal-definition after _childrenHtml is set)
  suspenseSignal: SuspenseSignal;
}

export function isSuspenseResolutionNode(node: unknown): node is SuspenseResolutionNode {
  return typeof node === "object" && node !== null && "__suspenseResolution" in node;
}

export function tokenize(node: Node, registry?: WeaverRegistry): (TokenOrExecutable | ComponentElement)[] {
  // Handle arrays of nodes (e.g., multiple children in Suspense)
  if (Array.isArray(node)) {
    return node.flatMap((child) => tokenize(child, registry));
  }

  // Don't display pending nodes
  if (node === PENDING) {
    return [];
  }

  // Check for SuspenseResolutionNode (result of suspense execution)
  if (isSuspenseResolutionNode(node)) {
    // Extract signal-definition tokens from children (needed for client-side tracking)
    const childSignalDefs = node.childrenTokens.filter((token): token is TokenOrExecutable => {
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      return typeof token === "object" && token !== null && "kind" in token && token.kind === "signal-definition";
    });

    // Emit the suspense signal-definition HERE, after _childrenHtml has been set by executeSuspenseSignal
    const suspenseSignalDef: TokenOrExecutable = { kind: "signal-definition", signal: node.suspenseSignal };

    if (node.showFallback) {
      // Show fallback, but emit children's signal definitions first
      // This allows the client to track the pending signals and swap later
      return [
        ...childSignalDefs,
        suspenseSignalDef,
        { kind: "bind-marker-open", id: node.suspenseId },
        ...tokenize(node.fallback, registry),
        { kind: "bind-marker-close", id: node.suspenseId },
      ];
    } else {
      // Show children - use pre-collected tokens
      return [
        suspenseSignalDef,
        { kind: "bind-marker-open", id: node.suspenseId },
        ...node.childrenTokens,
        { kind: "bind-marker-close", id: node.suspenseId },
      ];
    }
  }

  // Check if node is a SuspenseSignal - needs special handling for fallback/children
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
    if (!registry.getSignal(node.id)) {
      registry.registerSignal(node);
    }

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
        if (!registry.getSignal(logicSignal.id)) {
          registry.registerSignal(logicSignal);
        }
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
      if (!registry.getSignal(node.logicRef.id)) {
        registry.registerSignal(node.logicRef);
      }
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
 * Handle SuspenseSignal - show fallback while children contain PENDING signals
 */
function handleSuspenseSignal(
  suspense: SuspenseSignal,
  registry?: WeaverRegistry,
): (TokenOrExecutable | ComponentElement)[] {
  if (!registry) {
    return [];
  }

  // Register the suspense signal
  if (!registry.getSignal(suspense.id)) {
    registry.registerSignal(suspense);
  }

  // Tokenize children FIRST - this renders any function components and registers signals
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
  const childrenTokens = tokenize(suspense.children as Node, registry);

  // Check if children contain function components (ComponentElements)
  // These need to be executed by ComponentDelegate before we can check for PENDING
  const hasComponentElements = childrenTokens.some(
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    (token) => typeof token === "object" && token !== null && "type" in token && typeof token.type === "function",
  );

  if (hasComponentElements) {
    // Children have function components - defer to ComponentDelegate for execution
    // Note: signal-definition is NOT emitted here - it will be emitted when processing
    // SuspenseResolutionNode after _childrenHtml has been set by executeSuspenseSignal
    const executable: SuspenseExecutable = {
      kind: "suspense-executable",
      suspense,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
      children: suspense.children as Node,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
      fallback: suspense.fallback as Node,
    };
    return [executable];
  }

  // No function components - we can check for PENDING signals directly
  const childSignalIds = new Set<string>();
  for (const token of childrenTokens) {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (typeof token === "object" && token !== null && "kind" in token) {
      if (token.kind === "signal-definition") {
        childSignalIds.add(token.signal.id);
      } else if (token.kind === "bind-marker-open") {
        childSignalIds.add(token.id);
      }
    }
  }

  // Check which of these signals have PENDING values
  const pendingSignals: string[] = [];
  for (const id of childSignalIds) {
    if (registry.getValue(id) === PENDING) {
      pendingSignals.push(id);
    }
  }

  // Update the suspense signal's pending deps
  suspense.pendingDeps = pendingSignals;

  if (pendingSignals.length > 0) {
    // Show fallback
    return [
      { kind: "signal-definition", signal: suspense },
      { kind: "bind-marker-open", id: suspense.id },
      // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
      ...tokenize(suspense.fallback as Node, registry),
      { kind: "bind-marker-close", id: suspense.id },
    ];
  } else {
    // Show children (already tokenized)
    return [
      { kind: "signal-definition", signal: suspense },
      { kind: "bind-marker-open", id: suspense.id },
      ...childrenTokens,
      { kind: "bind-marker-close", id: suspense.id },
    ];
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

  // Also register any signals in the node's props and set their values
  // Collect prop signal definitions to emit
  const propSignalDefs: TokenOrExecutable[] = [];
  for (const propValue of Object.values(node.props)) {
    if (isSignal(propValue)) {
      if (!registry.getSignal(propValue.id)) {
        registry.registerSignal(propValue);
      }
      // Set the value from init if not already set (needed for executeNodeSignal proxy)
      if (registry.getValue(propValue.id) === undefined && "init" in propValue) {
        registry.setValue(propValue.id, propValue.init);
      }
      // Emit signal definition for prop signals so they're available on client
      propSignalDefs.push({ kind: "signal-definition", signal: propValue });
      // If this signal references a logic signal, register and emit that too
      if ("logicRef" in propValue && isSignal(propValue.logicRef)) {
        if (!registry.getSignal(propValue.logicRef.id)) {
          registry.registerSignal(propValue.logicRef);
        }
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
