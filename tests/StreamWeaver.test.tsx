import { StreamWeaver } from "@/index";
import { Node } from "@/ComponentConductor/types/Node";

describe("StreamWeaver", () => {
  it("should instantiate a StreamWeaver", () => {
    const rootNode: Node = { type: 'div', props: {}, children: [] };
    const weaver = new StreamWeaver({ rootNode });
    expect(weaver).toBeDefined();
  });
});
