/**
 * ConditionalFeature Component
 * Demonstrates conditional state creation that would be impossible in React
 *
 * THIS IS THE "IMPOSSIBLE" PART:
 * State is created INSIDE an if-block. In React, this would violate
 * the Rules of Hooks and cause: "Rendered more hooks than during previous render"
 */
import { createSignal, createHandler, createLogic, type StateSignal } from "stream-weaver";

interface Props {
  enabled: StateSignal<boolean>;
}

export default function ConditionalFeature({ enabled }: Props): JSX.Element {
  if (!enabled.value) {
    return (
      <div style="padding: 1rem; background: #f5f5f5; border-radius: 8px; color: #999; text-align: center;">
        Advanced mode is disabled. State doesn't even exist yet!
      </div>
    );
  }

  // State created conditionally! Only exists when enabled is true.
  const advancedValue = createSignal(42);
  const incrementAdvanced = createHandler(createLogic("/src/logic/increment.ts"), [advancedValue]);
  const decrementAdvanced = createHandler(createLogic("/src/logic/decrement.ts"), [advancedValue]);

  return (
    <div style="padding: 1rem; background: #e3f2fd; border-radius: 8px;">
      <h4 style="margin: 0 0 1rem 0; color: #1976d2;">Advanced Mode Active</h4>
      <p style="margin: 0 0 1rem 0; color: #666;">
        This state was created conditionally - it only exists because enabled=true
      </p>
      <div style="display: flex; align-items: center; gap: 1rem;">
        <button
          onClick={decrementAdvanced}
          style="padding: 0.5rem 1rem; background: #1976d2; color: white; border: none; border-radius: 4px; cursor: pointer;"
        >
          -
        </button>
        <span style="font-size: 1.5rem; font-weight: bold; min-width: 60px; text-align: center;">
          {advancedValue}
        </span>
        <button
          onClick={incrementAdvanced}
          style="padding: 0.5rem 1rem; background: #1976d2; color: white; border: none; border-radius: 4px; cursor: pointer;"
        >
          +
        </button>
      </div>
    </div>
  );
}
