import { WeaverRegistry } from "@/registry/WeaverRegistry";
import { Sink } from "@/sink/Sink";
import { SignalDelegate } from "@/SignalDelegate/SignalDelegate";
import { setupEventDelegation } from "@/events/setupEventDelegation";
import { AnySignal } from "@/signals/types";
import { nodeToHtml } from "./nodeToHtml";
import { executeNode } from "@/logic/executeNode";
import type { Node } from "@/jsx/types/Node";

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

    // Connect SignalDelegate output to Sink for DOM updates
    this.consumeDelegateStream();

    // Setup global event delegation (pass writer to avoid locking stream twice)
    setupEventDelegation(this.delegateWriter);

    // Schedule initial NodeSignal execution after all push() calls
    if (typeof document !== "undefined") {
      // Use setTimeout to let all inline script push() calls complete
      setTimeout(() => {
        this.executePendingNodeSignals();
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
  }

  /**
   * Execute NodeSignals that have bind points but weren't rendered during SSR
   */
  private executePendingNodeSignals(): void {
    for (const nodeId of this.pendingNodeSignals) {
      // Check if this NodeSignal has a bind point in the DOM
      if (this.sink.hasBindPoint(nodeId)) {
        // Execute the NodeSignal and render it
        this.executeAndRenderNode(nodeId);
      }
    }
    this.pendingNodeSignals.clear();
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
      }
    })().catch((error: unknown) => {
      console.error(new Error("Error consuming delegate stream", { cause: error }));
    });
  }
}
