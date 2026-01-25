import { DelegateStream } from "delegate-stream";
import { WeaverRegistry } from "@/registry/WeaverRegistry";
import { SignalEvent, SignalToken } from "./types";
import { executeComputed, executeNode } from "@/logic";
import { executeHandler } from "@/logic/executeHandler";
import { executeReducer } from "@/logic/executeReducer";

/**
 * SignalDelegate
 *
 * Reactive engine that propagates signal updates through the dependency graph.
 * Uses the DelegateStream pattern for parallel execution with sequential output.
 *
 * Flow:
 * 1. Receives signal-update event
 * 2. Updates registry value
 * 3. Queries dependent computed signals
 * 4. Executes each dependent (parallel)
 * 5. Emits new signal-update events (sequential)
 * 6. Cascades recursively through dependency graph
 */
export class SignalDelegate extends DelegateStream<SignalEvent, SignalToken> {
  private rootWriterRef?: WritableStreamDefaultWriter<SignalEvent>;

  /**
   * Set the root writer for deferred execution completions
   * Called after construction since we need the writer from our own writable
   */
  setRootWriter(writer: WritableStreamDefaultWriter<SignalEvent>): void {
    this.rootWriterRef = writer;
  }

  constructor(registry: WeaverRegistry, rootWriter?: WritableStreamDefaultWriter<SignalEvent>) {
    // Capture registry and rootWriter reference in closure for use in transform function
    const reg = registry;
    // Use a getter so child delegates can access the root writer set after construction
    const getRootWriter = () => rootWriter ?? this.rootWriterRef;

    type ChainFn = (input: Iterable<SignalToken> | AsyncIterable<SignalToken> | null) => void;

    // Helper: execute a signal and emit signal-update with result
    const executeAndEmit = (signalId: string, chain: ChainFn): void => {
      const signal = reg.getSignal(signalId);

      if (signal?.kind === "computed") {
        const childDelegate = new SignalDelegate(reg, getRootWriter());
        const childWriter = childDelegate.writable.getWriter();
        chain(childDelegate.readable);

        (async () => {
          const execResult = await executeComputed(reg, signalId);
          await childWriter.write({ kind: "signal-update", id: signalId, value: execResult.value });
          await childWriter.close();

          if (execResult.deferred) {
            const deferredValue = await execResult.deferred;
            const writer = getRootWriter();
            if (writer) {
              await writer.write({ kind: "signal-update", id: signalId, value: deferredValue });
            }
          }
        })().catch((error: unknown) => {
          console.error(new Error("Signal execution error", { cause: error }));
          childWriter.close().catch(() => {});
        });
      } else if (signal?.kind === "node") {
        const childDelegate = new SignalDelegate(reg, getRootWriter());
        const childWriter = childDelegate.writable.getWriter();
        chain(childDelegate.readable);

        (async () => {
          const result = await executeNode(reg, signalId);
          reg.setValue(signalId, result);
          await childWriter.write({ kind: "signal-update", id: signalId, value: result });
          await childWriter.close();
        })().catch((error: unknown) => {
          console.error(new Error("Signal execution error", { cause: error }));
          childWriter.close().catch(() => {});
        });
      }
    };

    super({
      transform: (event, chain) => {
        if (event.kind === "execute-signal") {
          // Execute a signal and emit its value (used by ComponentDelegate during SSR)
          executeAndEmit(event.id, chain);
        } else if (event.kind === "signal-update") {
          // Update the registry with the new value
          reg.setValue(event.id, event.value);

          // Emit the update event as a token
          chain([event]);

          // Execute each dependent computed/node signal
          for (const dependentId of reg.getDependents(event.id)) {
            const dependent = reg.getSignal(dependentId);
            if (dependent?.kind === "computed" || dependent?.kind === "node") {
              executeAndEmit(dependentId, chain);
            }
          }
        } else if (event.kind === "execute-reducer") {
          // Execute a reducer signal: execute source, then iterate and emit updates
          // Reducer updates go to the ROOT writer so they're processed immediately
          // without blocking - this is the key difference from other signal types
          const reducerSignal = reg.getSignal(event.id);
          if (reducerSignal?.kind !== "reducer") {
            return;
          }

          const rootWriter = getRootWriter();
          if (!rootWriter) {
            return;
          }

          // Guard to prevent infinite loop: SignalDelegate calls setValue when processing
          // signal-update events, which would trigger another write without this guard
          let isEmitting = false;

          (async () => {
            // Execute the source computed if it hasn't been executed yet
            const sourceSignal = reg.getSignal(reducerSignal.source);
            if (sourceSignal?.kind === "computed") {
              const result = await executeComputed(reg, reducerSignal.source);
              await rootWriter.write({ kind: "signal-update", id: reducerSignal.source, value: result.value });
            }

            // Now execute the reducer - it will call setValue for each iteration
            // We intercept those calls and write to ROOT (not a child delegate)
            const originalSetValue = reg.setValue.bind(reg);
            reg.setValue = (id: string, value: unknown) => {
              originalSetValue(id, value);
              if (id === event.id && !isEmitting) {
                isEmitting = true;
                rootWriter
                  .write({ kind: "signal-update", id, value })
                  .catch(() => {})
                  .finally(() => {
                    isEmitting = false;
                  });
              }
            };

            try {
              await executeReducer(reg, event.id);
            } finally {
              reg.setValue = originalSetValue;
            }
          })().catch((error: unknown) => {
            console.error(new Error("Reducer execution error", { cause: error }));
          });
        } else {
          // handler-execute event: Execute the handler
          const handler = reg.getSignal(event.id);
          if (handler?.kind !== "handler") {
            return;
          }

          // Check if this handler uses deferred logic (timeout: 0)
          const logicSignal = reg.getSignal(handler.logic);
          const isDeferred = logicSignal?.kind === "logic" && logicSignal.timeout === 0;

          // Helper to resolve mutator deps to their wrapped state signal IDs
          const resolveMutatorDeps = (deps: string[]): string[] => {
            return deps.map((depId) => {
              const dep = reg.getSignal(depId);
              if (dep?.kind === "mutator") {
                return dep.ref; // Return the wrapped state signal ID
              }
              return depId;
            });
          };

          if (isDeferred) {
            // Deferred execution: don't chain to parent, write to root when complete
            // This allows subsequent events to process without waiting
            (async () => {
              const result = await executeHandler(reg, event.id, event.event);

              if (result.deferred) {
                const writer = getRootWriter();
                if (writer) {
                  await result.deferred;
                  // Write signal-update events to root stream for deferred completion
                  // Resolve mutators to their wrapped state signals
                  for (const depId of resolveMutatorDeps(handler.deps)) {
                    const value = reg.getValue(depId);
                    await writer.write({
                      kind: "signal-update",
                      id: depId,
                      value,
                    });
                  }
                }
              }
            })().catch((error: unknown) => {
              console.error(new Error("Deferred handler execution error", { cause: error }));
            });
          } else {
            // Non-deferred (async or sync): chain to parent, blocks until complete
            const childDelegate = new SignalDelegate(reg, getRootWriter());
            const childWriter = childDelegate.writable.getWriter();

            // Chain the child's readable stream synchronously - this blocks subsequent output
            chain(childDelegate.readable);

            // Execute handler and emit updates asynchronously
            (async () => {
              await executeHandler(reg, event.id, event.event);

              // Emit signal-update events for each dependency
              // Resolve mutators to their wrapped state signals
              for (const depId of resolveMutatorDeps(handler.deps)) {
                const value = reg.getValue(depId);
                await childWriter.write({
                  kind: "signal-update",
                  id: depId,
                  value,
                });
              }

              // Close the child stream - this unblocks subsequent output
              await childWriter.close();
            })().catch((error: unknown) => {
              console.error(new Error("Handler execution error", { cause: error }));
            });
          }
        }
      },
      finish: (chain) => {
        chain(null);
      },
    });
  }
}
