import { describe, test, expect } from "vitest";
import { createSignal } from "@/signals/createSignal";
import { createComponent } from "@/signals/createComponent";
import { WeaverRegistry } from "@/registry/WeaverRegistry";

describe("Milestone 8: Components as Signals", () => {
  test("component definition is created with signal props", () => {
    const name = createSignal("Alice");
    const card = createComponent({ src: "./fixtures/Card.js" }, { name, title: "User" });

    expect(card.kind).toBe("component");
    expect(card.id).toMatch(/^[a-z0-9]+$/); // Content-addressable hash
    expect(card.props["name"]).toBe(name);
    expect(card.props["title"]).toBe("User");
  });

  test("component dependencies extracted from props", () => {
    const name = createSignal("Alice");
    const age = createSignal(30);
    const card = createComponent({ src: "./fixtures/Card.js" }, { name, age, role: "Admin" });

    const registry = new WeaverRegistry();
    registry.registerSignal(name);
    registry.registerSignal(age);
    registry.registerSignal(card);

    expect(registry.getDependents(name.id)).toContain(card.id);
    expect(registry.getDependents(age.id)).toContain(card.id);
  });

  test("component with only primitive props has no dependencies", () => {
    const card = createComponent({ src: "./fixtures/Card.js" }, { title: "User", count: 5 });

    expect(card.deps).toEqual([]);
  });

  test("component with mixed props extracts only signal dependencies", () => {
    const name = createSignal("Alice");
    const card = createComponent({ src: "./fixtures/Card.js" }, { name, title: "User", age: 25 });

    expect(card.deps).toEqual([name.id]);
    expect(card.deps.length).toBe(1);
  });

  test("components with same logic and props have same ID", () => {
    const name = createSignal("Alice");
    const card1 = createComponent({ src: "./fixtures/Card.js" }, { name, title: "User" });
    const card2 = createComponent({ src: "./fixtures/Card.js" }, { name, title: "User" });

    expect(card1.id).toBe(card2.id);
  });

  test("components with different props have different IDs", () => {
    const name = createSignal("Alice");
    const card1 = createComponent({ src: "./fixtures/Card.js" }, { name, title: "User" });
    const card2 = createComponent({ src: "./fixtures/Card.js" }, { name, title: "Admin" });

    expect(card1.id).not.toBe(card2.id);
  });
});
