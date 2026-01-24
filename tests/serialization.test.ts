import { describe, test, expect } from "vitest";
import { StreamWeaver } from "@/StreamWeaver";
import { defineSignal } from "@/signals/defineSignal";
import { defineHandler } from "@/signals/defineHandler";
import { defineLogic } from "@/signals/defineLogic";
import { WeaverRegistry } from "@/registry/WeaverRegistry";
import { jsx } from "@/jsx/jsx";

async function streamToString(stream: ReadableStream): Promise<string> {
  const reader = stream.getReader();
  let result = "";
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  while (true) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    // eslint-disable-next-line @typescript-eslint/restrict-plus-operands
    result += value;
  }
  return result;
}

describe("Milestone 5: Server Bind Markers", () => {
  test("signal in JSX children produces bind markers and signal definition", async () => {
    const registry = new WeaverRegistry();
    const count = defineSignal(42);

    const app = jsx("div", { children: [count] });
    const weaver = new StreamWeaver({ root: app, registry });
    const html = await streamToString(weaver.readable);

    // Should contain signal definition script
    expect(html).toContain('<script>weaver.push({"kind":"signal-definition","signal":{');
    expect(html).toContain(`"id":"${count.id}"`);
    expect(html).toContain('"kind":"state"');
    expect(html).toContain('"init":42');

    // Should contain bind markers
    expect(html).toContain(`<!--^${count.id}-->`);
    expect(html).toContain(`<!--/${count.id}-->`);

    // Should contain current value between markers
    expect(html).toMatch(new RegExp(`<!--\\^${count.id}-->42<!--/${count.id}-->`));
  });

  test("signal prop as attribute produces data-w-* attribute and signal definition", async () => {
    const registry = new WeaverRegistry();
    const className = defineSignal("active");

    const app = jsx("div", { className, children: ["Hello"] });
    const weaver = new StreamWeaver({ root: app, registry });
    const html = await streamToString(weaver.readable);

    // Should contain signal definition
    expect(html).toContain('<script>weaver.push({"kind":"signal-definition","signal":{');
    expect(html).toContain(`"id":"${className.id}"`);
    expect(html).toContain('"init":"active"');

    // Should contain both current class attribute and data-w-classname
    expect(html).toContain('class="active"');
    expect(html).toContain(`data-w-classname="${className.id}"`);
  });

  test("handler signal as event handler produces data-w-* attribute and signal definition", async () => {
    const registry = new WeaverRegistry();
    // Create a handler signal using the proper pattern
    const clickLogic = defineLogic("/test/handleClick.js");
    const handleClick = defineHandler(clickLogic, []);

    const app = jsx("button", { onClick: handleClick, children: ["Click me"] });
    const weaver = new StreamWeaver({ root: app, registry });
    const html = await streamToString(weaver.readable);

    // Should contain signal definition
    expect(html).toContain('<script>weaver.push({"kind":"signal-definition","signal":{');
    expect(html).toContain(`"id":"${handleClick.id}"`);

    // Should contain data-w-onclick attribute with signal ID
    expect(html).toContain(`data-w-onclick="${handleClick.id}"`);

    // Should NOT contain onClick attribute (only data-w-onclick)
    expect(html).not.toContain("onClick=");
  });

  test("full HTML output with nested signals", async () => {
    const registry = new WeaverRegistry();
    const title = defineSignal("Counter");
    const count = defineSignal(0);
    const className = defineSignal("counter-display");

    const app = jsx("div", {
      children: [jsx("h1", { children: [title] }), jsx("div", { className, children: ["Count: ", count] })],
    });

    const weaver = new StreamWeaver({ root: app, registry });
    const html = await streamToString(weaver.readable);

    // Should contain all signal definitions
    expect(html).toContain(`"id":"${title.id}"`);
    expect(html).toContain(`"id":"${count.id}"`);
    expect(html).toContain(`"id":"${className.id}"`);

    // Should contain bind markers for title and count (in children)
    expect(html).toContain(`<!--^${title.id}-->`);
    expect(html).toContain(`<!--/${title.id}-->`);
    expect(html).toContain(`<!--^${count.id}-->`);
    expect(html).toContain(`<!--/${count.id}-->`);

    // Should contain className attribute and data-w-classname
    expect(html).toContain('class="counter-display"');
    expect(html).toContain(`data-w-classname="${className.id}"`);

    // Should contain current values
    expect(html).toContain("Counter");
    expect(html).toContain("Count: ");
    expect(html).toContain("0");
  });

  test("signal without registry is skipped", async () => {
    const count = defineSignal(42);

    // No registry passed
    const app = jsx("div", { children: [count] });
    const weaver = new StreamWeaver({ root: app });
    const html = await streamToString(weaver.readable);

    // Should not contain signal definition or bind markers
    expect(html).not.toContain("<script>weaver.push");
    expect(html).not.toContain(`<!--^${count.id}-->`);
    expect(html).not.toContain(`<!--/${count.id}-->`);

    // Should just be empty div
    expect(html).toBe("<div></div>");
  });

  test("computed signal serialization", async () => {
    const registry = new WeaverRegistry();
    const { defineComputed } = await import("@/signals/defineComputed");
    const { defineLogic } = await import("@/signals/defineLogic");

    const numA = defineSignal(5);
    const doubleLogic = defineLogic("./tests/fixtures/double.js");
    const doubled = defineComputed(doubleLogic, [numA]);

    const app = jsx("div", { children: [doubled] });
    const weaver = new StreamWeaver({ root: app, registry });
    const html = await streamToString(weaver.readable);

    // Should contain computed signal definition
    expect(html).toContain(`"id":"${doubled.id}"`);
    expect(html).toContain('"kind":"computed"');

    // Should contain logic reference by ID, not embedded object
    expect(html).toContain(`"logic":"${doubleLogic.id}"`);

    // Should contain deps array
    expect(html).toContain(`"deps":["${numA.id}"]`);

    // Should contain bind markers
    expect(html).toContain(`<!--^${doubled.id}-->`);
    expect(html).toContain(`<!--/${doubled.id}-->`);
  });
});
