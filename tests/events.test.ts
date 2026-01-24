/**
 * @vitest-environment happy-dom
 */
import { describe, test, expect, beforeEach } from "vitest";
import { defineSignal } from "@/signals/defineSignal";
import { defineHandler } from "@/signals/defineHandler";
import { defineLogic } from "@/signals/defineLogic";
import { defineMutator } from "@/signals/defineMutator";
import { WeaverRegistry } from "@/registry/WeaverRegistry";
import { SignalDelegate } from "@/SignalDelegate/SignalDelegate";
import { setupEventDelegation } from "@/ClientWeaver/setupEventDelegation";

/**
 * Helper to wait for a condition to be true
 */
async function waitFor(condition: () => boolean, timeout = 1000): Promise<void> {
  const startTime = Date.now();
  while (!condition()) {
    if (Date.now() - startTime > timeout) {
      throw new Error("waitFor timeout");
    }
    await new Promise((resolve) => {
      setTimeout(resolve, 10);
    });
  }
}

describe("Milestone 7: Event Delegation Infrastructure", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  test("event delegation finds handler ID and triggers execution", async () => {
    const count = defineSignal(0);
    const countMutator = defineMutator(count);
    const logic = defineLogic("./tests/fixtures/handleClick.js");
    const handler = defineHandler(logic, [countMutator]);

    const registry = new WeaverRegistry();
    registry.registerSignal(count);
    registry.registerSignal(countMutator);
    registry.registerSignal(logic);
    registry.registerSignal(handler);
    registry.setValue(count.id, 0);

    document.body.innerHTML = `<button data-w-onclick="${handler.id}">Click</button>`;

    const delegate = new SignalDelegate(registry);
    const writer = delegate.writable.getWriter();
    setupEventDelegation(writer);

    // Consume the delegate stream
    (async () => {
      const reader = delegate.readable.getReader();
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      while (true) {
        const { done } = await reader.read();
        if (done) {
          break;
        }
      }
    })().catch(() => {
      // Ignore errors
    });

    const button = document.querySelector("button");
    if (!button) {
      throw new Error("Button not found");
    }
    button.click();

    await waitFor(() => registry.getValue(count.id) === 1);

    expect(registry.getValue(count.id)).toBe(1);
  });

  test("multiple event types work", async () => {
    const count1 = defineSignal(0);
    const count2 = defineSignal(0);
    const count1Mutator = defineMutator(count1);
    const count2Mutator = defineMutator(count2);
    const logic = defineLogic("./tests/fixtures/handleClick.js");
    const clickHandler = defineHandler(logic, [count1Mutator]);
    const inputHandler = defineHandler(logic, [count2Mutator]);

    const registry = new WeaverRegistry();
    registry.registerSignal(count1);
    registry.registerSignal(count2);
    registry.registerSignal(count1Mutator);
    registry.registerSignal(count2Mutator);
    registry.registerSignal(logic);
    registry.registerSignal(clickHandler);
    registry.registerSignal(inputHandler);
    registry.setValue(count1.id, 0);
    registry.setValue(count2.id, 0);

    document.body.innerHTML = `
      <button data-w-onclick="${clickHandler.id}">Click</button>
      <input data-w-oninput="${inputHandler.id}" />
    `;

    const delegate = new SignalDelegate(registry);
    const writer = delegate.writable.getWriter();
    setupEventDelegation(writer);

    // Consume the delegate stream
    (async () => {
      const reader = delegate.readable.getReader();
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      while (true) {
        const { done } = await reader.read();
        if (done) {
          break;
        }
      }
    })().catch(() => {
      // Ignore errors
    });

    const button = document.querySelector("button");
    if (!button) {
      throw new Error("Button not found");
    }
    button.click();

    await waitFor(() => registry.getValue(count1.id) === 1);

    const input = document.querySelector("input");
    if (!input) {
      throw new Error("Input not found");
    }
    input.dispatchEvent(new Event("input", { bubbles: true }));

    await waitFor(() => registry.getValue(count2.id) === 1);

    expect(registry.getValue(count1.id)).toBe(1);
    expect(registry.getValue(count2.id)).toBe(1);
  });

  test("event delegation bubbles to parent", async () => {
    const count = defineSignal(0);
    const countMutator = defineMutator(count);
    const logic = defineLogic("./tests/fixtures/handleClick.js");
    const handler = defineHandler(logic, [countMutator]);

    const registry = new WeaverRegistry();
    registry.registerSignal(count);
    registry.registerSignal(countMutator);
    registry.registerSignal(logic);
    registry.registerSignal(handler);
    registry.setValue(count.id, 0);

    document.body.innerHTML = `<div data-w-onclick="${handler.id}"><button>Nested</button></div>`;

    const delegate = new SignalDelegate(registry);
    const writer = delegate.writable.getWriter();
    setupEventDelegation(writer);

    // Consume the delegate stream
    (async () => {
      const reader = delegate.readable.getReader();
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      while (true) {
        const { done } = await reader.read();
        if (done) {
          break;
        }
      }
    })().catch(() => {
      // Ignore errors
    });

    const button = document.querySelector("button");
    if (!button) {
      throw new Error("Button not found");
    }
    button.click();

    await waitFor(() => registry.getValue(count.id) === 1);

    expect(registry.getValue(count.id)).toBe(1); // Parent handler executed
  });
});
