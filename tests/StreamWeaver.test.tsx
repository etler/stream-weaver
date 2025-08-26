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
    const ChildComponent: Component = () => {
      return <span>Child Content</span>;
    };

    const ParentComponent: Component = () => {
      return (
        <div>
          <h1>Parent</h1>
          <ChildComponent />
        </div>
      );
    };

    const root = <ParentComponent />;
    const weaver = new StreamWeaver({ root });
    const result = (await Array.fromAsync(weaver.readable)).join("");
    expect(result).toEqual("<div><h1>Parent</h1><span>Child Content</span></div>");
  });

  it("should render an async component", async () => {
    const AsyncComponent: Component = async () => {
      await wait(10);
      return <div>Async Content</div>;
    };

    const root = <AsyncComponent />;
    const weaver = new StreamWeaver({ root });
    const result = (await Array.fromAsync(weaver.readable)).join("");
    expect(result).toEqual("<div>Async Content</div>");
  });

  it("should render async components in sequence and in parallel", async () => {
    const renderOrder: number[] = [];

    const AsyncComponent1: Component = async () => {
      await wait(20);
      renderOrder.push(1);
      return <div>Component 1</div>;
    };

    const AsyncComponent2: Component = async () => {
      await wait(10);
      renderOrder.push(2);
      return <div>Component 2</div>;
    };

    const AsyncComponent3: Component = async () => {
      await wait(5);
      renderOrder.push(3);
      return <div>Component 3</div>;
    };

    const Main: Component = () => {
      return (
        <div>
          <AsyncComponent1 />
          <AsyncComponent2 />
          <AsyncComponent3 />
        </div>
      );
    };

    const root = <Main />;

    const startTime = Date.now();
    const weaver = new StreamWeaver({ root });
    const result = (await Array.fromAsync(weaver.readable)).join("");
    const endTime = Date.now();

    // Verify parallel execution - should complete in ~20ms, not 35ms (sequential)
    const totalTime = endTime - startTime;
    expect(totalTime).toBeLessThan(30); // Some margin for test timing

    // Verify components render in original order despite different timing
    expect(result).toEqual("<div><div>Component 1</div><div>Component 2</div><div>Component 3</div></div>");

    // Verify components completed in parallel (fastest first)
    expect(renderOrder).toEqual([3, 2, 1]);
  });

  it("should render nested async components in sequence and in parallel", async () => {
    const renderOrder: number[] = [];

    const FastChild: Component = async () => {
      await wait(5);
      renderOrder.push(1);
      return <span>Fast Child</span>;
    };

    const SlowChild: Component = async () => {
      await wait(15);
      renderOrder.push(2);
      return <span>Slow Child</span>;
    };

    const AsyncParent1: Component = async () => {
      await wait(10);
      renderOrder.push(3);
      return (
        <div>
          Parent 1
          <FastChild />
        </div>
      );
    };

    const AsyncParent2: Component = async () => {
      await wait(8);
      renderOrder.push(4);
      return (
        <div>
          Parent 2
          <SlowChild />
        </div>
      );
    };

    const Main: Component = () => {
      return (
        <main>
          <AsyncParent1 />
          <AsyncParent2 />
        </main>
      );
    };

    const root = <Main />;

    const startTime = Date.now();
    const weaver = new StreamWeaver({ root });
    const result = (await Array.fromAsync(weaver.readable)).join("");
    const endTime = Date.now();

    // Verify parallel execution at all levels
    const totalTime = endTime - startTime;
    expect(totalTime).toBeLessThan(30); // Should complete in ~15ms (slowest child), not 38ms (sequential)

    // Verify output maintains component tree order
    expect(result).toEqual(
      "<main><div>Parent 1<span>Fast Child</span></div><div>Parent 2<span>Slow Child</span></div></main>",
    );

    // Verify execution order shows parallel processing
    // Parent2 (8ms) completes first, then Parent1 (10ms), then their children execute in parallel
    // FastChild (5ms) completes before SlowChild (15ms)
    expect(renderOrder).toEqual([4, 3, 1, 2]);
  });
});

const wait = async (timeout: number) =>
  new Promise((resolve) =>
    setTimeout(() => {
      resolve(undefined);
    }, timeout),
  );
