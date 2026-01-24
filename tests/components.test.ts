import { describe, test, expect } from "vitest";
import { defineSignal } from "@/signals/defineSignal";
import { defineLogic } from "@/signals/defineLogic";
import { defineComponent } from "@/signals/defineComponent";
import { defineNode } from "@/signals/defineNode";
import { WeaverRegistry } from "@/registry/WeaverRegistry";

describe("Milestone 8: Components as Signals", () => {
  test("component template is created from logic", () => {
    const logic = defineLogic("./fixtures/Card.js");
    const Card = defineComponent(logic);

    expect(Card.kind).toBe("component");
    expect(Card.id).toMatch(/^[a-z0-9]+$/);
    expect(Card.logic).toBe(logic);
  });

  test("node instance is created with signal props", () => {
    const logic = defineLogic("./fixtures/Card.js");
    const Card = defineComponent(logic);
    const name = defineSignal("Alice");

    const node = defineNode(Card, { name, title: "User" });

    expect(node.kind).toBe("node");
    expect(node.id).toMatch(/^[a-z0-9]+$/);
    expect(node.props["name"]).toBe(name);
    expect(node.props["title"]).toBe("User");
    expect(node.component).toBe(Card.id);
    expect(node.logic).toBe(logic.id);
  });

  test("node dependencies extracted from props", () => {
    const logic = defineLogic("./fixtures/Card.js");
    const Card = defineComponent(logic);
    const name = defineSignal("Alice");
    const age = defineSignal(30);
    const node = defineNode(Card, { name, age, role: "Admin" });

    const registry = new WeaverRegistry();
    registry.registerSignal(name);
    registry.registerSignal(age);
    registry.registerSignal(node);

    expect(registry.getDependents(name.id)).toContain(node.id);
    expect(registry.getDependents(age.id)).toContain(node.id);
  });

  test("node with only primitive props has no dependencies", () => {
    const logic = defineLogic("./fixtures/Card.js");
    const Card = defineComponent(logic);
    const node = defineNode(Card, { title: "User", count: 5 });

    expect(node.deps).toEqual([]);
  });

  test("node with mixed props extracts only signal dependencies", () => {
    const logic = defineLogic("./fixtures/Card.js");
    const Card = defineComponent(logic);
    const name = defineSignal("Alice");
    const node = defineNode(Card, { name, title: "User", age: 25 });

    expect(node.deps).toEqual([name.id]);
    expect(node.deps.length).toBe(1);
  });

  test("nodes with same component and props have same ID", () => {
    const logic = defineLogic("./fixtures/Card.js");
    const Card = defineComponent(logic);
    const name = defineSignal("Alice");
    const node1 = defineNode(Card, { name, title: "User" });
    const node2 = defineNode(Card, { name, title: "User" });

    expect(node1.id).toBe(node2.id);
  });

  test("nodes with different props have different IDs", () => {
    const logic = defineLogic("./fixtures/Card.js");
    const Card = defineComponent(logic);
    const name = defineSignal("Alice");
    const node1 = defineNode(Card, { name, title: "User" });
    const node2 = defineNode(Card, { name, title: "Admin" });

    expect(node1.id).not.toBe(node2.id);
  });

  test("node stores references to component and logic signals", () => {
    const logic = defineLogic("./fixtures/Card.js");
    const Card = defineComponent(logic);
    const node = defineNode(Card, { title: "Test" });

    // eslint-disable-next-line no-underscore-dangle
    expect(node._componentRef).toBe(Card);
    // eslint-disable-next-line no-underscore-dangle
    expect(node._logicRef).toBe(logic);
  });
});
