/**
 * Example 5: Dynamic State Creation
 * Demonstrates state created in loops and conditionals
 *
 * IMPOSSIBLE IN OTHER FRAMEWORKS:
 * - React: "Rules of Hooks" - can't call hooks in loops or conditionals
 * - Vue: Similar restrictions on composables
 * - Solid: defineSignal must maintain consistent call order
 *
 * Stream Weaver: Signals are identified by ID, not call order!
 * Create them in loops, conditionals, wherever you need them.
 */
import {
  defineSignal,
  defineHandler,
  defineLogic,
  defineComputed,
  defineComponent,
  defineMutator,
} from "stream-weaver";

// Logic for toggling state and visual display (type-safe with import())
const toggleLogic = defineLogic(import("../logic/toggle"));
const checkmarkLogic = defineLogic(import("../logic/checkmark"));

// ComponentSignal for the ConditionalFeature component
const ConditionalFeatureLogic = defineLogic(import("../components/ConditionalFeature"));
const ConditionalFeature = defineComponent(ConditionalFeatureLogic);

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
function TodoItem(item: { id: string; text: string; priority: string }): JSX.Element {
  // State created in a loop! Each item has its own independent completed state.
  const completed = defineSignal(false);
  const setCompleted = defineMutator(completed);
  const toggleCompleted = defineHandler(toggleLogic, [setCompleted]);

  // Computed signal that returns a checkmark when completed
  const checkmark = defineComputed(checkmarkLogic, [completed], "");

  const priorityColors: Record<string, string> = {
    high: "#f44336",
    medium: "#ff9800",
    low: "#4caf50",
  };

  return (
    <div
      key={item.id}
      style="display: flex; align-items: center; gap: 1rem; padding: 1rem; background: white; border-radius: 8px; margin-bottom: 0.5rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1);"
    >
      <button
        onClick={toggleCompleted}
        style="width: 28px; height: 28px; border-radius: 50%; border: 2px solid #4caf50; background: white; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 16px; color: #4caf50; font-weight: bold;"
      >
        {checkmark}
      </button>
      <span style="flex: 1;">{item.text}</span>
      <span
        style={`padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.75rem; color: white; background: ${priorityColors[item.priority]};`}
      >
        {item.priority}
      </span>
      <span style="font-size: 0.8rem; color: #999;">State: {completed}</span>
    </div>
  );
}

/**
 * Root component for the demo
 */
export function DynamicStateExample(): JSX.Element {
  // State to toggle the conditional feature
  const advancedEnabled = defineSignal(true);
  const advancedEnabledMutator = defineMutator(advancedEnabled);
  const toggleAdvanced = defineHandler(toggleLogic, [advancedEnabledMutator]);

  return (
    <div style="padding: 1rem; max-width: 600px; margin: 0 auto;">
      <h1 style="text-align: center; color: #333;">Dynamic State Demo</h1>
      <p style="text-align: center; color: #666; margin: 0 auto 2rem auto;">
        State created in loops and conditionals - breaking the 'Rules of Hooks'
      </p>

      {/* State in Loops Section */}
      <section style="margin-bottom: 2rem;">
        <h2 style="color: #333; border-bottom: 2px solid #1976d2; padding-bottom: 0.5rem;">State in Loops</h2>
        <div style="background: #fff3e0; padding: 1rem; border-radius: 8px; margin-bottom: 1rem;">
          <strong>What's happening:</strong>
          <p style="margin: 0.5rem 0 0 0; color: #666;">
            Each todo item creates its own 'completed' signal inside the map function. In React, this would cause:
            'Rendered fewer hooks than expected'
          </p>
        </div>
        <div>
          {todoItems.map((item) => (
            <TodoItem {...item} />
          ))}
        </div>
      </section>

      {/* Conditional State Section */}
      <section>
        <h2 style="color: #333; border-bottom: 2px solid #1976d2; padding-bottom: 0.5rem;">Conditional State</h2>
        <div style="background: #fce4ec; padding: 1rem; border-radius: 8px; margin-bottom: 1rem;">
          <strong>What's happening:</strong>
          <p style="margin: 0.5rem 0 0 0; color: #666;">
            The 'advancedValue' signal is created INSIDE an if-block. In React, this code pattern would crash with
            "Rendered more hooks than during previous render". In Stream Weaver, it just works.
          </p>
        </div>
        <div style="margin-bottom: 1rem;">
          <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
            <button
              onClick={toggleAdvanced}
              style="padding: 0.5rem 1rem; background: #9c27b0; color: white; border: none; border-radius: 4px; cursor: pointer;"
            >
              Toggle Advanced Mode
            </button>
            <span>Currently: {advancedEnabled}</span>
          </label>
        </div>
        <ConditionalFeature enabled={advancedEnabled} />
      </section>
    </div>
  );
}
