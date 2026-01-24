/**
 * Direct HTML serialization - bypasses Token objects entirely
 * Used by the fast path for static content
 */

import { isSignal } from "@/ComponentDelegate/signalDetection";
import { isSuspenseResolutionNode } from "@/ComponentDelegate/tokenize";
import { Node } from "@/jsx/types/Node";
import { WeaverRegistry } from "@/registry/WeaverRegistry";
import { ComputedSignal, AnySignal } from "@/signals/types";
import { renderNode, type RenderOptions } from "@/html";

/**
 * Check if a signal requires async processing (server fast-path rejection)
 */
function requiresAsyncProcessing(signal: AnySignal, registry: WeaverRegistry): boolean {
  // Suspense and Node signals always need streaming path
  if (signal.kind === "suspense" || signal.kind === "node") {
    return true;
  }

  // Computed signals with server/worker context or deferred execution need async
  if (signal.kind === "computed") {
    const computed = signal as ComputedSignal;
    const logicSignal = computed.logicRef;

    // Server/worker context computed signals need async execution
    if (
      (logicSignal?.context === "server" || logicSignal?.context === "worker") &&
      registry.getValue(signal.id) === undefined
    ) {
      return true;
    }

    // Deferred computed signals (timeout: 0) need streaming for Suspense detection
    if (logicSignal?.timeout === 0) {
      return true;
    }
  }

  return false;
}

/**
 * Directly serialize a JSX element tree to HTML string
 * Returns null if the tree contains async content (function components)
 */
export function serializeElement(node: Node, registry?: WeaverRegistry): string | null {
  // SuspenseResolutionNode requires tokenize handling
  if (isSuspenseResolutionNode(node)) {
    return null;
  }

  // Check for signals that need async handling
  if (isSignal(node) && registry && requiresAsyncProcessing(node, registry)) {
    return null;
  }

  const options: RenderOptions = {
    registry,
    emitSignalDefinitions: true,
    rejectAsync: true,
    asyncCheck: registry ? (signal) => requiresAsyncProcessing(signal, registry) : undefined,
  };

  return renderNode(node, options);
}
