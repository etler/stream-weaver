import { StreamWeaver } from "@/index";
import { Node } from "@/jsx/types/Node";

describe("StreamWeaver", () => {
  it("should return html", async () => {
    const TestComponent = () => {
      return <div>Hello World!</div>
    }
    const rootNode: Node = <TestComponent></TestComponent>;
    const weaver = new StreamWeaver({ rootNode });
    const result = (await Array.fromAsync(weaver.readable)).join("")
    expect(result).toEqual("<div>Hello World!</div>")
  });
  it("should nest components", async () => {

  });
  it("should run async components", async () => {

  });
  it("should run async components in parallel", async () => {

  });
  it("should run nested async components in parallel", async () => {

  });
});
