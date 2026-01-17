import { DelegateStream } from "delegate-stream";
import { WeaverRegistry } from "@/registry";
import { SignalEvent, SignalToken } from "./types";
import { executeComputed } from "@/logic";
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
  constructor(registry: WeaverRegistry) {
    // Capture registry in closure for use in transform function
    const reg = registry;

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

            // Only computed signals auto-execute on dependency updates
            // Actions and handlers are manually invoked
            if (dependent?.kind === "computed") {
              // Create child delegate for recursive propagation
              const childDelegate = new SignalDelegate(reg);
              const childWriter = childDelegate.writable.getWriter();

              // Chain the child's readable stream
              chain(childDelegate.readable);

              // Execute computed and propagate asynchronously
              (async () => {
                // Execute the computed signal
                await executeComputed(reg, dependentId);

                // Get the computed result
                const result = reg.getValue(dependentId);

                // Emit a new signal-update event for the computed signal
                // This will recursively trigger updates for its dependents
                await childWriter.write({
                  kind: "signal-update",
                  id: dependentId,
                  value: result,
                });
                await childWriter.close();
              })().catch((error: unknown) => {
                console.error(new Error("Computed execution error", { cause: error }));
              });
            }
          }
        } else {
          // handler-execute event: Execute the handler
          const handler = reg.getSignal(event.id);
          if (handler?.kind !== "handler") {
            return;
          }

          // Create child delegate for propagating updates from handler execution
          const childDelegate = new SignalDelegate(reg);
          const childWriter = childDelegate.writable.getWriter();

          // Chain the child's readable stream
          chain(childDelegate.readable);

          // Execute handler and propagate updates asynchronously
          (async () => {
            // Execute the handler
            await executeHandler(reg, event.id, event.event);

            // After handler execution, emit signal-update events for each dependency
            // This triggers reactive propagation for any mutations the handler made
            for (const depId of handler.deps) {
              const value = reg.getValue(depId);
              await childWriter.write({
                kind: "signal-update",
                id: depId,
                value,
              });
            }
            await childWriter.close();
          })().catch((error: unknown) => {
            console.error(new Error("Handler execution error", { cause: error }));
          });
        }
      },
      finish: (chain) => {
        chain(null);
      },
    });
  }
}
