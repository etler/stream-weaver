import { describe, test, expect, vi } from "vitest";
import { defineSignal, defineLogic, defineReducer, AnySignal } from "@/signals";
import { WeaverRegistry } from "@/registry/WeaverRegistry";
import { executeReducer } from "@/logic/executeReducer";
import path from "node:path";

// Get absolute path to fixtures
const fixturesPath = path.resolve(__dirname, "fixtures");

// Mock the environment module to simulate client environment for execution tests
vi.mock("@/utils/environment", () => ({
  isServer: () => false,
  isClient: () => true,
}));

describe("Reducer Signals", () => {
  describe("defineReducer", () => {
    test("creates a ReducerSignal with correct properties", () => {
      // Use a plain signal as source (in practice, would be a computed signal with client logic)
      const sourceSignal = defineSignal(null);
      const appendLogic = defineLogic({ src: `${fixturesPath}/append.js` });

      const messages = defineReducer(sourceSignal, appendLogic, []);

      expect(messages.kind).toBe("reducer");
      expect(messages.source).toBe(sourceSignal.id);
      expect(messages.reducer).toBe(appendLogic.id);
      expect(messages.init).toEqual([]);
    });

    test("creates content-addressable IDs (same inputs = same ID)", () => {
      const sourceSignal = defineSignal(null);
      const appendLogic = defineLogic({ src: `${fixturesPath}/append.js` });

      const reducer1 = defineReducer(sourceSignal, appendLogic, []);
      const reducer2 = defineReducer(sourceSignal, appendLogic, []);

      expect(reducer1.id).toBe(reducer2.id);
    });

    test("creates different IDs for different sources", () => {
      const source1 = defineSignal(null);
      const source2 = defineSignal(null);
      const appendLogic = defineLogic({ src: `${fixturesPath}/append.js` });

      const reducer1 = defineReducer(source1, appendLogic, []);
      const reducer2 = defineReducer(source2, appendLogic, []);

      expect(reducer1.id).not.toBe(reducer2.id);
    });

    test("creates different IDs for different reducers", () => {
      const sourceSignal = defineSignal(null);
      const appendLogic = defineLogic({ src: `${fixturesPath}/append.js` });
      const latestLogic = defineLogic({ src: `${fixturesPath}/latest.js` });

      const reducer1 = defineReducer(sourceSignal, appendLogic, []);
      const reducer2 = defineReducer(sourceSignal, latestLogic, null);

      expect(reducer1.id).not.toBe(reducer2.id);
    });

    test("stores runtime references", () => {
      const sourceSignal = defineSignal(null);
      const appendLogic = defineLogic({ src: `${fixturesPath}/append.js` });

      const reducer = defineReducer(sourceSignal, appendLogic, []);

      expect(reducer.sourceRef).toBe(sourceSignal);
      expect(reducer.reducerRef).toBe(appendLogic);
    });
  });

  describe("executeReducer", () => {
    test("accumulates values from ReadableStream via append reducer", async () => {
      const mockStream = new ReadableStream({
        start(controller) {
          controller.enqueue({ id: 1, text: "Hello" });
          controller.enqueue({ id: 2, text: "World" });
          controller.close();
        },
      });

      // Create a placeholder source signal (the actual stream is set in registry)
      const sourceSignal = defineSignal(null) as AnySignal;
      const appendLogic = defineLogic({ src: `${fixturesPath}/append.js` });
      const messages = defineReducer(sourceSignal, appendLogic, []);

      const registry = new WeaverRegistry();
      registry.registerSignal(sourceSignal);
      registry.registerSignal(appendLogic);
      registry.registerSignal(messages);
      registry.setValue(sourceSignal.id, mockStream);

      await executeReducer(registry, messages.id);

      const value = registry.getValue(messages.id);
      expect(value).toEqual([
        { id: 1, text: "Hello" },
        { id: 2, text: "World" },
      ]);
    });

    test("accumulates values from Array via append reducer", async () => {
      const mockArray = [
        { id: 1, text: "Hello" },
        { id: 2, text: "World" },
      ];

      const sourceSignal = defineSignal(null) as AnySignal;
      const appendLogic = defineLogic({ src: `${fixturesPath}/append.js` });
      const messages = defineReducer(sourceSignal, appendLogic, []);

      const registry = new WeaverRegistry();
      registry.registerSignal(sourceSignal);
      registry.registerSignal(appendLogic);
      registry.registerSignal(messages);
      registry.setValue(sourceSignal.id, mockArray);

      await executeReducer(registry, messages.id);

      const value = registry.getValue(messages.id);
      expect(value).toEqual([
        { id: 1, text: "Hello" },
        { id: 2, text: "World" },
      ]);
    });

    test("keeps only latest value with latest reducer", async () => {
      const mockStream = new ReadableStream({
        start(controller) {
          controller.enqueue(1);
          controller.enqueue(2);
          controller.enqueue(3);
          controller.close();
        },
      });

      const sourceSignal = defineSignal(null) as AnySignal;
      const latestLogic = defineLogic({ src: `${fixturesPath}/latest.js` });
      const current = defineReducer(sourceSignal, latestLogic, null);

      const registry = new WeaverRegistry();
      registry.registerSignal(sourceSignal);
      registry.registerSignal(latestLogic);
      registry.registerSignal(current);
      registry.setValue(sourceSignal.id, mockStream);

      await executeReducer(registry, current.id);

      expect(registry.getValue(current.id)).toBe(3);
    });

    test("uses init value as starting accumulator", async () => {
      const mockStream = new ReadableStream({
        start(controller) {
          controller.enqueue("item");
          controller.close();
        },
      });

      const sourceSignal = defineSignal(null) as AnySignal;
      const appendLogic = defineLogic({ src: `${fixturesPath}/append.js` });
      const items = defineReducer(sourceSignal, appendLogic, ["initial"]);

      const registry = new WeaverRegistry();
      registry.registerSignal(sourceSignal);
      registry.registerSignal(appendLogic);
      registry.registerSignal(items);
      registry.setValue(sourceSignal.id, mockStream);

      await executeReducer(registry, items.id);

      // Init value should be the starting point, with new item appended
      expect(registry.getValue(items.id)).toEqual(["initial", "item"]);
    });

    test("throws error if source value is not iterable", async () => {
      const sourceSignal = defineSignal("not iterable");
      const appendLogic = defineLogic({ src: `${fixturesPath}/append.js` });
      const reducer = defineReducer(sourceSignal, appendLogic, []);

      const registry = new WeaverRegistry();
      registry.registerSignal(sourceSignal);
      registry.registerSignal(appendLogic);
      registry.registerSignal(reducer);
      registry.setValue(sourceSignal.id, 42); // number is not iterable

      await expect(executeReducer(registry, reducer.id)).rejects.toThrow("not iterable");
    });

    test("throws error if signal is not a reducer signal", async () => {
      const stateSignal = defineSignal(42);

      const registry = new WeaverRegistry();
      registry.registerSignal(stateSignal);

      await expect(executeReducer(registry, stateSignal.id)).rejects.toThrow("not a reducer signal");
    });

    test("handles empty stream", async () => {
      const mockStream = new ReadableStream({
        start(controller) {
          controller.close();
        },
      });

      const sourceSignal = defineSignal(null) as AnySignal;
      const appendLogic = defineLogic({ src: `${fixturesPath}/append.js` });
      const items = defineReducer(sourceSignal, appendLogic, []);

      const registry = new WeaverRegistry();
      registry.registerSignal(sourceSignal);
      registry.registerSignal(appendLogic);
      registry.registerSignal(items);
      registry.setValue(sourceSignal.id, mockStream);

      await executeReducer(registry, items.id);

      expect(registry.getValue(items.id)).toEqual([]);
    });

    test("handles empty array", async () => {
      const mockArray: unknown[] = [];

      const sourceSignal = defineSignal(null) as AnySignal;
      const appendLogic = defineLogic({ src: `${fixturesPath}/append.js` });
      const items = defineReducer(sourceSignal, appendLogic, []);

      const registry = new WeaverRegistry();
      registry.registerSignal(sourceSignal);
      registry.registerSignal(appendLogic);
      registry.registerSignal(items);
      registry.setValue(sourceSignal.id, mockArray);

      await executeReducer(registry, items.id);

      expect(registry.getValue(items.id)).toEqual([]);
    });
  });
});
