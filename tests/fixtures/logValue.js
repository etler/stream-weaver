/**
 * Action that receives an unwrapped value (not a writable interface)
 * Used to test that non-mutator dependencies are passed as values
 */
let lastLoggedValue = null;

export default function logValue(value) {
  lastLoggedValue = value;
  // Should receive the raw value, not a signal interface
  if (typeof value === "object" && value !== null && "value" in value) {
    throw new Error("Expected raw value, got signal interface");
  }
}

export function getLastLoggedValue() {
  return lastLoggedValue;
}

export function resetLastLoggedValue() {
  lastLoggedValue = null;
}
