/**
 * BindPoint represents a location in the DOM where a signal is bound
 */
interface ContentBindPoint {
  type: "content";
  id: string;
  range: Range;
}

interface AttributeBindPoint {
  type: "attribute";
  id: string;
  element: Element;
  attribute: string;
}

type BindPoint = ContentBindPoint | AttributeBindPoint;

/**
 * Sink is the client-side DOM updater that handles content and attribute bindings
 */
export class Sink {
  public bindPoints = new Map<string, BindPoint[]>();

  /**
   * Scan a DOM subtree for bind markers and data-w-* attributes
   */
  public scan(root: Node): void {
    this.scanForBindMarkers(root);
    this.scanForAttributeBindings(root);
  }

  /**
   * Update content at all bind points for a given signal ID
   */
  public sync(id: string, html: string): void {
    const points = this.bindPoints.get(id);
    if (!points) {
      return;
    }

    for (const point of points) {
      if (point.type === "content") {
        this.updateContent(point, html);
      }
    }

    // After updating content, rescan the entire document to discover new bind markers
    // Clear existing content bind points and rescan (attributes stay valid)
    this.bindPoints.clear();
    if (typeof document !== "undefined") {
      this.scan(document.body);
    }
  }

  /**
   * Update an attribute at all attribute bind points for a given signal ID
   */
  public syncAttribute(id: string, attribute: string, value: string): void {
    const points = this.bindPoints.get(id);
    if (!points) {
      return;
    }

    for (const point of points) {
      if (point.type === "attribute" && point.attribute === attribute) {
        this.updateAttribute(point, value);
      }
    }
  }

  /**
   * Check if a signal has any bind points in the DOM
   */
  public hasBindPoint(id: string): boolean {
    return this.bindPoints.has(id);
  }

  /**
   * Scan for bind markers (<!--^id--> ... <!--/id-->)
   */
  private scanForBindMarkers(root: Node): void {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_COMMENT);

    const openMarkers = new Map<string, Comment>();

    let currentNode: Node | null = walker.currentNode;
    while (currentNode !== null) {
      if (currentNode.nodeType === Node.COMMENT_NODE) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
        const comment = currentNode as Comment;
        const text = comment.textContent;

        // Check for open marker: <!--^id-->
        if (text !== null && text !== "") {
          const openMatch = /^\^(.+)$/.exec(text);
          if (openMatch !== null) {
            const [, id] = openMatch;
            if (id !== undefined) {
              openMarkers.set(id, comment);
            }
          }

          // Check for close marker: <!--/id-->
          const closeMatch = /^\/(.+)$/.exec(text);
          if (closeMatch !== null) {
            const [, id] = closeMatch;
            if (id !== undefined) {
              const openComment = openMarkers.get(id);
              if (openComment) {
                // Create Range between markers
                const range = document.createRange();
                range.setStartAfter(openComment);
                range.setEndBefore(comment);

                // Store bind point
                const bindPoint: ContentBindPoint = {
                  type: "content",
                  id,
                  range,
                };

                if (!this.bindPoints.has(id)) {
                  this.bindPoints.set(id, []);
                }
                const points = this.bindPoints.get(id);
                if (points) {
                  points.push(bindPoint);
                }

                openMarkers.delete(id);
              }
            }
          }
        }
      }

      currentNode = walker.nextNode();
    }
  }

  /**
   * Scan for data-w-* attributes
   */
  private scanForAttributeBindings(root: Node): void {
    if (root.nodeType !== Node.ELEMENT_NODE) {
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
    const element = root as Element;

    // Check this element's attributes
    for (const attr of Array.from(element.attributes)) {
      const match = /^data-w-(.+)$/.exec(attr.name);
      if (match !== null) {
        const [, attribute] = match;
        if (attribute !== undefined) {
          const id = attr.value;

          const bindPoint: AttributeBindPoint = {
            type: "attribute",
            id,
            element,
            attribute,
          };

          if (!this.bindPoints.has(id)) {
            this.bindPoints.set(id, []);
          }
          const points = this.bindPoints.get(id);
          if (points) {
            points.push(bindPoint);
          }
        }
      }
    }

    // Recursively scan children
    for (const child of Array.from(element.children)) {
      this.scanForAttributeBindings(child);
    }
  }

  /**
   * Update content at a bind point
   */
  private updateContent(point: ContentBindPoint, html: string): void {
    const { range } = point;

    // Delete current content
    range.deleteContents();

    // Create temporary container to parse HTML
    const temp = document.createElement("div");
    temp.innerHTML = html;

    // Insert new content
    const fragment = document.createDocumentFragment();
    while (temp.firstChild) {
      fragment.appendChild(temp.firstChild);
    }
    range.insertNode(fragment);
  }

  /**
   * Update attribute at a bind point
   */
  private updateAttribute(point: AttributeBindPoint, value: string): void {
    const { element, attribute } = point;

    // Map data-w-* attribute name to actual attribute name
    const actualAttribute = attribute === "classname" ? "class" : attribute;

    element.setAttribute(actualAttribute, value);
  }
}
