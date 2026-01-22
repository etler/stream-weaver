import { describe, test, expect, vi } from "vitest";
import { createSignal, createLogic, createStream, AnySignal } from "@/signals";
import { WeaverRegistry } from "@/registry/WeaverRegistry";
import { executeStream } from "@/logic/executeStream";
import path from "node:path";

// Get absolute path to fixtures
const fixturesPath = path.resolve(__dirname, "fixtures");

// Mock the environment module to simulate client environment for execution tests
vi.mock("@/utils/environment", () => ({
  isServer: () => false,
  isClient: () => true,
}));

describe("Stream Signals", () => {
  describe("createStream", () => {
    test("creates a StreamSignal with correct properties", () => {
      // Use a plain signal as source (in practice, would be a computed signal with client logic)
      const sourceSignal = createSignal(null);
      const appendLogic = createLogic({ src: `${fixturesPath}/append.js` });

      const messages = createStream(sourceSignal, appendLogic, []);

      expect(messages.kind).toBe("stream");
      expect(messages.source).toBe(sourceSignal.id);
      expect(messages.reducer).toBe(appendLogic.id);
      expect(messages.init).toEqual([]);
    });

    test("creates content-addressable IDs (same inputs = same ID)", () => {
      const sourceSignal = createSignal(null);
      const appendLogic = createLogic({ src: `${fixturesPath}/append.js` });

      const stream1 = createStream(sourceSignal, appendLogic, []);
      const stream2 = createStream(sourceSignal, appendLogic, []);

      expect(stream1.id).toBe(stream2.id);
    });

    test("creates different IDs for different sources", () => {
      const source1 = createSignal(null);
      const source2 = createSignal(null);
      const appendLogic = createLogic({ src: `${fixturesPath}/append.js` });

      const stream1 = createStream(source1, appendLogic, []);
      const stream2 = createStream(source2, appendLogic, []);

      expect(stream1.id).not.toBe(stream2.id);
    });

    test("creates different IDs for different reducers", () => {
      const sourceSignal = createSignal(null);
      const appendLogic = createLogic({ src: `${fixturesPath}/append.js` });
      const latestLogic = createLogic({ src: `${fixturesPath}/latest.js` });

      const stream1 = createStream(sourceSignal, appendLogic, []);
      const stream2 = createStream(sourceSignal, latestLogic, null);

      expect(stream1.id).not.toBe(stream2.id);
    });

    test("stores runtime references", () => {
      const sourceSignal = createSignal(null);
      const appendLogic = createLogic({ src: `${fixturesPath}/append.js` });

      const stream = createStream(sourceSignal, appendLogic, []);

      expect(stream.sourceRef).toBe(sourceSignal);
      expect(stream.reducerRef).toBe(appendLogic);
    });
  });

  describe("executeStream", () => {
    test("accumulates values via append reducer", async () => {
      const mockStream = new ReadableStream({
        start(controller) {
          controller.enqueue({ id: 1, text: "Hello" });
          controller.enqueue({ id: 2, text: "World" });
          controller.close();
        },
      });

      // Create a placeholder source signal (the actual stream is set in registry)
      const sourceSignal = createSignal(null) as AnySignal;
      const appendLogic = createLogic({ src: `${fixturesPath}/append.js` });
      const messages = createStream(sourceSignal, appendLogic, []);

      const registry = new WeaverRegistry();
      registry.registerSignal(sourceSignal);
      registry.registerSignal(appendLogic);
      registry.registerSignal(messages);
      registry.setValue(sourceSignal.id, mockStream);

      await executeStream(registry, messages.id);

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

      const sourceSignal = createSignal(null) as AnySignal;
      const latestLogic = createLogic({ src: `${fixturesPath}/latest.js` });
      const current = createStream(sourceSignal, latestLogic, null);

      const registry = new WeaverRegistry();
      registry.registerSignal(sourceSignal);
      registry.registerSignal(latestLogic);
      registry.registerSignal(current);
      registry.setValue(sourceSignal.id, mockStream);

      await executeStream(registry, current.id);

      expect(registry.getValue(current.id)).toBe(3);
    });

    test("uses init value as starting accumulator", async () => {
      const mockStream = new ReadableStream({
        start(controller) {
          controller.enqueue("item");
          controller.close();
        },
      });

      const sourceSignal = createSignal(null) as AnySignal;
      const appendLogic = createLogic({ src: `${fixturesPath}/append.js` });
      const items = createStream(sourceSignal, appendLogic, ["initial"]);

      const registry = new WeaverRegistry();
      registry.registerSignal(sourceSignal);
      registry.registerSignal(appendLogic);
      registry.registerSignal(items);
      registry.setValue(sourceSignal.id, mockStream);

      await executeStream(registry, items.id);

      // Init value should be the starting point, with new item appended
      expect(registry.getValue(items.id)).toEqual(["initial", "item"]);
    });

    test("throws error if source value is not a ReadableStream", async () => {
      const sourceSignal = createSignal("not a stream");
      const appendLogic = createLogic({ src: `${fixturesPath}/append.js` });
      const stream = createStream(sourceSignal, appendLogic, []);

      const registry = new WeaverRegistry();
      registry.registerSignal(sourceSignal);
      registry.registerSignal(appendLogic);
      registry.registerSignal(stream);
      registry.setValue(sourceSignal.id, "not a stream");

      await expect(executeStream(registry, stream.id)).rejects.toThrow("Source signal");
    });

    test("throws error if signal is not a stream signal", async () => {
      const stateSignal = createSignal(42);

      const registry = new WeaverRegistry();
      registry.registerSignal(stateSignal);

      await expect(executeStream(registry, stateSignal.id)).rejects.toThrow("not a stream signal");
    });

    test("handles empty stream", async () => {
      const mockStream = new ReadableStream({
        start(controller) {
          controller.close();
        },
      });

      const sourceSignal = createSignal(null) as AnySignal;
      const appendLogic = createLogic({ src: `${fixturesPath}/append.js` });
      const items = createStream(sourceSignal, appendLogic, []);

      const registry = new WeaverRegistry();
      registry.registerSignal(sourceSignal);
      registry.registerSignal(appendLogic);
      registry.registerSignal(items);
      registry.setValue(sourceSignal.id, mockStream);

      await executeStream(registry, items.id);

      expect(registry.getValue(items.id)).toEqual([]);
    });
  });
});
