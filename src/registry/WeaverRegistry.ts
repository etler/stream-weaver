import { AnySignal } from "@/signals/types";

/**
 * WeaverRegistry
 *
 * Pure state store for signal definitions and their runtime values.
 * Each Weaver instance creates its own registry for isolation.
 *
 * The registry maintains two separate maps:
 * - Signal definitions (metadata)
 * - Signal values (runtime state)
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

  constructor() {
    this.signals = new Map();
    this.values = new Map();
  }

  /**
   * Registers a signal definition and stores its initial value
   *
   * @param signal - Signal definition to register
   */
  registerSignal(signal: AnySignal): void {
    this.signals.set(signal.id, signal);

    // Store initial value for StateSignal
    // Note: In M1, AnySignal only includes StateSignal
    // In M2+, this will need conditional logic for other signal types
    this.values.set(signal.id, signal.init);
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
}
