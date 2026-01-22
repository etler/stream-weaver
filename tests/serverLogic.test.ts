import { describe, test, expect } from "vitest";
import { createSignal, createComputed, createServerLogic, createLogic } from "@/signals";
import { WeaverRegistry } from "@/registry/WeaverRegistry";
import { serializeSignalChain, executeFromChain } from "@/logic/remoteExecution";
import path from "node:path";

// Get absolute path to fixtures
const fixturesPath = path.resolve(__dirname, "fixtures");

describe("Milestone 13: Server-side Logic", () => {
  describe("createServerLogic", () => {
    test("creates logic with context: server", () => {
      const serverLogic = createServerLogic(`${fixturesPath}/serverDouble.js`);

      expect(serverLogic.context).toBe("server");
      expect(serverLogic.kind).toBe("logic");
      expect(serverLogic.src).toBe(`${fixturesPath}/serverDouble.js`);
    });

    test("different context options produce different IDs", () => {
      const clientLogic = createLogic({ src: `${fixturesPath}/double.js` }, { context: "client" });
      const serverLogic = createLogic({ src: `${fixturesPath}/double.js` }, { context: "server" });
      const defaultLogic = createLogic({ src: `${fixturesPath}/double.js` });

      // All should have different IDs despite same src
      expect(clientLogic.id).not.toBe(serverLogic.id);
      expect(serverLogic.id).not.toBe(defaultLogic.id);
      expect(clientLogic.id).not.toBe(defaultLogic.id);
    });
  });

  describe("serializeSignalChain", () => {
    test("serializes a simple computed signal chain", () => {
      const count = createSignal(5);
      const logic = createLogic({ src: `${fixturesPath}/double.js` });
      const result = createComputed(logic, [count]);

      const registry = new WeaverRegistry();
      registry.registerSignal(count);
      registry.registerSignal(logic);
      registry.registerSignal(result);

      const chain = serializeSignalChain(registry, result.id);

      expect(chain.targetId).toBe(result.id);
      expect(chain.signals.length).toBe(3); // count, logic, result

      // Check signals are included
      const signalIds = chain.signals.map((entry) => entry.signal.id);
      expect(signalIds).toContain(count.id);
      expect(signalIds).toContain(logic.id);
      expect(signalIds).toContain(result.id);
    });

    test("includes values for state signals", () => {
      const count = createSignal(5);
      const logic = createLogic({ src: `${fixturesPath}/double.js` });
      const result = createComputed(logic, [count]);

      const registry = new WeaverRegistry();
      registry.registerSignal(count);
      registry.registerSignal(logic);
      registry.registerSignal(result);
      registry.setValue(count.id, 42); // Update value

      const chain = serializeSignalChain(registry, result.id);

      // Find the count signal in chain
      const countEntry = chain.signals.find((entry) => entry.signal.id === count.id);
      expect(countEntry?.value).toBe(42);
    });

    test("prunes at computed signals with serializable values", () => {
      // Build a chain: count -> double -> triple
      // If double already has a value, triple's chain shouldn't include count
      const count = createSignal(5);
      const doubleLogic = createLogic({ src: `${fixturesPath}/double.js` });
      const doubled = createComputed(doubleLogic, [count]);

      const tripleLogic = createLogic({ src: `${fixturesPath}/triple.js` });
      const tripled = createComputed(tripleLogic, [doubled]);

      const registry = new WeaverRegistry();
      registry.registerSignal(count);
      registry.registerSignal(doubleLogic);
      registry.registerSignal(doubled);
      registry.registerSignal(tripleLogic);
      registry.registerSignal(tripled);

      // Set the doubled value (simulating it was already computed)
      registry.setValue(doubled.id, 10);

      const chain = serializeSignalChain(registry, tripled.id);

      // Should include: tripled, tripleLogic, doubled (with value)
      // Should NOT include: count, doubleLogic (pruned because doubled has value)
      const signalIds = chain.signals.map((entry) => entry.signal.id);

      expect(signalIds).toContain(tripled.id);
      expect(signalIds).toContain(tripleLogic.id);
      expect(signalIds).toContain(doubled.id);

      // These should be pruned
      expect(signalIds).not.toContain(count.id);
      expect(signalIds).not.toContain(doubleLogic.id);

      // The doubled signal should have its value included
      const doubledEntry = chain.signals.find((entry) => entry.signal.id === doubled.id);
      expect(doubledEntry?.value).toBe(10);
    });

    test("removes non-serializable references from signals", () => {
      const count = createSignal(5);
      const logic = createLogic({ src: `${fixturesPath}/double.js` });
      const result = createComputed(logic, [count]);

      const registry = new WeaverRegistry();
      registry.registerSignal(count);
      registry.registerSignal(logic);
      registry.registerSignal(result);

      const chain = serializeSignalChain(registry, result.id);

      // Check that logicRef is not included (it's non-serializable)
      const resultEntry = chain.signals.find((entry) => entry.signal.id === result.id);
      expect(resultEntry?.signal).not.toHaveProperty("logicRef");
    });
  });

  describe("executeFromChain", () => {
    test("rebuilds registry and executes computed signal", async () => {
      // Create signals and serialize
      const count = createSignal(5);
      const logic = createLogic({ src: `${fixturesPath}/double.js` });
      const result = createComputed(logic, [count]);

      const registry = new WeaverRegistry();
      registry.registerSignal(count);
      registry.registerSignal(logic);
      registry.registerSignal(result);

      const chain = serializeSignalChain(registry, result.id);

      // Execute from chain (as server would)
      const value = await executeFromChain(chain);

      expect(value).toBe(10); // 5 * 2
    });

    test("uses serialized values correctly", async () => {
      const count = createSignal(0); // init is 0
      const logic = createLogic({ src: `${fixturesPath}/double.js` });
      const result = createComputed(logic, [count]);

      const registry = new WeaverRegistry();
      registry.registerSignal(count);
      registry.registerSignal(logic);
      registry.registerSignal(result);
      registry.setValue(count.id, 7); // Current value is 7

      const chain = serializeSignalChain(registry, result.id);

      // Execute from chain should use the serialized value (7)
      const value = await executeFromChain(chain);

      expect(value).toBe(14); // 7 * 2
    });

    test("works with pruned chains", async () => {
      // Build chain where intermediate computed has value
      const count = createSignal(5);
      const doubleLogic = createLogic({ src: `${fixturesPath}/double.js` });
      const doubled = createComputed(doubleLogic, [count]);

      const tripleLogic = createLogic({ src: `${fixturesPath}/triple.js` });
      const tripled = createComputed(tripleLogic, [doubled]);

      const registry = new WeaverRegistry();
      registry.registerSignal(count);
      registry.registerSignal(doubleLogic);
      registry.registerSignal(doubled);
      registry.registerSignal(tripleLogic);
      registry.registerSignal(tripled);

      // Set doubled value (pruning point)
      registry.setValue(doubled.id, 10);

      const chain = serializeSignalChain(registry, tripled.id);

      // Execute should work even though count/doubleLogic aren't in chain
      const value = await executeFromChain(chain);

      expect(value).toBe(30); // 10 * 3
    });

    test("throws error for unsupported signal types", async () => {
      const count = createSignal(5);

      const registry = new WeaverRegistry();
      registry.registerSignal(count);

      const chain = serializeSignalChain(registry, count.id);

      // State signals can't be executed
      await expect(executeFromChain(chain)).rejects.toThrow("Unsupported signal type");
    });
  });

  describe("integration", () => {
    test("chain serialization is idempotent", () => {
      const count = createSignal(5);
      const logic = createLogic({ src: `${fixturesPath}/double.js` });
      const result = createComputed(logic, [count]);

      const registry = new WeaverRegistry();
      registry.registerSignal(count);
      registry.registerSignal(logic);
      registry.registerSignal(result);

      const chain1 = serializeSignalChain(registry, result.id);
      const chain2 = serializeSignalChain(registry, result.id);

      // Both serializations should produce identical JSON
      expect(JSON.stringify(chain1)).toBe(JSON.stringify(chain2));
    });

    test("server logic keeps src in serialization for server execution", () => {
      const count = createSignal(5);
      const serverLogic = createServerLogic(`${fixturesPath}/serverDouble.js`);
      const result = createComputed(serverLogic, [count]);

      const registry = new WeaverRegistry();
      registry.registerSignal(count);
      registry.registerSignal(serverLogic);
      registry.registerSignal(result);

      const chain = serializeSignalChain(registry, result.id);

      // Find the logic signal in chain
      const logicEntry = chain.signals.find((entry) => entry.signal.id === serverLogic.id);

      // Server logic should keep src for server-side module loading
      expect(logicEntry?.signal.kind).toBe("logic");
      if (logicEntry?.signal.kind === "logic") {
        expect(logicEntry.signal.src).toBe(`${fixturesPath}/serverDouble.js`);
        expect(logicEntry.signal.context).toBe("server");
      }
    });
  });
});
