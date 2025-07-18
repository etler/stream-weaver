import { StreamWeaver } from "@/index";

describe("StreamWeaver", () => {
  it("should instantiate a StreamWeaver", () => {
    const weaver = new StreamWeaver();
    expect(weaver).toBeDefined();
  });
});
