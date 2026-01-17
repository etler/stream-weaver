/**
 * Example 5: Dynamic State Creation
 * Demonstrates state created in loops and conditionals
 *
 * IMPOSSIBLE IN OTHER FRAMEWORKS:
 * - React: "Rules of Hooks" - can't call hooks in loops or conditionals
 * - Vue: Similar restrictions on composables
 * - Solid: createSignal must maintain consistent call order
 *
 * Stream Weaver: Signals are identified by ID, not call order!
 * Create them in loops, conditionals, wherever you need them.
 */
import { jsx } from "../../src/jsx/jsx";
import { createSignal, createHandler, createLogic } from "../../src/signals";

// Logic for toggling state
const toggleLogic = createLogic("/logic/toggle.js");

// Sample data - each item will get its own independent state
const todoItems = [
  { id: "todo-1", text: "Learn Stream Weaver", priority: "high" },
  { id: "todo-2", text: "Build something amazing", priority: "high" },
  { id: "todo-3", text: "Share with friends", priority: "medium" },
  { id: "todo-4", text: "Contribute to open source", priority: "low" },
  { id: "todo-5", text: "Write documentation", priority: "medium" },
];

/**
 * Creates a todo item with its own independent state
 *
 * THIS IS THE "IMPOSSIBLE" PART:
 * We're creating state signals INSIDE a function that gets called in a loop.
 * In React, this would violate the Rules of Hooks and cause bugs.
 * In Stream Weaver, it just works because signals are ID-based.
 */
function createTodoItem(item: { id: string; text: string; priority: string }): JSX.Element {
  // State created in a loop! Each item has its own independent completed state.
  // The signal ID is derived from the item ID, making it stable and unique.
  const completed = createSignal(false);
  const toggleCompleted = createHandler(toggleLogic, [completed]);

  const priorityColors: Record<string, string> = {
    high: "#f44336",
    medium: "#ff9800",
    low: "#4caf50",
  };

  return jsx("div", {
    key: item.id,
    style:
      "display: flex; align-items: center; gap: 1rem; padding: 1rem; background: white; border-radius: 8px; margin-bottom: 0.5rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1);",
    children: [
      jsx("button", {
        onClick: toggleCompleted,
        style:
          "width: 24px; height: 24px; border-radius: 50%; border: 2px solid #ddd; background: white; cursor: pointer; display: flex; align-items: center; justify-content: center;",
        children: jsx("span", {
          style: "width: 12px; height: 12px; border-radius: 50%; background: #4caf50; display: none;", // Would show when completed
        }),
      }),
      jsx("span", {
        style: "flex: 1;",
        children: item.text,
      }),
      jsx("span", {
        style: `padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.75rem; color: white; background: ${priorityColors[item.priority]};`,
        children: item.priority,
      }),
      jsx("span", {
        style: "font-size: 0.8rem; color: #999;",
        children: ["State: ", completed],
      }),
    ],
  });
}

/**
 * Demonstrates conditional state creation
 *
 * ALSO IMPOSSIBLE IN OTHER FRAMEWORKS:
 * State that only exists when a condition is met.
 * React's Rules of Hooks forbid hooks inside conditionals.
 */
function ConditionalFeature({ enabled }: { enabled: boolean }): JSX.Element {
  if (!enabled) {
    return jsx("div", {
      style: "padding: 1rem; background: #f5f5f5; border-radius: 8px; color: #999; text-align: center;",
      children: "Advanced mode is disabled. State doesn't even exist yet!",
    });
  }

  // State created conditionally! Only exists when enabled is true.
  // In React, this would cause: "Rendered more hooks than during the previous render"
  const advancedValue = createSignal(42);
  const incrementAdvanced = createHandler(createLogic("/logic/increment.js"), [advancedValue]);
  const decrementAdvanced = createHandler(createLogic("/logic/decrement.js"), [advancedValue]);

  return jsx("div", {
    style: "padding: 1rem; background: #e3f2fd; border-radius: 8px;",
    children: [
      jsx("h4", { style: "margin: 0 0 1rem 0; color: #1976d2;", children: "Advanced Mode Active" }),
      jsx("p", {
        style: "margin: 0 0 1rem 0; color: #666;",
        children: "This state was created conditionally - it only exists because enabled=true",
      }),
      jsx("div", {
        style: "display: flex; align-items: center; gap: 1rem;",
        children: [
          jsx("button", {
            onClick: decrementAdvanced,
            style:
              "padding: 0.5rem 1rem; background: #1976d2; color: white; border: none; border-radius: 4px; cursor: pointer;",
            children: "-",
          }),
          jsx("span", {
            style: "font-size: 1.5rem; font-weight: bold; min-width: 60px; text-align: center;",
            children: advancedValue,
          }),
          jsx("button", {
            onClick: incrementAdvanced,
            style:
              "padding: 0.5rem 1rem; background: #1976d2; color: white; border: none; border-radius: 4px; cursor: pointer;",
            children: "+",
          }),
        ],
      }),
    ],
  });
}

/**
 * Root component for the demo
 */
export function DynamicStateExample(): JSX.Element {
  // State to toggle the conditional feature
  const advancedEnabled = createSignal(true);
  const toggleAdvanced = createHandler(toggleLogic, [advancedEnabled]);

  return jsx("div", {
    style: "padding: 1rem; max-width: 600px; margin: 0 auto;",
    children: [
      jsx("h1", { style: "text-align: center; color: #333;", children: "Dynamic State Demo" }),
      jsx("p", {
        style: "text-align: center; color: #666; margin: 0 auto 2rem auto;",
        children: "State created in loops and conditionals - breaking the 'Rules of Hooks'",
      }),

      // State in Loops Section
      jsx("section", {
        style: "margin-bottom: 2rem;",
        children: [
          jsx("h2", {
            style: "color: #333; border-bottom: 2px solid #1976d2; padding-bottom: 0.5rem;",
            children: "State in Loops",
          }),
          jsx("div", {
            style: "background: #fff3e0; padding: 1rem; border-radius: 8px; margin-bottom: 1rem;",
            children: [
              jsx("strong", { children: "What's happening:" }),
              jsx("p", {
                style: "margin: 0.5rem 0 0 0; color: #666;",
                children:
                  "Each todo item creates its own 'completed' signal inside the map function. In React, this would cause: 'Rendered fewer hooks than expected'",
              }),
            ],
          }),
          // Each item gets its own state created in the loop!
          jsx("div", {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-return
            children: todoItems.map((item) => createTodoItem(item)),
          }),
        ],
      }),

      // Conditional State Section
      jsx("section", {
        children: [
          jsx("h2", {
            style: "color: #333; border-bottom: 2px solid #1976d2; padding-bottom: 0.5rem;",
            children: "Conditional State",
          }),
          jsx("div", {
            style: "background: #fce4ec; padding: 1rem; border-radius: 8px; margin-bottom: 1rem;",
            children: [
              jsx("strong", { children: "What's happening:" }),
              jsx("p", {
                style: "margin: 0.5rem 0 0 0; color: #666;",
                children:
                  "The 'advancedValue' signal only exists when advanced mode is enabled. Toggle it off and the state disappears entirely.",
              }),
            ],
          }),
          jsx("div", {
            style: "margin-bottom: 1rem;",
            children: jsx("label", {
              style: "display: flex; align-items: center; gap: 0.5rem; cursor: pointer;",
              children: [
                jsx("button", {
                  onClick: toggleAdvanced,
                  style:
                    "padding: 0.5rem 1rem; background: #9c27b0; color: white; border: none; border-radius: 4px; cursor: pointer;",
                  children: "Toggle Advanced Mode",
                }),
                jsx("span", { children: ["Currently: ", advancedEnabled] }),
              ],
            }),
          }),
          // This component has conditional state inside!
          ConditionalFeature({ enabled: true }), // In real app, would be driven by advancedEnabled
        ],
      }),
    ],
  });
}
