import { describe, it, expect } from "vitest";
import { createSignal, createLogic, createComputed } from "@/signals";
import { WeaverRegistry } from "@/registry/WeaverRegistry";
import { SignalDelegate } from "@/SignalDelegate";
import { executeComputed } from "@/logic";

describe("Milestone 4: Reactivity Propagation (ChainExplode)", () => {
  describe("Signal Update Propagation", () => {
    it("signal update triggers dependent computed execution", async () => {
      const count = createSignal(5);
      const doubleLogic = createLogic("./tests/fixtures/double.js");
      const doubled = createComputed(doubleLogic, [count]);

      const registry = new WeaverRegistry();
      registry.registerSignal(count);
      registry.registerSignal(doubleLogic);
      registry.registerSignal(doubled);
      registry.setValue(count.id, 5);

      await executeComputed(registry, doubled.id); // Initial execution
      expect(registry.getValue(doubled.id)).toBe(10);

      const delegate = new SignalDelegate(registry);
      const writer = delegate.writable.getWriter();

      // Collect output tokens
      const tokens: unknown[] = [];
      const readerPromise = (async () => {
        for await (const token of delegate.readable) {
          tokens.push(token);
        }
      })();

      // Trigger update
      await writer.write({ kind: "signal-update", id: count.id, value: 7 });
      await writer.close();

      // Wait for reader to complete
      await readerPromise;

      // Computed should have re-executed
      expect(registry.getValue(doubled.id)).toBe(14);
    });

    it("cascading updates propagate through multiple levels", async () => {
      const count = createSignal(2);
      const doubleLogic = createLogic("./tests/fixtures/double.js");
      const doubled = createComputed(doubleLogic, [count]);
      const quadrupled = createComputed(doubleLogic, [doubled]);

      const registry = new WeaverRegistry();
      registry.registerSignal(count);
      registry.registerSignal(doubleLogic);
      registry.registerSignal(doubled);
      registry.registerSignal(quadrupled);
      registry.setValue(count.id, 2);

      await executeComputed(registry, doubled.id);
      await executeComputed(registry, quadrupled.id);

      expect(registry.getValue(doubled.id)).toBe(4);
      expect(registry.getValue(quadrupled.id)).toBe(8);

      const delegate = new SignalDelegate(registry);
      const writer = delegate.writable.getWriter();

      const events: string[] = [];
      const readerPromise = (async () => {
        for await (const event of delegate.readable) {
          events.push(event.id);
        }
      })();

      await writer.write({ kind: "signal-update", id: count.id, value: 3 });
      await writer.close();

      await readerPromise;

      // All levels updated
      expect(registry.getValue(count.id)).toBe(3);
      expect(registry.getValue(doubled.id)).toBe(6);
      expect(registry.getValue(quadrupled.id)).toBe(12);
      expect(events).toEqual([count.id, doubled.id, quadrupled.id]);
    });

    it("multiple dependents execute in parallel", async () => {
      const count = createSignal(5);
      const doubleLogic = createLogic("./tests/fixtures/double.js");
      const tripleLogic = createLogic("./tests/fixtures/triple.js");
      const doubled = createComputed(doubleLogic, [count]);
      const tripled = createComputed(tripleLogic, [count]);

      const registry = new WeaverRegistry();
      registry.registerSignal(count);
      registry.registerSignal(doubleLogic);
      registry.registerSignal(tripleLogic);
      registry.registerSignal(doubled);
      registry.registerSignal(tripled);
      registry.setValue(count.id, 5);

      await executeComputed(registry, doubled.id);
      await executeComputed(registry, tripled.id);

      const delegate = new SignalDelegate(registry);
      const writer = delegate.writable.getWriter();

      // Consume stream tokens to drain the readable stream
      const readerPromise = Array.fromAsync(delegate.readable);

      const startTime = Date.now();
      await writer.write({ kind: "signal-update", id: count.id, value: 10 });
      await writer.close();

      await readerPromise;

      const elapsed = Date.now() - startTime;

      expect(registry.getValue(doubled.id)).toBe(20);
      expect(registry.getValue(tripled.id)).toBe(30);
      // Should execute in parallel, not sequentially
      expect(elapsed).toBeLessThan(100); // Reasonable threshold
    });
  });
});
