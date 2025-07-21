describe("TSX Test Setup", () => {
  it("should compile TSX syntax", () => {
    const element = <div>Hello World</div>;

    // Just verify that TSX compiles and creates a React element
    expect(element).toBeDefined();
    expect(element.type).toBe("div");
    expect(element.props.children).toBe("Hello World");
  });

  it("should handle JSX with props", () => {
    const element = <div className="test-class" id="test-id">Content</div>;

    expect(element.type).toBe("div");
    expect(element.props.className).toBe("test-class");
    expect(element.props.id).toBe("test-id");
    expect(element.props.children).toBe("Content");
  });

  it("should handle nested JSX", () => {
    const element = (
      <div>
        <span>Nested</span>
      </div>
    );

    expect(element.type).toBe("div");
    expect(element.props.children.type).toBe("span");
    expect(element.props.children.props.children).toBe("Nested");
  });
});
