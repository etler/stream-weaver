describe("TSX Test Setup", () => {
  it("should compile TSX syntax", () => {
    const element = <div>Hello World</div>;

    // Just verify that TSX compiles and creates a StreamWeaver element
    expect(element).toBeDefined();
    expect(element.type).toBe("div");
    expect(element.children).toEqual(["Hello World"]);
  });

  it("should handle JSX with props", () => {
    const element = (
      <div className="test-class" id="test-id">
        Content
      </div>
    );

    expect(element.type).toBe("div");
    expect(element.props).toHaveProperty("className", "test-class");
    expect(element.props).toHaveProperty("id", "test-id");
    expect(element.children).toEqual(["Content"]);
  });

  it("should handle nested JSX", () => {
    const element = (
      <div>
        <span>Nested</span>
      </div>
    );

    expect(element.type).toBe("div");
    expect(element.children).toHaveLength(1);
    expect(element.children[0]).toEqual({
      type: "span",
      props: {},
      children: ["Nested"],
    });
  });
});
