import type { AnySignal } from "@/signals/types";

/**
 * Signal serialization for HTML embedding
 *
 * Single source of truth for converting signals to inline script tags.
 */

/**
 * Serialize a signal definition to an inline script tag.
 * The client's weaver.push() will register the signal on hydration.
 */
export function serializeSignalDefinition(signal: AnySignal): string {
  // Create a serializable copy without non-serializable references
  const serializableSignal = { ...signal } as Record<string, unknown>;
  // Remove keys that contain non-serializable references (functions, circular refs)
  delete serializableSignal["logicRef"];
  delete serializableSignal["depsRef"];
  delete serializableSignal["_logicRef"];
  delete serializableSignal["_componentRef"];
  // Note: _childrenHtml is kept for Suspense client-side resolution

  const signalData = JSON.stringify({ kind: "signal-definition", signal: serializableSignal });
  return `<script>weaver.push(${signalData})</script>`;
}
