import { WeaverRegistry } from "@/registry/WeaverRegistry";
import { Sink } from "@/sink/Sink";
import { SignalDelegate } from "@/SignalDelegate/SignalDelegate";
import { setupEventDelegation } from "@/events/setupEventDelegation";
import { AnySignal } from "@/signals/types";

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
 */
export class ClientWeaver {
  public registry: WeaverRegistry;
  public sink: Sink;
  private delegate: SignalDelegate;
  public delegateWriter: WritableStreamDefaultWriter;

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
  }

  /**
   * Register a signal definition from server HTML
   * Called by inline <script>weaver.push({...})</script> tags
   */
  public push(message: SignalDefinitionMessage): void {
    // Only signal-definition messages supported for now
    this.registry.registerSignal(message.signal);
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
        // Get the current value from registry
        const currentValue = this.registry.getValue(value.id);

        // Update DOM with Sink
        // eslint-disable-next-line @typescript-eslint/no-base-to-string
        this.sink.sync(value.id, String(currentValue ?? ""));
      }
    })().catch((error: unknown) => {
      console.error(new Error("Error consuming delegate stream", { cause: error }));
    });
  }
}
