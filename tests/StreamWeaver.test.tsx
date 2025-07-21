import { StreamWeaver } from "@/index";
import { Component } from "@/jsx/types/Component";

describe("StreamWeaver", () => {
  it("should render a component", async () => {
    const TestComponent: Component = () => {
      return <div>Hello World!</div>;
    };
    const root = <TestComponent></TestComponent>;
    const weaver = new StreamWeaver({ root });
    const result = (await Array.fromAsync(weaver.readable)).join("");
    expect(result).toEqual("<div>Hello World!</div>");
  });
  it("should render nested components", async () => {
    await wait(0);
  });
  it("should render an async component", async () => {
    await wait(0);
  });
  it("should render async components in sequence and in parallel", async () => {
    await wait(0);
  });
  it("should render nested async components in sequence and in parallel", async () => {
    await wait(0);
  });
});

const wait = async (timeout: number) =>
  new Promise((resolve) =>
    setTimeout(() => {
      resolve(undefined);
    }, timeout),
  );
