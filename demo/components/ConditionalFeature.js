/**
 * ConditionalFeature Component
 * Demonstrates conditional state creation that would be impossible in React
 *
 * This is a plain JS module that returns JSX-like node structures.
 * Props receive signal interfaces with .value getters.
 */

import { createSignal, createHandler, createLogic } from "../../src/signals/index.js";

export default function ConditionalFeature(props) {
  const enabled = props.enabled;

  if (!enabled.value) {
    return {
      type: "div",
      props: { style: "padding: 1rem; background: #f5f5f5; border-radius: 8px; color: #999; text-align: center;" },
      children: ["Advanced mode is disabled. State doesn't even exist yet!"]
    };
  }

  // State created conditionally! Only exists when enabled is true.
  const advancedValue = createSignal(42);
  const incrementAdvanced = createHandler(createLogic("/logic/increment.js"), [advancedValue]);
  const decrementAdvanced = createHandler(createLogic("/logic/decrement.js"), [advancedValue]);

  return {
    type: "div",
    props: { style: "padding: 1rem; background: #e3f2fd; border-radius: 8px;" },
    children: [
      {
        type: "h4",
        props: { style: "margin: 0 0 1rem 0; color: #1976d2;" },
        children: ["Advanced Mode Active"]
      },
      {
        type: "p",
        props: { style: "margin: 0 0 1rem 0; color: #666;" },
        children: ["This state was created conditionally - it only exists because enabled=true"]
      },
      {
        type: "div",
        props: { style: "display: flex; align-items: center; gap: 1rem;" },
        children: [
          {
            type: "button",
            props: {
              onClick: decrementAdvanced,
              style: "padding: 0.5rem 1rem; background: #1976d2; color: white; border: none; border-radius: 4px; cursor: pointer;"
            },
            children: ["-"]
          },
          {
            type: "span",
            props: { style: "font-size: 1.5rem; font-weight: bold; min-width: 60px; text-align: center;" },
            children: [advancedValue]
          },
          {
            type: "button",
            props: {
              onClick: incrementAdvanced,
              style: "padding: 0.5rem 1rem; background: #1976d2; color: white; border: none; border-radius: 4px; cursor: pointer;"
            },
            children: ["+"]
          }
        ]
      }
    ]
  };
}
