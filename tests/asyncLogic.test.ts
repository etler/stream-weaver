import { describe, test, expect } from "vitest";
import { createSignal, createComputed, createAction, createHandler, LogicSignal } from "@/signals";
import { WeaverRegistry } from "@/registry/WeaverRegistry";
import { executeComputed, executeAction, executeHandler } from "@/logic";
import path from "node:path";

// Get absolute path to fixtures
const fixturesPath = path.resolve(__dirname, "fixtures");

describe("Milestone 11: Async Logic", () => {
  test("async computed logic resolves before storing value", async () => {
    const count = createSignal(5);
    const asyncLogic: LogicSignal = {
      id: "logic_asyncDouble",
      kind: "logic",
      src: `${fixturesPath}/asyncDouble.js`,
    };
    const doubled = createComputed(asyncLogic, [count]);

    const registry = new WeaverRegistry();
    registry.registerSignal(count);
    registry.registerSignal(asyncLogic);
    registry.registerSignal(doubled);
    registry.setValue(count.id, 5);

    await executeComputed(registry, doubled.id);

    // Value should be resolved, not a Promise
    expect(registry.getValue(doubled.id)).toBe(10);
  });

  test("async action completes before signal updates propagate", async () => {
    const count = createSignal(0);
    const asyncLogic: LogicSignal = {
      id: "logic_asyncInc",
      kind: "logic",
      src: `${fixturesPath}/asyncIncrement.js`,
    };
    const increment = createAction(asyncLogic, [count]);

    const registry = new WeaverRegistry();
    registry.registerSignal(count);
    registry.registerSignal(asyncLogic);
    registry.registerSignal(increment);
    registry.setValue(count.id, 0);

    await executeAction(registry, increment.id);

    expect(registry.getValue(count.id)).toBe(1);
  });

  test("createSignal init must be Serializable", () => {
    // Valid: JSON-compatible types
    const s1 = createSignal("hello");
    const s2 = createSignal(42);
    const s3 = createSignal(true);
    const s4 = createSignal(null);
    const s5 = createSignal({ name: "Alice", age: 30 });
    const s6 = createSignal([1, 2, 3]);
    const s7 = createSignal({ nested: { array: [1, "two", null] } });

    // All should create valid signals
    expect(s1.init).toBe("hello");
    expect(s2.init).toBe(42);
    expect(s3.init).toBe(true);
    expect(s4.init).toBe(null);
    expect(s5.init).toEqual({ name: "Alice", age: 30 });
    expect(s6.init).toEqual([1, 2, 3]);
    expect(s7.init).toEqual({ nested: { array: [1, "two", null] } });

    // TypeScript should error on non-serializable types:
    // const bad1 = createSignal(() => {}); // Function
    // const bad2 = createSignal(undefined); // undefined
    // const bad3 = createSignal(Symbol()); // Symbol
    // const bad4 = createSignal(new Map()); // Map
  });

  test("async handler awaits completion", async () => {
    const value = createSignal("");
    const asyncLogic: LogicSignal = {
      id: "logic_asyncHandler",
      kind: "logic",
      src: `${fixturesPath}/asyncHandler.js`,
    };
    const handler = createHandler(asyncLogic, [value]);

    const registry = new WeaverRegistry();
    registry.registerSignal(value);
    registry.registerSignal(asyncLogic);
    registry.registerSignal(handler);

    // Use a mock event object with the properties the handler needs
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
    const mockEvent = { type: "click" } as Event;
    await executeHandler(registry, handler.id, mockEvent);

    expect(registry.getValue(value.id)).toBe("click");
  });
});
