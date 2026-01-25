import { WeaverRegistry } from "@/registry/WeaverRegistry";
import { Sink } from "./Sink";
import { SignalDelegate } from "@/SignalDelegate/SignalDelegate";
import { SinkTransform } from "./SinkTransform";
import { SuspenseTransform } from "./SuspenseTransform";
import { setupEventDelegation } from "./setupEventDelegation";
import { AnySignal, ComputedSignal } from "@/signals/types";

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
 * Follows the same streaming pattern as StreamWeaver:
 *
 *   SignalDelegate → SuspenseTransform → SinkTransform → consume
 *
 * Flow:
 * 1. Receive signal definitions from <script>weaver.push(...)</script> tags
 * 2. Register signals in registry
 * 3. Pipe SignalDelegate through transforms to update DOM
 * 4. Setup event delegation to route events to SignalDelegate
 */
export class ClientWeaver {
  public registry: WeaverRegistry;
  public sink: Sink;
  public delegateWriter: WritableStreamDefaultWriter;
  private pendingSignals = new Set<string>();

  constructor() {
    this.registry = new WeaverRegistry();
    this.sink = new Sink();

    if (typeof document !== "undefined") {
      this.sink.scan(document.body);
    }

    // Initialize SignalDelegate
    const delegate = new SignalDelegate(this.registry);
    this.delegateWriter = delegate.writable.getWriter();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    delegate.setRootWriter(this.delegateWriter);

    // Pipe through transforms - same pattern as StreamWeaver
    delegate.readable
      .pipeThrough(new SuspenseTransform(this.registry, this.sink))
      .pipeThrough(new SinkTransform(this.registry, this.sink))
      .pipeTo(new WritableStream())
      .catch((error: unknown) => {
        console.error(new Error("Error in client stream pipeline", { cause: error }));
      });

    setupEventDelegation(this.delegateWriter);

    // Schedule initial signal execution after all push() calls
    if (typeof document !== "undefined") {
      setTimeout(() => {
        this.executePendingSignals();
      }, 0);
    }
  }

  /**
   * Register a signal definition from server HTML
   * Called by inline <script>weaver.push({...})</script> tags
   */
  public push(message: SignalDefinitionMessage): void {
    this.registry.registerSignal(message.signal);
    const { signal } = message;

    // Track signals that need initial execution
    if (signal.kind === "node") {
      this.pendingSignals.add(signal.id);
    }

    if (signal.kind === "computed") {
      const computed = signal as ComputedSignal;
      const logicSignal = this.registry.getSignal(computed.logic);
      if (logicSignal && "timeout" in logicSignal && logicSignal.timeout === 0) {
        this.pendingSignals.add(signal.id);
      }
    }

    if (signal.kind === "reducer") {
      this.pendingSignals.add(signal.id);

      // Register nested signals from reducer definition
      if (signal.sourceRef) {
        this.registry.registerSignal(signal.sourceRef);
        if (signal.sourceRef.kind === "computed" && "logicRef" in signal.sourceRef) {
          const computed = signal.sourceRef as ComputedSignal;
          if (computed.logicRef) {
            this.registry.registerSignal(computed.logicRef);
          }
        }
      }
      if (signal.reducerRef) {
        this.registry.registerSignal(signal.reducerRef);
      }
    }
  }

  /**
   * Execute signals that need initial execution
   */
  private executePendingSignals(): void {
    for (const signalId of this.pendingSignals) {
      const signal = this.registry.getSignal(signalId);
      if (!signal) {
        continue;
      }

      if (signal.kind === "node") {
        // Skip if already has SSR content
        if (this.sink.hasBindPoint(signalId) && !this.sink.hasContent(signalId)) {
          this.delegateWriter.write({ kind: "execute-signal", id: signalId }).catch(() => {});
        }
      } else if (signal.kind === "reducer") {
        this.delegateWriter.write({ kind: "execute-reducer", id: signalId }).catch(() => {});
      } else {
        this.delegateWriter.write({ kind: "execute-signal", id: signalId }).catch(() => {});
      }
    }
    this.pendingSignals.clear();
  }
}
