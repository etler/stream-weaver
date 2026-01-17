/**
 * Example 1: Simple Counter
 * Demonstrates basic state signals and event handlers
 */
import { jsx } from "../../src/jsx/jsx";
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

  return jsx("div", {
    style: "max-width: 400px; margin: 2rem auto; padding: 2rem; border: 1px solid #ddd; border-radius: 8px;",
    children: [
      jsx("h1", { style: "margin-top: 0;", children: "Counter Example" }),
      jsx("div", {
        style: "text-align: center; margin: 2rem 0;",
        children: jsx("div", { style: "font-size: 3rem; font-weight: bold;", children: count }),
      }),
      jsx("div", {
        style: "display: flex; gap: 1rem; justify-content: center;",
        children: [
          jsx("button", {
            onClick: decrement,
            style: "padding: 0.5rem 1rem; font-size: 1rem; cursor: pointer;",
            children: "-",
          }),
          jsx("button", {
            onClick: increment,
            style: "padding: 0.5rem 1rem; font-size: 1rem; cursor: pointer;",
            children: "+",
          }),
        ],
      }),
    ],
  });
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
