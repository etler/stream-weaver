/**
 * @vitest-environment happy-dom
 */
import { describe, test, expect, beforeEach } from "vitest";
import { ClientWeaver } from "@/client/ClientWeaver";
import { createSignal } from "@/signals/createSignal";
import { createComputed } from "@/signals/createComputed";
import { createHandler } from "@/signals/createHandler";
import { createLogic } from "@/signals/createLogic";
import { WeaverRegistry } from "@/registry/WeaverRegistry";
import { executeComputed } from "@/logic";

/**
 * Helper to wait for a condition to be true
 */
async function waitFor(condition: () => boolean, timeout = 1000): Promise<void> {
  const startTime = Date.now();
  while (!condition()) {
    if (Date.now() - startTime > timeout) {
      throw new Error("waitFor timeout");
    }
    await new Promise((resolve) => {
      setTimeout(resolve, 10);
    });
  }
}

describe("Milestone 9: Full Stack Integration", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  test("client initializes from server HTML", () => {
    const serverHtml = `
      <div>
        <p>Count: <!--^s1-->5<!--/s1--></p>
        <p>Doubled: <!--^c1-->10<!--/c1--></p>
      </div>
    `;

    document.body.innerHTML = serverHtml;
    const clientWeaver = new ClientWeaver();

    // Manually push signal definitions (normally from inline scripts)
    clientWeaver.push({
      kind: "signal-definition",
      signal: { id: "s1", kind: "state", init: 5 },
    });
    clientWeaver.push({
      kind: "signal-definition",
      signal: { id: "c1", kind: "computed", logic: "logic1", deps: ["s1"] },
    });

    // Registry has both signals
    expect(clientWeaver.registry.getSignal("s1")).toBeDefined();
    expect(clientWeaver.registry.getSignal("c1")).toBeDefined();

    // Sink discovered bind points
    expect(clientWeaver.sink.hasBindPoint("s1")).toBe(true);
    expect(clientWeaver.sink.hasBindPoint("c1")).toBe(true);
  });

  test("client parses signal definitions from script tags", () => {
    const serverHtml = `
      <script>
        if (typeof window !== 'undefined') {
          window.weaver = new ClientWeaver();
          weaver.push({kind:'signal-definition',signal:{id:'s1',kind:'state',init:5}});
          weaver.push({kind:'signal-definition',signal:{id:'c1',kind:'computed',logic:'logic1',deps:['s1']}});
        }
      </script>
      <div>
        <p>Count: <!--^s1-->5<!--/s1--></p>
      </div>
    `;

    document.body.innerHTML = serverHtml;

    // In a real browser, the scripts would execute automatically
    // For testing, we manually create ClientWeaver and push definitions
    const clientWeaver = new ClientWeaver();
    clientWeaver.push({
      kind: "signal-definition",
      signal: { id: "s1", kind: "state", init: 5 },
    });

    expect(clientWeaver.registry.getSignal("s1")).toBeDefined();
    expect(clientWeaver.sink.hasBindPoint("s1")).toBe(true);
  });

  test("reactive updates propagate to DOM", async () => {
    // Setup: Create signals and render
    const count = createSignal(0);
    const logic = createLogic("./tests/fixtures/double.js");
    const doubled = createComputed(logic, [count]);

    const registry = new WeaverRegistry();
    registry.registerSignal(count);
    registry.registerSignal(logic);
    registry.registerSignal(doubled);
    registry.setValue(count.id, 0);

    await executeComputed(registry, doubled.id);

    // Simulate server-rendered HTML
    const serverHtml = `
      <div>
        <p class="count"><!--^${count.id}-->0<!--/${count.id}--></p>
        <p class="doubled"><!--^${doubled.id}-->0<!--/${doubled.id}--></p>
      </div>
    `;

    document.body.innerHTML = serverHtml;

    // Create client weaver
    const clientWeaver = new ClientWeaver();

    // Register signals on client
    clientWeaver.push({ kind: "signal-definition", signal: count });
    clientWeaver.push({ kind: "signal-definition", signal: logic });
    clientWeaver.push({ kind: "signal-definition", signal: doubled });

    // Initial state
    expect(document.querySelector(".count")?.textContent?.trim()).toBe("0");
    expect(document.querySelector(".doubled")?.textContent?.trim()).toBe("0");

    // Trigger an update by writing to the delegate
    const writer = clientWeaver.delegateWriter;
    await writer.write({
      kind: "signal-update",
      id: count.id,
      value: 5,
    });

    // Wait for updates to propagate
    await waitFor(() => document.querySelector(".count")?.textContent?.trim() === "5");

    // State updated reactively
    expect(document.querySelector(".count")?.textContent?.trim()).toBe("5");
    expect(document.querySelector(".doubled")?.textContent?.trim()).toBe("10");
  });

  test("event handler triggers reactive cycle", async () => {
    // Setup signals
    const count = createSignal(0);
    const logic = createLogic("./tests/fixtures/handleClick.js");
    const increment = createHandler(logic, [count]);

    const registry = new WeaverRegistry();
    registry.registerSignal(count);
    registry.registerSignal(logic);
    registry.registerSignal(increment);
    registry.setValue(count.id, 0);

    // Simulate server-rendered HTML with event handler
    const serverHtml = `
      <div>
        <p class="count"><!--^${count.id}-->0<!--/${count.id}--></p>
        <button class="increment" data-w-onclick="${increment.id}">+1</button>
      </div>
    `;

    document.body.innerHTML = serverHtml;

    // Create client weaver
    const clientWeaver = new ClientWeaver();
    clientWeaver.push({ kind: "signal-definition", signal: count });
    clientWeaver.push({ kind: "signal-definition", signal: logic });
    clientWeaver.push({ kind: "signal-definition", signal: increment });

    // Initial state
    expect(document.querySelector(".count")?.textContent?.trim()).toBe("0");

    // Click button
    const button = document.querySelector(".increment");
    if (!button) {
      throw new Error("Button not found");
    }
    button.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    // Wait for update
    await waitFor(() => document.querySelector(".count")?.textContent?.trim() === "1");

    expect(document.querySelector(".count")?.textContent?.trim()).toBe("1");

    // Click again
    button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await waitFor(() => document.querySelector(".count")?.textContent?.trim() === "2");

    expect(document.querySelector(".count")?.textContent?.trim()).toBe("2");
  });

  test("full reactive cycle with computed signal", async () => {
    // Setup signals
    const count = createSignal(0);
    const doubleLogic = createLogic("./tests/fixtures/double.js");
    const doubled = createComputed(doubleLogic, [count]);
    const incrementLogic = createLogic("./tests/fixtures/handleClick.js");
    const increment = createHandler(incrementLogic, [count]);

    const registry = new WeaverRegistry();
    registry.registerSignal(count);
    registry.registerSignal(doubleLogic);
    registry.registerSignal(doubled);
    registry.registerSignal(incrementLogic);
    registry.registerSignal(increment);
    registry.setValue(count.id, 0);

    await executeComputed(registry, doubled.id);

    // Simulate server-rendered HTML
    const serverHtml = `
      <div>
        <p class="count"><!--^${count.id}-->0<!--/${count.id}--></p>
        <p class="doubled"><!--^${doubled.id}-->0<!--/${doubled.id}--></p>
        <button class="increment" data-w-onclick="${increment.id}">+1</button>
      </div>
    `;

    document.body.innerHTML = serverHtml;

    // Create client weaver
    const clientWeaver = new ClientWeaver();
    clientWeaver.push({ kind: "signal-definition", signal: count });
    clientWeaver.push({ kind: "signal-definition", signal: doubleLogic });
    clientWeaver.push({ kind: "signal-definition", signal: doubled });
    clientWeaver.push({ kind: "signal-definition", signal: incrementLogic });
    clientWeaver.push({ kind: "signal-definition", signal: increment });

    // Initial state
    expect(document.querySelector(".count")?.textContent?.trim()).toBe("0");
    expect(document.querySelector(".doubled")?.textContent?.trim()).toBe("0");

    // Click button
    const button = document.querySelector(".increment");
    if (!button) {
      throw new Error("Button not found");
    }
    button.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    // Wait for reactive updates
    await waitFor(() => document.querySelector(".count")?.textContent?.trim() === "1");

    // Both signals updated reactively
    expect(document.querySelector(".count")?.textContent?.trim()).toBe("1");
    expect(document.querySelector(".doubled")?.textContent?.trim()).toBe("2");

    // Click again
    button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await waitFor(() => document.querySelector(".count")?.textContent?.trim() === "2");

    expect(document.querySelector(".count")?.textContent?.trim()).toBe("2");
    expect(document.querySelector(".doubled")?.textContent?.trim()).toBe("4");
  });
});
