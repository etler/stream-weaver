import { describe, it, expect } from "vitest";
import { createSignal, createLogic, createComputed, createAction, createHandler } from "@/signals";
import { WeaverRegistry } from "@/registry";

describe("Milestone 1: Signal System Foundation", () => {
  describe("Signal Creation", () => {
    it("signal creation produces definition object", () => {
      const count = createSignal(0);
      expect(count.id).toBe("s1");
      expect(count.kind).toBe("state");
      expect(count.init).toBe(0);
      expect(count).not.toHaveProperty("value"); // No .value on definitions
    });

    it("multiple signals have unique IDs", () => {
      const s1 = createSignal(1);
      const s2 = createSignal(2);
      expect(s1.id).toBe("s2"); // Continues from previous test
      expect(s2.id).toBe("s3");
    });
  });

  describe("WeaverRegistry", () => {
    it("registry stores signal values", () => {
      const count = createSignal(10);
      const registry = new WeaverRegistry();

      registry.registerSignal(count);
      expect(registry.getValue(count.id)).toBe(10); // Initial value stored

      registry.setValue(count.id, 20);
      expect(registry.getValue(count.id)).toBe(20);
    });

    it("registry stores signal definitions", () => {
      const count = createSignal(5);
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
      const count = createSignal(5);
      const doubleLogic = createLogic("double.js");
      const doubled = createComputed(doubleLogic, [count]);

      const registry = new WeaverRegistry();
      registry.registerSignal(count);
      registry.registerSignal(doubleLogic);
      registry.registerSignal(doubled);

      const dependents = registry.getDependents(count.id);
      expect(dependents.has(doubled.id)).toBe(true);
      expect(doubled.logic).toBe(doubleLogic.id); // Stores logic ID reference
    });

    it("registry tracks dependencies bidirectionally", () => {
      const count = createSignal(5);
      const doubleLogic = createLogic("double.js");
      const doubled = createComputed(doubleLogic, [count]);

      const registry = new WeaverRegistry();
      registry.registerSignal(count);
      registry.registerSignal(doubleLogic);
      registry.registerSignal(doubled);

      expect(registry.getDependents(count.id).has(doubled.id)).toBe(true);
      expect(registry.getDependencies(doubled.id)).toEqual([count.id]);
    });

    it("same logic and deps produce same ID (content-addressable)", () => {
      const count = createSignal(5);
      const doubleLogic = createLogic("double.js");
      const c1 = createComputed(doubleLogic, [count]);
      const c2 = createComputed(doubleLogic, [count]);

      expect(c1.id).toBe(c2.id); // Hash based on logic ID + dep IDs
    });

    it("dependency graph tracks multiple levels", () => {
      const s1 = createSignal(1);
      const doubleLogic = createLogic("double.js");
      const quadLogic = createLogic("quadruple.js");
      const c1 = createComputed(doubleLogic, [s1]);
      const c2 = createComputed(quadLogic, [c1]);

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
      const count = createSignal(0);
      const incLogic = createLogic("increment.js");
      const clickLogic = createLogic("click.js");
      const increment = createAction(incLogic, [count]);
      const handleClick = createHandler(clickLogic, [count]);

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
