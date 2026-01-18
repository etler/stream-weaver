/**
 * Example 1: Simple Counter
 * Demonstrates basic state signals and event handlers
 */
import { createSignal, createHandler, createLogic } from "stream-weaver";

export function Counter(): JSX.Element {
  // Create a state signal for the count
  const count = createSignal(0);

  // Create logic signals for the handlers
  const incrementLogic = createLogic("/src/logic/increment.ts");
  const decrementLogic = createLogic("/src/logic/decrement.ts");

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
