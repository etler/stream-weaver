/**
 * Example 1: Simple Counter
 * Demonstrates basic state signals and event handlers
 */
import { createSignal, createHandler, createLogic } from "../../src/signals";
import type { WeaverRegistry } from "../../src/registry/WeaverRegistry";

// Define the component
export function Counter(): JSX.Element {
  // Create a state signal for the count
  const count = createSignal(0);

  // Create logic signals for the handlers
  // Use absolute paths from the demo root so Vite can resolve them correctly
  const incrementLogic = createLogic("/logic/increment.js");
  const decrementLogic = createLogic("/logic/decrement.js");

  // Create handlers for increment/decrement
  const increment = createHandler(incrementLogic, [count]);
  const decrement = createHandler(decrementLogic, [count]);

  return (
    <div style="max-width: 400px; margin: 2rem auto; padding: 2rem; border: 1px solid #ddd; border-radius: 8px;">
      <h1 style="margin-top: 0;">Counter Example</h1>
      <div style="text-align: center; margin: 2rem 0;">
        <div style="font-size: 3rem; font-weight: bold;">{count}</div>
      </div>
      <div style="display: flex; gap: 1rem; justify-content: center;">
        <button onClick={decrement} style="padding: 0.5rem 1rem; font-size: 1rem; cursor: pointer;">
          -
        </button>
        <button onClick={increment} style="padding: 0.5rem 1rem; font-size: 1rem; cursor: pointer;">
          +
        </button>
      </div>
    </div>
  );
}

/**
 * Setup function to pre-register signals with the registry
 * This ensures LogicSignals are available before rendering
 */
export function setupCounter(registry: WeaverRegistry): void {
  const count = createSignal(0);
  const incrementLogic = createLogic("./logic/increment.js");
  const decrementLogic = createLogic("./logic/decrement.js");
  const increment = createHandler(incrementLogic, [count]);
  const decrement = createHandler(decrementLogic, [count]);

  registry.registerSignal(count);
  registry.registerSignal(incrementLogic);
  registry.registerSignal(decrementLogic);
  registry.registerSignal(increment);
  registry.registerSignal(decrement);
  registry.setValue(count.id, 0);
}
