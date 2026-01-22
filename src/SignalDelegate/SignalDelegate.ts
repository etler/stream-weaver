import { DelegateStream } from "delegate-stream";
import { WeaverRegistry } from "@/registry/WeaverRegistry";
import { SignalEvent, SignalToken } from "./types";
import { executeComputed, executeNode } from "@/logic";
import { executeHandler } from "@/logic/executeHandler";

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

    super({
      transform: (event, chain) => {
        if (event.kind === "signal-update") {
          // Update the registry with the new value
          reg.setValue(event.id, event.value);

          // Emit the update event as a token
          chain([event]);

          // Query dependent signals
          const dependents = reg.getDependents(event.id);

          // Execute each dependent computed signal and emit update events
          for (const dependentId of dependents) {
            const dependent = reg.getSignal(dependentId);

            // Computed and node signals auto-execute on dependency updates
            // Actions and handlers are manually invoked
            if (dependent?.kind === "computed") {
              // Create child delegate for recursive propagation
              const childDelegate = new SignalDelegate(reg, getRootWriter());
              const childWriter = childDelegate.writable.getWriter();

              // Chain the child's readable stream
              chain(childDelegate.readable);

              // Execute computed and propagate asynchronously
              (async () => {
                // Execute the computed signal
                const execResult = await executeComputed(reg, dependentId);

                // Emit a signal-update event for the immediate result
                // This will recursively trigger updates for its dependents
                await childWriter.write({
                  kind: "signal-update",
                  id: dependentId,
                  value: execResult.value,
                });
                await childWriter.close();

                // If execution was deferred, wait for completion and emit to root
                if (execResult.deferred) {
                  const deferredValue = await execResult.deferred;
                  const writer = getRootWriter();
                  if (writer) {
                    await writer.write({
                      kind: "signal-update",
                      id: dependentId,
                      value: deferredValue,
                    });
                  }
                }
              })().catch((error: unknown) => {
                console.error(new Error("Computed execution error", { cause: error }));
              });
            } else if (dependent?.kind === "node") {
              // Node signal - re-execute component and emit update with Node tree
              const childDelegate = new SignalDelegate(reg, getRootWriter());
              const childWriter = childDelegate.writable.getWriter();

              chain(childDelegate.readable);

              (async () => {
                // Execute the node signal to get updated Node tree
                const result = await executeNode(reg, dependentId);

                // Store the result in the registry
                reg.setValue(dependentId, result);

                // Emit a signal-update event with the Node tree
                // ClientWeaver will serialize this to HTML for DOM update
                await childWriter.write({
                  kind: "signal-update",
                  id: dependentId,
                  value: result,
                });
                await childWriter.close();
              })().catch((error: unknown) => {
                console.error(new Error("Node execution error", { cause: error }));
              });
            }
          }
        } else {
          // handler-execute event: Execute the handler
          const handler = reg.getSignal(event.id);
          if (handler?.kind !== "handler") {
            return;
          }

          // Check if this handler uses deferred logic (timeout: 0)
          const logicSignal = reg.getSignal(handler.logic);
          const isDeferred = logicSignal?.kind === "logic" && logicSignal.timeout === 0;

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
                  for (const depId of handler.deps) {
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
              for (const depId of handler.deps) {
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
