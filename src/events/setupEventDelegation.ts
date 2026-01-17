import { SignalDelegate } from "@/SignalDelegate/SignalDelegate";

/**
 * Event types to delegate
 */
const DELEGATED_EVENTS = ["click", "input", "change", "submit", "focus", "blur", "keydown", "keyup", "keypress"];

/**
 * Setup global event delegation
 * Attaches event listeners to the document root and routes events to SignalDelegate
 *
 * @param delegate - SignalDelegate instance to route events to
 */
export function setupEventDelegation(delegate: SignalDelegate): void {
  const writer = delegate.writable.getWriter();

  // Attach global event listeners for each event type
  for (const eventType of DELEGATED_EVENTS) {
    document.addEventListener(eventType, (event: Event) => {
      // Find handler ID by walking up the DOM tree
      const handlerId = findHandlerInTree(event.target, eventType);
      if (handlerId !== null) {
        // Write handler-execute event to the delegate stream
        writer
          .write({
            kind: "handler-execute",
            id: handlerId,
            event,
          })
          .catch((error: unknown) => {
            console.error(new Error("Failed to write handler-execute event", { cause: error }));
          });
      }
    });
  }
}

/**
 * Walk up the DOM tree from target looking for data-w-on{eventtype} attribute
 * Returns the handler ID if found, null otherwise
 *
 * @param target - Event target node
 * @param eventType - Event type (e.g., "click")
 * @returns Handler ID or null
 */
function findHandlerInTree(target: EventTarget | null, eventType: string): string | null {
  if (target === null || !(target instanceof Element)) {
    return null;
  }

  let currentElement: Element | null = target;

  // Walk up the tree until we find a data-w-on{eventtype} attribute or reach the top
  while (currentElement !== null) {
    const attributeName = `data-w-on${eventType}`;
    const handlerId = currentElement.getAttribute(attributeName);

    if (handlerId !== null) {
      return handlerId;
    }

    // Move to parent element
    currentElement = currentElement.parentElement;
  }

  return null;
}
