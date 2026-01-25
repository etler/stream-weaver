import { WeaverRegistry } from "@/registry/WeaverRegistry";
import { SignalToken } from "@/SignalDelegate/types";
import { SuspenseSignal } from "@/signals/types";
import { renderNode } from "@/html";
import { executeNode } from "@/logic/executeNode";
import type { Node } from "@/jsx/types/Node";
import { PENDING } from "@/signals/pending";
import { Sink } from "./Sink";

/**
 * SuspenseTransform
 *
 * Handles client-side suspense boundary management.
 * Tracks which signals are pending inside suspense boundaries and
 * swaps between fallback and children content as signals resolve.
 *
 * Flow:
 * - When signal becomes PENDING: find parent suspense, show fallback
 * - When signal resolves: remove from pendingDeps, if all resolved show children
 */
export class SuspenseTransform extends TransformStream<SignalToken, SignalToken> {
  constructor(registry: WeaverRegistry, sink: Sink) {
    // Map: signal ID → set of suspense IDs waiting on that signal
    const suspenseWaiters = new Map<string, Set<string>>();

    const addWaiter = (signalId: string, suspenseId: string): void => {
      let waiters = suspenseWaiters.get(signalId);
      if (!waiters) {
        waiters = new Set();
        suspenseWaiters.set(signalId, waiters);
      }
      waiters.add(suspenseId);
    };

    const checkResolution = (resolvedId: string): void => {
      const waitingSuspenses = suspenseWaiters.get(resolvedId);
      if (!waitingSuspenses) {
        return;
      }

      for (const suspenseId of waitingSuspenses) {
        const signal = registry.getSignal(suspenseId);
        if (signal?.kind !== "suspense") {
          continue;
        }

        const suspense = signal;
        const idx = suspense.pendingDeps.indexOf(resolvedId);
        if (idx !== -1) {
          suspense.pendingDeps.splice(idx, 1);
        }

        if (suspense.pendingDeps.length === 0) {
          resolveSuspense(suspenseId, suspense);
        }
      }

      suspenseWaiters.delete(resolvedId);
    };

    const checkPending = (pendingId: string): void => {
      const allSignals = registry.getAllSignals();
      for (const [signalId, signal] of allSignals) {
        if (signal.kind !== "suspense") {
          continue;
        }

        if (!sink.hasBindPoint(signalId) || !sink.hasBindPoint(pendingId)) {
          continue;
        }
        if (!sink.isDescendant(pendingId, signalId)) {
          continue;
        }

        const suspense = signal;
        if (!suspense.pendingDeps.includes(pendingId)) {
          suspense.pendingDeps.push(pendingId);
          addWaiter(pendingId, signalId);

          if (suspense.pendingDeps.length === 1) {
            showFallback(signalId, suspense);
          }
        }
      }
    };

    const showFallback = (suspenseId: string, suspense: SuspenseSignal): void => {
      const { fallback } = suspense;

      // Check if fallback is a NodeSignal that needs execution
      if (
        fallback !== null &&
        typeof fallback === "object" &&
        "kind" in fallback &&
        // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
        (fallback as { kind: string }).kind === "node"
      ) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
        const nodeSignal = fallback as { id: string; kind: "node" };
        (async () => {
          const result = await executeNode(registry, nodeSignal.id);
          registry.setValue(nodeSignal.id, result);
          const html = renderNode(result, { registry }) ?? "";
          sink.sync(suspenseId, html);
        })().catch((error: unknown) => {
          console.error(new Error("Failed to execute fallback NodeSignal", { cause: error }));
        });
        return;
      }

      // Otherwise render directly
      // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
      const html = renderNode(fallback as Node, { registry }) ?? "";
      sink.sync(suspenseId, html);
    };

    const resolveSuspense = (suspenseId: string, suspense: SuspenseSignal): void => {
      // Use pre-rendered children HTML from SSR if available
      // eslint-disable-next-line no-underscore-dangle, @typescript-eslint/strict-boolean-expressions
      if (suspense._childrenHtml) {
        // eslint-disable-next-line no-underscore-dangle
        sink.sync(suspenseId, suspense._childrenHtml);

        // Sync resolved signal values into the new HTML
        const allSignals = registry.getAllSignals();
        for (const [signalId, signal] of allSignals) {
          if (signal.kind === "computed" && sink.hasBindPoint(signalId)) {
            const value = registry.getValue(signalId);
            if (value !== undefined && value !== PENDING) {
              // eslint-disable-next-line @typescript-eslint/no-base-to-string
              sink.sync(signalId, String(value ?? ""));
            }
          }
        }
        return;
      }

      // Fallback: render children directly
      // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
      const children = suspense.children as Node;
      const html = renderNode(children, { registry }) ?? "";
      sink.sync(suspenseId, html);
    };

    super({
      transform: (event, controller) => {
        const value = registry.getValue(event.id);

        if (value === PENDING) {
          checkPending(event.id);
        } else {
          checkResolution(event.id);
        }

        // Pass through for downstream transforms
        controller.enqueue(event);
      },
    });

    // Initialize waiters from SSR-provided pendingDeps
    // This runs once when the transform is created
    if (typeof document !== "undefined") {
      setTimeout(() => {
        const allSignals = registry.getAllSignals();
        for (const [, signal] of allSignals) {
          if (signal.kind === "suspense") {
            for (const pendingId of signal.pendingDeps) {
              addWaiter(pendingId, signal.id);
            }
          }
        }
      }, 0);
    }
  }
}
