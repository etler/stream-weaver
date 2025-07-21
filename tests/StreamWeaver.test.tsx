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
});
