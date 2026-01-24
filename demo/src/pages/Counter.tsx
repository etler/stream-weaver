/**
 * Example 1: Simple Counter
 * Demonstrates basic state signals and event handlers
 */
import { defineSignal, defineHandler, defineLogic } from "stream-weaver";

export function Counter(): JSX.Element {
  // Create a state signal for the count
  const count = defineSignal(0);

  // Create logic signals for the handlers (type-safe with import())
  const incrementLogic = defineLogic(import("../logic/increment"));
  const decrementLogic = defineLogic(import("../logic/decrement"));

  // Create handlers for increment/decrement (TypeScript validates deps match function signature)
  const increment = defineHandler(incrementLogic, [count]);
  const decrement = defineHandler(decrementLogic, [count]);

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
