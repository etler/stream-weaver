import { describe, test, expect } from "vitest";
import { defineSignal, defineComputed, defineWorkerLogic, defineLogic } from "@/signals";
import path from "node:path";

// Get absolute path to fixtures
const fixturesPath = path.resolve(__dirname, "fixtures");

describe("Milestone 16: Worker Logic", () => {
  describe("defineWorkerLogic", () => {
    test("creates logic with context: worker", () => {
      const workerLogic = defineWorkerLogic(`${fixturesPath}/workerDouble.js`);

      expect(workerLogic.context).toBe("worker");
      expect(workerLogic.kind).toBe("logic");
      expect(workerLogic.src).toBe(`${fixturesPath}/workerDouble.js`);
    });

    test("different context options produce different IDs", () => {
      const clientLogic = defineLogic({ src: `${fixturesPath}/double.js` }, { context: "client" });
      const serverLogic = defineLogic({ src: `${fixturesPath}/double.js` }, { context: "server" });
      const workerLogic = defineLogic({ src: `${fixturesPath}/double.js` }, { context: "worker" });
      const defaultLogic = defineLogic({ src: `${fixturesPath}/double.js` });

      // All should have different IDs despite same src
      expect(clientLogic.id).not.toBe(serverLogic.id);
      expect(serverLogic.id).not.toBe(workerLogic.id);
      expect(workerLogic.id).not.toBe(defaultLogic.id);
      expect(clientLogic.id).not.toBe(workerLogic.id);
    });

    test("worker logic can have timeout option", () => {
      const deferredWorkerLogic = defineLogic(
        { src: `${fixturesPath}/workerDouble.js` },
        { context: "worker", timeout: 0 },
      );

      expect(deferredWorkerLogic.context).toBe("worker");
      expect(deferredWorkerLogic.timeout).toBe(0);
    });
  });

  describe("Worker logic signal creation", () => {
    test("creates computed signal with worker logic", () => {
      const count = defineSignal(5);
      const workerLogic = defineWorkerLogic(`${fixturesPath}/workerDouble.js`);
      const result = defineComputed(workerLogic, [count]);

      expect(result.kind).toBe("computed");
      expect(result.logic).toBe(workerLogic.id);
      expect(result.deps).toEqual([count.id]);
    });

    test("worker logic with init value", () => {
      const count = defineSignal(5);
      const workerLogic = defineWorkerLogic(`${fixturesPath}/workerDouble.js`);
      const result = defineComputed(workerLogic, [count], 0);

      expect(result.init).toBe(0);
    });
  });

  // Note: Full worker execution tests would require running in a browser/Bun environment
  // or setting up worker_threads in the test environment. The tests above verify
  // the signal creation and configuration works correctly.

  describe("Context type", () => {
    test("context type includes worker", () => {
      const workerLogic = defineWorkerLogic(`${fixturesPath}/workerDouble.js`);

      // TypeScript should allow 'worker' as a context value
      const context: "server" | "client" | "worker" | undefined = workerLogic.context;
      expect(context).toBe("worker");
    });
  });
});
