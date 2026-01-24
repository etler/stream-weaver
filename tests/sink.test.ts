/**
 * @vitest-environment happy-dom
 */
import { describe, test, expect, beforeEach } from "vitest";
import { Sink } from "@/ClientWeaver/Sink";

describe("Milestone 6: Client Sink", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  test("sink discovers bind markers", () => {
    document.body.innerHTML = "<!--^s1-->5<!--/s1-->";
    const sink = new Sink();
    sink.scan(document.body);

    expect(sink.bindPoints.has("s1")).toBe(true);
    expect(sink.bindPoints.get("s1")?.length).toBe(1);
  });

  test("sink updates content on sync", () => {
    document.body.innerHTML = "<!--^s1-->5<!--/s1-->";
    const sink = new Sink();
    sink.scan(document.body);

    sink.sync("s1", "10");
    expect(document.body.textContent?.trim()).toBe("10");
  });

  test("sink updates attributes", () => {
    document.body.innerHTML = '<div class="dark" data-w-classname="s1">Test</div>';
    const sink = new Sink();
    sink.scan(document.body);

    sink.syncAttribute("s1", "classname", "light");
    expect(document.querySelector("div")?.className).toBe("light");
  });

  test("sink handles multiple bind points for same signal", () => {
    document.body.innerHTML = "<div><!--^s1-->5<!--/s1--></div><span><!--^s1-->5<!--/s1--></span>";
    const sink = new Sink();
    sink.scan(document.body);

    sink.sync("s1", "10");
    expect(document.querySelector("div")?.textContent?.trim()).toBe("10");
    expect(document.querySelector("span")?.textContent?.trim()).toBe("10");
  });

  test("sink rescans after update for nested markers", () => {
    document.body.innerHTML = "<!--^c1--><!--^s1-->5<!--/s1--><!--/c1-->";
    const sink = new Sink();
    sink.scan(document.body);

    sink.sync("c1", "<div><!--^s1-->10<!--/s1--></div>");

    // Rescan should discover the new s1 marker
    sink.sync("s1", "20");
    expect(document.body.textContent?.trim()).toBe("20");
  });

  test("sink handles complex HTML with multiple nested elements", () => {
    document.body.innerHTML = `
      <div class="container">
        <h1><!--^title-->Hello<!--/title--></h1>
        <p class="content" data-w-classname="theme"><!--^message-->World<!--/message--></p>
      </div>
    `;
    const sink = new Sink();
    sink.scan(document.body);

    // Update content bindings
    sink.sync("title", "Goodbye");
    sink.sync("message", "Universe");

    // Update attribute binding
    sink.syncAttribute("theme", "classname", "dark-mode");

    expect(document.querySelector("h1")?.textContent).toBe("Goodbye");
    expect(document.querySelector("p")?.textContent).toBe("Universe");
    expect(document.querySelector("p")?.className).toBe("dark-mode");
  });

  test("sink handles attribute bindings for multiple attributes on same element", () => {
    document.body.innerHTML = '<button class="btn" data-w-classname="s1" disabled data-w-disabled="s2">Click</button>';
    const sink = new Sink();
    sink.scan(document.body);

    sink.syncAttribute("s1", "classname", "btn-active");
    sink.syncAttribute("s2", "disabled", "");

    const button = document.querySelector("button");
    expect(button?.className).toBe("btn-active");
    expect(button?.getAttribute("disabled")).toBe("");
  });

  test("sink does not error when syncing non-existent signal", () => {
    document.body.innerHTML = "<!--^s1-->5<!--/s1-->";
    const sink = new Sink();
    sink.scan(document.body);

    expect(() => {
      sink.sync("s999", "test");
      sink.syncAttribute("s999", "class", "test");
    }).not.toThrow();
  });
});
