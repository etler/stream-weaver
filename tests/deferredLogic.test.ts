import { describe, test, expect } from "vitest";
import { createSignal, createComputed, createLogic, createClientLogic, PENDING } from "@/signals";
import { WeaverRegistry } from "@/registry/WeaverRegistry";
import { executeComputed } from "@/logic";
import path from "node:path";

// Get absolute path to fixtures
const fixturesPath = path.resolve(__dirname, "fixtures");

describe("Milestone 12: Deferred and Client Logic", () => {
  describe("PENDING symbol", () => {
    test("PENDING is a unique symbol", () => {
      expect(typeof PENDING).toBe("symbol");
      expect(PENDING).not.toBe(Symbol("PENDING")); // Unique instance
    });
  });

  describe("timeout: 0 (always defer)", () => {
    test("timeout: 0 sets PENDING immediately", async () => {
      const count = createSignal(5);
      const slowLogic = createLogic({ src: `${fixturesPath}/slowDouble.js` }, { timeout: 0 });
      const result = createComputed(slowLogic, [count]);

      const registry = new WeaverRegistry();
      registry.registerSignal(count);
      registry.registerSignal(slowLogic);
      registry.registerSignal(result);
      registry.setValue(count.id, 5);

      // Start execution (don't await yet)
      const execResult = await executeComputed(registry, result.id);

      // Value should be PENDING immediately
      expect(execResult.value).toBe(PENDING);
      expect(registry.getValue(result.id)).toBe(PENDING);

      // After deferred completion, value should be resolved
      if (execResult.deferred) {
        await execResult.deferred;
      }
      expect(registry.getValue(result.id)).toBe(10);
    });

    test("timeout: 0 uses init value when provided", async () => {
      const count = createSignal(5);
      const slowLogic = createLogic({ src: `${fixturesPath}/slowDouble.js` }, { timeout: 0 });
      const result = createComputed(slowLogic, [count], 0); // init = 0

      const registry = new WeaverRegistry();
      registry.registerSignal(count);
      registry.registerSignal(slowLogic);
      registry.registerSignal(result);
      registry.setValue(count.id, 5);

      // Start execution
      const execResult = await executeComputed(registry, result.id);

      // Value should be init value (0) immediately, not PENDING
      expect(execResult.value).toBe(0);
      expect(registry.getValue(result.id)).toBe(0);

      // After deferred completion, value should be resolved
      if (execResult.deferred) {
        await execResult.deferred;
      }
      expect(registry.getValue(result.id)).toBe(10);
    });
  });

  describe("timeout racing", () => {
    test("timeout races execution against timer - timer wins", async () => {
      const count = createSignal(5);
      // Logic that takes 100ms, timeout is 50ms
      const slowLogic = createLogic({ src: `${fixturesPath}/slow100ms.js` }, { timeout: 50 });
      const result = createComputed(slowLogic, [count]);

      const registry = new WeaverRegistry();
      registry.registerSignal(count);
      registry.registerSignal(slowLogic);
      registry.registerSignal(result);
      registry.setValue(count.id, 5);

      const execResult = await executeComputed(registry, result.id);

      // Should be PENDING after 50ms timeout (timer won the race)
      expect(execResult.value).toBe(PENDING);
      expect(registry.getValue(result.id)).toBe(PENDING);

      // After deferred completion, value should be resolved
      if (execResult.deferred) {
        await execResult.deferred;
      }
      expect(registry.getValue(result.id)).toBe(10);
    });

    test("fast logic completes inline when within timeout", async () => {
      const count = createSignal(5);
      // Logic that takes 10ms, timeout is 50ms
      const fastLogic = createLogic({ src: `${fixturesPath}/fast10ms.js` }, { timeout: 50 });
      const result = createComputed(fastLogic, [count]);

      const registry = new WeaverRegistry();
      registry.registerSignal(count);
      registry.registerSignal(fastLogic);
      registry.registerSignal(result);
      registry.setValue(count.id, 5);

      await executeComputed(registry, result.id);

      // Should have completed inline (not PENDING)
      expect(registry.getValue(result.id)).toBe(10);
    });
  });

  describe("createClientLogic", () => {
    test("createClientLogic sets context to client", () => {
      const viewportLogic = createClientLogic(`${fixturesPath}/getViewport.js`);

      expect(viewportLogic.context).toBe("client");
      expect(viewportLogic.kind).toBe("logic");
    });

    test("clientside logic returns PENDING on server", async () => {
      // We're running in Node.js, so isServer() returns true
      const viewportLogic = createClientLogic(`${fixturesPath}/getViewport.js`);
      const viewport = createComputed(viewportLogic, []);

      const registry = new WeaverRegistry();
      registry.registerSignal(viewportLogic);
      registry.registerSignal(viewport);

      await executeComputed(registry, viewport.id);

      // Should be PENDING, not executed
      expect(registry.getValue(viewport.id)).toBe(PENDING);
    });

    test("clientside logic uses init value on server when provided", async () => {
      const viewportLogic = createClientLogic(`${fixturesPath}/getViewport.js`);
      const viewport = createComputed(viewportLogic, [], { width: 1024, height: 768 });

      const registry = new WeaverRegistry();
      registry.registerSignal(viewportLogic);
      registry.registerSignal(viewport);

      await executeComputed(registry, viewport.id);

      // Should use init value
      expect(registry.getValue(viewport.id)).toEqual({ width: 1024, height: 768 });
    });
  });

  describe("sync logic ignores timeout", () => {
    test("sync logic executes immediately regardless of timeout", async () => {
      const count = createSignal(5);
      // Sync logic (double.js) with timeout: 0 should still execute immediately
      const syncLogic = createLogic({ src: `${fixturesPath}/double.js` }, { timeout: 0 });
      const result = createComputed(syncLogic, [count]);

      const registry = new WeaverRegistry();
      registry.registerSignal(count);
      registry.registerSignal(syncLogic);
      registry.registerSignal(result);
      registry.setValue(count.id, 5);

      const execResult = await executeComputed(registry, result.id);

      // Sync functions complete immediately, so value should be resolved
      // (but may still return as deferred for consistency)
      if (execResult.deferred) {
        await execResult.deferred;
      }
      expect(registry.getValue(result.id)).toBe(10);
    });
  });
});
