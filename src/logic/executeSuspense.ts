import { WeaverRegistry } from "@/registry";
import { SuspenseSignal } from "@/signals/types";
import { PENDING } from "@/signals/pending";
import { Token } from "@/ComponentDelegate/types/Token";
import { serializeTokenArray } from "@/ComponentSerializer/serialize";

export interface ExecuteSuspenseResult {
  showFallback: boolean;
  pendingDeps: string[];
  childrenHtml: string;
}

/**
 * Analyze children tokens for PENDING signals and prepare suspense result.
 * Updates suspense.pendingDeps and suspense._childrenHtml.
 */
export function executeSuspense(
  registry: WeaverRegistry,
  suspense: SuspenseSignal,
  childrenTokens: Token[],
): ExecuteSuspenseResult {
  // Extract signal IDs from children tokens
  const childSignalIds = new Set<string>();
  for (const token of childrenTokens) {
    if (token.kind === "signal-definition") {
      childSignalIds.add(token.signal.id);
    } else if (token.kind === "bind-marker-open") {
      childSignalIds.add(token.id);
    }
  }

  // Find PENDING signals
  const pendingDeps: string[] = [];
  for (const id of childSignalIds) {
    if (registry.getValue(id) === PENDING) {
      pendingDeps.push(id);
    }
  }

  // Pre-render children HTML for client-side swap
  const childrenHtml = serializeTokenArray(childrenTokens, true);

  // Update suspense signal
  suspense.pendingDeps = pendingDeps;
  // eslint-disable-next-line no-underscore-dangle
  suspense._childrenHtml = childrenHtml;

  return { showFallback: pendingDeps.length > 0, pendingDeps, childrenHtml };
}
