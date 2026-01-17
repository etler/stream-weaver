import { AnySignal } from "@/signals/types";

/**
 * WeaverRegistry
 *
 * Pure state store for signal definitions and their runtime values.
 * Each Weaver instance creates its own registry for isolation.
 *
 * The registry maintains:
 * - Signal definitions (metadata)
 * - Signal values (runtime state)
 * - Dependency graph (bidirectional relationships)
 */
export class WeaverRegistry {
  /**
   * Maps signal IDs to their definition objects
   */
  private signals: Map<string, AnySignal>;

  /**
   * Maps signal IDs to their current runtime values
   */
  private values: Map<string, unknown>;

  /**
   * Maps signal IDs to the set of signals that depend on them
   * Used for reactive propagation
   */
  private dependents: Map<string, Set<string>>;

  constructor() {
    this.signals = new Map();
    this.values = new Map();
    this.dependents = new Map();
  }

  /**
   * Registers a signal definition and stores its initial value
   * Also tracks dependency relationships for reactive propagation
   *
   * @param signal - Signal definition to register
   */
  registerSignal(signal: AnySignal): void {
    this.signals.set(signal.id, signal);

    // Store initial value for StateSignal
    if (signal.kind === "state") {
      this.values.set(signal.id, signal.init);
    }

    // Track dependency relationships for computed, action, handler, and node signals
    if (signal.kind === "computed" || signal.kind === "action" || signal.kind === "handler" || signal.kind === "node") {
      // Register this signal as a dependent of each of its dependencies
      for (const depId of signal.deps) {
        let dependentSet = this.dependents.get(depId);
        if (!dependentSet) {
          dependentSet = new Set();
          this.dependents.set(depId, dependentSet);
        }
        dependentSet.add(signal.id);
      }
    }
  }

  /**
   * Retrieves the current value of a signal
   *
   * @param id - Signal ID
   * @returns Current value stored in registry
   */
  getValue(id: string): unknown {
    return this.values.get(id);
  }

  /**
   * Sets the value of a signal directly
   * This is a direct mutation used by SignalDelegate when processing events
   *
   * @param id - Signal ID
   * @param value - New value to store
   */
  setValue(id: string, value: unknown): void {
    this.values.set(id, value);
  }

  /**
   * Retrieves a signal definition by ID
   *
   * @param id - Signal ID
   * @returns Signal definition object
   */
  getSignal(id: string): AnySignal | undefined {
    return this.signals.get(id);
  }

  /**
   * Gets the set of signals that depend on the given signal
   * Used for reactive propagation when a signal updates
   *
   * @param id - Signal ID
   * @returns Set of dependent signal IDs
   */
  getDependents(id: string): Set<string> {
    return this.dependents.get(id) ?? new Set();
  }

  /**
   * Gets the array of signals that the given signal depends on
   * Extracts dependencies from the signal definition
   *
   * @param id - Signal ID
   * @returns Array of dependency signal IDs
   */
  getDependencies(id: string): string[] {
    const signal = this.signals.get(id);
    if (
      signal &&
      (signal.kind === "computed" || signal.kind === "action" || signal.kind === "handler" || signal.kind === "node")
    ) {
      return signal.deps;
    }
    return [];
  }
}
