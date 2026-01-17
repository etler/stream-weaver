import { describe, it, expect } from "vitest";
import { createSignal } from "@/signals";
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
