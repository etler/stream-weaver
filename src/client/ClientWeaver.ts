import { WeaverRegistry } from "@/registry/WeaverRegistry";
import { Sink } from "@/sink/Sink";
import { SignalDelegate } from "@/SignalDelegate/SignalDelegate";
import { setupEventDelegation } from "@/events/setupEventDelegation";
import { AnySignal, SuspenseSignal, ComputedSignal } from "@/signals/types";
import { nodeToHtml } from "./nodeToHtml";
import { executeNode } from "@/logic/executeNode";
import { executeComputed } from "@/logic/executeComputed";
import type { Node } from "@/jsx/types/Node";
import { PENDING } from "@/signals/pending";

/**
 * Signal definition message format from server HTML
 */
interface SignalDefinitionMessage {
  kind: "signal-definition";
  signal: AnySignal;
}

/**
 * ClientWeaver
 *
 * Client-side orchestrator that hydrates server-rendered HTML and makes it interactive.
 * Initializes from inline signal definitions and sets up the reactive flow.
 *
 * Flow:
 * 1. Parse signal definitions from <script>weaver.push(...)</script> tags
 * 2. Register signals in registry
 * 3. Scan DOM for bind markers with Sink
 * 4. Initialize SignalDelegate for reactive updates
 * 5. Connect SignalDelegate output to Sink for DOM updates
 * 6. Setup event delegation to route events to SignalDelegate
 * 7. Execute any NodeSignals that weren't rendered during SSR
 */
export class ClientWeaver {
  public registry: WeaverRegistry;
  public sink: Sink;
  private delegate: SignalDelegate;
  public delegateWriter: WritableStreamDefaultWriter;
  private pendingNodeSignals = new Set<string>();
  // Computed signals with deferred logic that need execution
  private pendingDeferredComputed = new Set<string>();
  // Map: signal ID -> set of suspense IDs waiting on that signal
  private suspenseWaiters = new Map<string, Set<string>>();

  constructor() {
    // Initialize registry
    this.registry = new WeaverRegistry();

    // Initialize Sink and scan for bind markers in DOM
    this.sink = new Sink();
    if (typeof document !== "undefined") {
      this.sink.scan(document.body);
    }

    // Initialize SignalDelegate for reactive updates
    this.delegate = new SignalDelegate(this.registry);
    this.delegateWriter = this.delegate.writable.getWriter();
    // Set root writer for deferred execution completions
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    this.delegate.setRootWriter(this.delegateWriter);

    // Connect SignalDelegate output to Sink for DOM updates
    this.consumeDelegateStream();

    // Setup global event delegation (pass writer to avoid locking stream twice)
    setupEventDelegation(this.delegateWriter);

    // Schedule initial signal execution after all push() calls
    if (typeof document !== "undefined") {
      // Use setTimeout to let all inline script push() calls complete
      setTimeout(() => {
        this.executePendingNodeSignals();
        this.executePendingDeferredComputed();
      }, 0);
    }
  }

  /**
   * Register a signal definition from server HTML
   * Called by inline <script>weaver.push({...})</script> tags
   */
  public push(message: SignalDefinitionMessage): void {
    // Only signal-definition messages supported for now
    this.registry.registerSignal(message.signal);

    // Track NodeSignals that need to be executed on initial load
    if (message.signal.kind === "node") {
      this.pendingNodeSignals.add(message.signal.id);
    }

    // Track computed signals with deferred logic (timeout: 0)
    if (message.signal.kind === "computed") {
      const computed = message.signal as ComputedSignal;
      const logicSignal = this.registry.getSignal(computed.logic);
      if (logicSignal && "timeout" in logicSignal && logicSignal.timeout === 0) {
        this.pendingDeferredComputed.add(message.signal.id);
      }
    }

    // Track SuspenseSignals and their pending dependencies
    if (message.signal.kind === "suspense") {
      const suspense = message.signal;
      for (const pendingId of suspense.pendingDeps) {
        let waiters = this.suspenseWaiters.get(pendingId);
        if (!waiters) {
          waiters = new Set();
          this.suspenseWaiters.set(pendingId, waiters);
        }
        waiters.add(suspense.id);
      }
    }
  }

  /**
   * Execute NodeSignals that have bind points but weren't rendered during SSR
   */
  private executePendingNodeSignals(): void {
    for (const nodeId of this.pendingNodeSignals) {
      // Check if this NodeSignal has a bind point in the DOM
      if (this.sink.hasBindPoint(nodeId)) {
        // Skip if content was already rendered by SSR
        // This is a key optimization: don't reload component modules for SSR-rendered content
        if (this.sink.hasContent(nodeId)) {
          continue;
        }
        // Execute the NodeSignal and render it
        this.executeAndRenderNode(nodeId);
      }
    }
    this.pendingNodeSignals.clear();
  }

  /**
   * Execute pending computed signals with deferred logic
   */
  private executePendingDeferredComputed(): void {
    for (const computedId of this.pendingDeferredComputed) {
      this.executeAndUpdateComputed(computedId);
    }
    this.pendingDeferredComputed.clear();
  }

  /**
   * Execute a computed signal with deferred logic and trigger updates
   */
  private executeAndUpdateComputed(computedId: string): void {
    (async () => {
      // Execute the computed signal
      await executeComputed(this.registry, computedId);

      // Get the result
      const value = this.registry.getValue(computedId);

      // Emit signal-update to trigger DOM updates and suspense resolution
      await this.delegateWriter.write({ kind: "signal-update", id: computedId, value });
    })().catch((error: unknown) => {
      console.error(new Error(`Failed to execute deferred computed ${computedId}`, { cause: error }));
    });
  }

  /**
   * Execute a NodeSignal and render its output to the DOM
   */
  private executeAndRenderNode(nodeId: string): void {
    (async () => {
      // Execute the node to get its output
      const result = await executeNode(this.registry, nodeId);

      // Store the result
      this.registry.setValue(nodeId, result);

      // Render to HTML with signal registration
      const html = nodeToHtml(result, this.registry);

      // Update the DOM (sync already rescans for new bind points)
      this.sink.sync(nodeId, html);
    })().catch((error: unknown) => {
      console.error(new Error(`Failed to execute NodeSignal ${nodeId}`, { cause: error }));
    });
  }

  /**
   * Consume SignalDelegate output stream and update DOM via Sink
   */
  private consumeDelegateStream(): void {
    (async () => {
      const reader = this.delegate.readable.getReader();
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }

        // When SignalDelegate emits signal-update, sync to DOM
        // Get the signal definition to check its type
        const signal = this.registry.getSignal(value.id);
        const currentValue = this.registry.getValue(value.id);

        // NodeSignals have Node values that need to be serialized to HTML
        if (signal?.kind === "node") {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
          const html = nodeToHtml(currentValue as Node, this.registry);
          // sync already rescans for new bind points
          this.sink.sync(value.id, html);
        } else {
          // Primitive values - convert to string
          // eslint-disable-next-line @typescript-eslint/no-base-to-string
          this.sink.sync(value.id, String(currentValue ?? ""));
        }

        // Check if this signal resolving affects any suspense boundaries
        if (currentValue !== PENDING) {
          this.checkSuspenseResolution(value.id);
        }
      }
    })().catch((error: unknown) => {
      console.error(new Error("Error consuming delegate stream", { cause: error }));
    });
  }

  /**
   * Check if a signal resolving causes any suspense boundaries to resolve
   */
  private checkSuspenseResolution(resolvedId: string): void {
    const waitingSuspenses = this.suspenseWaiters.get(resolvedId);
    if (!waitingSuspenses) {
      return;
    }

    for (const suspenseId of waitingSuspenses) {
      const signal = this.registry.getSignal(suspenseId);
      if (signal?.kind !== "suspense") {
        continue;
      }
      const suspense = signal;

      // Remove this signal from the suspense's pending deps
      const idx = suspense.pendingDeps.indexOf(resolvedId);
      if (idx !== -1) {
        suspense.pendingDeps.splice(idx, 1);
      }

      // If all deps resolved, render the children
      if (suspense.pendingDeps.length === 0) {
        this.resolveSuspense(suspenseId, suspense);
      }
    }

    // Clean up the waiters map
    this.suspenseWaiters.delete(resolvedId);
  }

  /**
   * Resolve a suspense boundary by rendering its children
   */
  private resolveSuspense(suspenseId: string, suspense: SuspenseSignal): void {
    // Use pre-rendered children HTML from SSR if available
    // eslint-disable-next-line no-underscore-dangle, @typescript-eslint/strict-boolean-expressions
    if (suspense._childrenHtml) {
      // eslint-disable-next-line no-underscore-dangle
      this.sink.sync(suspenseId, suspense._childrenHtml);

      // After swapping in children HTML, sync the resolved signal values
      // The pre-rendered HTML has empty bind markers that need to be filled
      // Get all signals that were pending and sync their current values
      const allSignals = this.registry.getAllSignals();
      for (const [signalId, signal] of allSignals) {
        // Only sync computed signals that have bind points in the new HTML
        if (signal.kind === "computed" && this.sink.hasBindPoint(signalId)) {
          const value = this.registry.getValue(signalId);
          if (value !== undefined && value !== PENDING) {
            // eslint-disable-next-line @typescript-eslint/no-base-to-string
            this.sink.sync(signalId, String(value ?? ""));
          }
        }
      }
      return;
    }

    // Fallback: try to render children (may not work if type was lost in serialization)
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
    const children = suspense.children as Node;
    const html = nodeToHtml(children, this.registry);
    this.sink.sync(suspenseId, html);
  }
}
