import { describe, it, expect } from "vitest";
import { defineSignal, defineLogic, defineComputed, defineAction, defineHandler, defineReference } from "@/signals";
import { WeaverRegistry } from "@/registry/WeaverRegistry";
import { loadLogic, createWritableSignalInterface, executeComputed, executeAction, executeHandler } from "@/logic";

describe("Milestone 1: Signal System Foundation", () => {
  describe("Signal Creation", () => {
    it("signal creation produces definition object", () => {
      const count = defineSignal(0);
      expect(count.id).toBe("s1");
      expect(count.kind).toBe("state");
      expect(count.init).toBe(0);
      expect(count.value).toBe(0); // .value equals init for SSR
    });

    it("multiple signals have unique IDs", () => {
      const s1 = defineSignal(1);
      const s2 = defineSignal(2);
      expect(s1.id).toBe("s2"); // Continues from previous test
      expect(s2.id).toBe("s3");
    });
  });

  describe("WeaverRegistry", () => {
    it("registry stores signal values", () => {
      const count = defineSignal(10);
      const registry = new WeaverRegistry();

      registry.registerSignal(count);
      expect(registry.getValue(count.id)).toBe(10); // Initial value stored

      registry.setValue(count.id, 20);
      expect(registry.getValue(count.id)).toBe(20);
    });

    it("registry stores signal definitions", () => {
      const count = defineSignal(5);
      const registry = new WeaverRegistry();

      registry.registerSignal(count);
      const retrieved = registry.getSignal(count.id);

      expect(retrieved).toBe(count); // Same definition object
      if (retrieved?.kind === "state") {
        expect(retrieved.init).toBe(5);
      }
    });
  });
});

describe("Milestone 2: Dependency Graph", () => {
  describe("Signal Definitions", () => {
    it("computed definition registers dependencies", () => {
      const count = defineSignal(5);
      const doubleLogic = defineLogic("double.js");
      const doubled = defineComputed(doubleLogic, [count]);

      const registry = new WeaverRegistry();
      registry.registerSignal(count);
      registry.registerSignal(doubleLogic);
      registry.registerSignal(doubled);

      const dependents = registry.getDependents(count.id);
      expect(dependents.has(doubled.id)).toBe(true);
      expect(doubled.logic).toBe(doubleLogic.id); // Stores logic ID reference
    });

    it("registry tracks dependencies bidirectionally", () => {
      const count = defineSignal(5);
      const doubleLogic = defineLogic("double.js");
      const doubled = defineComputed(doubleLogic, [count]);

      const registry = new WeaverRegistry();
      registry.registerSignal(count);
      registry.registerSignal(doubleLogic);
      registry.registerSignal(doubled);

      expect(registry.getDependents(count.id).has(doubled.id)).toBe(true);
      expect(registry.getDependencies(doubled.id)).toEqual([count.id]);
    });

    it("same logic and deps produce same ID (content-addressable)", () => {
      const count = defineSignal(5);
      const doubleLogic = defineLogic("double.js");
      const c1 = defineComputed(doubleLogic, [count]);
      const c2 = defineComputed(doubleLogic, [count]);

      expect(c1.id).toBe(c2.id); // Hash based on logic ID + dep IDs
    });

    it("dependency graph tracks multiple levels", () => {
      const s1 = defineSignal(1);
      const doubleLogic = defineLogic("double.js");
      const quadLogic = defineLogic("quadruple.js");
      const c1 = defineComputed(doubleLogic, [s1]);
      const c2 = defineComputed(quadLogic, [c1]);

      const registry = new WeaverRegistry();
      registry.registerSignal(s1);
      registry.registerSignal(doubleLogic);
      registry.registerSignal(quadLogic);
      registry.registerSignal(c1);
      registry.registerSignal(c2);

      expect(registry.getDependents(s1.id).has(c1.id)).toBe(true);
      expect(registry.getDependents(c1.id).has(c2.id)).toBe(true);
    });

    it("action and handler definitions work similarly", () => {
      const count = defineSignal(0);
      const incLogic = defineLogic("increment.js");
      const clickLogic = defineLogic("click.js");
      const increment = defineAction(incLogic, [count]);
      const handleClick = defineHandler(clickLogic, [count]);

      const registry = new WeaverRegistry();
      registry.registerSignal(count);
      registry.registerSignal(incLogic);
      registry.registerSignal(clickLogic);
      registry.registerSignal(increment);
      registry.registerSignal(handleClick);

      expect(registry.getDependents(count.id).has(increment.id)).toBe(true);
      expect(registry.getDependents(count.id).has(handleClick.id)).toBe(true);
      expect(increment.logic).toBe(incLogic.id); // Stores logic ID reference
      expect(handleClick.logic).toBe(clickLogic.id);
    });
  });
});

describe("Milestone 3: Logic System & Signal Interfaces", () => {
  describe("Logic Module Loading", () => {
    it("logic module can be loaded", async () => {
      const doubleLogic = defineLogic("./tests/fixtures/double.js");
      const fn = await loadLogic(doubleLogic);

      expect(typeof fn).toBe("function");
    });
  });

  describe("Signal Interfaces", () => {
    it("signal interface provides .value that accesses registry", () => {
      const count = defineSignal(5);
      const registry = new WeaverRegistry();
      registry.registerSignal(count);
      registry.setValue(count.id, 5);

      const countInterface = createWritableSignalInterface(registry, count.id);

      expect(countInterface.value).toBe(5);
      countInterface.value = 10;
      expect(registry.getValue(count.id)).toBe(10);
    });
  });

  describe("Computed Execution", () => {
    it("computed executes logic and caches result", async () => {
      const count = defineSignal(5);
      const doubleLogic = defineLogic("./tests/fixtures/double.js");
      const doubled = defineComputed(doubleLogic, [count]);

      const registry = new WeaverRegistry();
      registry.registerSignal(count);
      registry.registerSignal(doubleLogic);
      registry.registerSignal(doubled);
      registry.setValue(count.id, 5);

      await executeComputed(registry, doubled.id);

      expect(registry.getValue(doubled.id)).toBe(10);
    });

    it("multiple signals can be passed to logic", async () => {
      const numA = defineSignal(5);
      const numB = defineSignal(10);
      const sumLogic = defineLogic("./tests/fixtures/sum.js");
      const sum = defineComputed(sumLogic, [numA, numB]);

      const registry = new WeaverRegistry();
      registry.registerSignal(numA);
      registry.registerSignal(numB);
      registry.registerSignal(sumLogic);
      registry.registerSignal(sum);
      registry.setValue(numA.id, 5);
      registry.setValue(numB.id, 10);

      await executeComputed(registry, sum.id);

      expect(registry.getValue(sum.id)).toBe(15);
    });
  });

  describe("Action Execution", () => {
    it("action can mutate signals via writable interface", async () => {
      const count = defineSignal(0);
      const incLogic = defineLogic("./tests/fixtures/increment.js");
      const increment = defineAction(incLogic, [count]);

      const registry = new WeaverRegistry();
      registry.registerSignal(count);
      registry.registerSignal(incLogic);
      registry.registerSignal(increment);
      registry.setValue(count.id, 0);

      await executeAction(registry, increment.id);

      expect(registry.getValue(count.id)).toBe(1);
    });
  });

  describe("Handler Execution", () => {
    it("handler receives event and writable signal interfaces", async () => {
      const count = defineSignal(0);
      const clickLogic = defineLogic("./tests/fixtures/handleClick.js");
      const handler = defineHandler(clickLogic, [count]);

      const registry = new WeaverRegistry();
      registry.registerSignal(count);
      registry.registerSignal(clickLogic);
      registry.registerSignal(handler);
      registry.setValue(count.id, 0);

      // Simple mock event object (Node environment doesn't have MouseEvent)
      // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
      const mockEvent = { type: "click" } as Event;
      await executeHandler(registry, handler.id, mockEvent);

      expect(registry.getValue(count.id)).toBe(1);
    });
  });
});

describe("Reference Signals", () => {
  describe("defineReference", () => {
    it("creates a reference signal wrapping another signal", () => {
      const count = defineSignal(0);
      const countRef = defineReference(count);

      expect(countRef.kind).toBe("reference");
      expect(countRef.ref).toBe(count.id);
      expect(countRef.id).toBeDefined();
    });

    it("same wrapped signal produces same reference ID (content-addressable)", () => {
      const count = defineSignal(5);
      const ref1 = defineReference(count);
      const ref2 = defineReference(count);

      expect(ref1.id).toBe(ref2.id);
    });

    it("different wrapped signals produce different reference IDs", () => {
      const count1 = defineSignal(5);
      const count2 = defineSignal(10);
      const ref1 = defineReference(count1);
      const ref2 = defineReference(count2);

      expect(ref1.id).not.toBe(ref2.id);
    });

    it("can wrap any signal type", () => {
      const stateSignal = defineSignal(0);
      const logicSignal = defineLogic("./test.js");
      const computedSignal = defineComputed(logicSignal, [stateSignal]);

      const stateRef = defineReference(stateSignal);
      const logicRef = defineReference(logicSignal);
      const computedRef = defineReference(computedSignal);

      expect(stateRef.ref).toBe(stateSignal.id);
      expect(logicRef.ref).toBe(logicSignal.id);
      expect(computedRef.ref).toBe(computedSignal.id);
    });

    it("reference can be registered in registry", () => {
      const count = defineSignal(0);
      const countRef = defineReference(count);

      const registry = new WeaverRegistry();
      registry.registerSignal(count);
      registry.registerSignal(countRef);

      const retrieved = registry.getSignal(countRef.id);
      expect(retrieved).toBe(countRef);
      expect(retrieved?.kind).toBe("reference");
    });
  });
});
