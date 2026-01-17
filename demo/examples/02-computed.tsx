/**
 * Example 2: Computed Signals
 * Demonstrates reactive computed values that update automatically
 */
import { jsx } from "../../src/jsx/jsx";
import { createSignal, createHandler, createComputed, createLogic } from "../../src/signals";

// Create a state signal for the count
const count = createSignal(0);

// Create logic signals - use absolute paths from demo root so Vite can resolve them
const doubleLogic = createLogic("/logic/double.js");
const incrementLogic = createLogic("/logic/increment.js");
const decrementLogic = createLogic("/logic/decrement.js");

// Create a computed signal that doubles the count
// Initial value of 0 for SSR (since 0 * 2 = 0)
const doubled = createComputed(doubleLogic, [count], 0);

// Create handlers for increment/decrement
const increment = createHandler(incrementLogic, [count]);
const decrement = createHandler(decrementLogic, [count]);

// Define the component
export function ComputedExample(): JSX.Element {
  return jsx("div", {
    style: "max-width: 400px; margin: 2rem auto; padding: 2rem; border: 1px solid #ddd; border-radius: 8px;",
    children: [
      jsx("h1", { style: "margin-top: 0;", children: "Computed Signals" }),
      jsx("div", {
        style: "margin: 2rem 0;",
        children: [
          jsx("div", {
            style: "display: flex; justify-content: space-between; margin-bottom: 1rem;",
            children: [
              jsx("span", { children: "Count:" }),
              jsx("strong", { style: "font-size: 1.5rem;", children: count }),
            ],
          }),
          jsx("div", {
            style: "display: flex; justify-content: space-between; color: #0066cc;",
            children: [
              jsx("span", { children: "Doubled:" }),
              jsx("strong", { style: "font-size: 1.5rem;", children: doubled }),
            ],
          }),
        ],
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
