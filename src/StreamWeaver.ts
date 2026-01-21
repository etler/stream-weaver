import { ComponentDelegate } from "@/ComponentDelegate/ComponentDelegate";
import { ComponentSerializer } from "@/ComponentHtmlSerializer/ComponentSerializer";
import { serializeElement } from "@/ComponentHtmlSerializer/serializeElement";
import { Element } from "@/jsx/types/Element";
import { WeaverRegistry } from "@/registry/WeaverRegistry";

// Buffer target size for fast path
const BUFFER_TARGET_SIZE = 2048;

export interface StreamWeaverOptions {
  root: Element | Promise<Element>;
  registry?: WeaverRegistry; // Optional registry for signal binding
}

/**
 * StreamWeaver
 *
 * Proof of Concept Scope
 *
 * [ ] Server Weaver
 *   [ ] Hydration Delegate
 *   [x] Component Delegate
 *   [ ] Fallback Component Delegate
 * [ ] Server Stream HTML Serializer
 *   [ ] Hydration Stream HTML Serializer
 *   [x] Component Stream HTML Serializer
 *   [ ] Fallback Component Stream HTML Serializer
 * [x] Browser Stream Deserializer (Inherent)
 * [ ] Browser Client Weaver
 *   [ ] Interaction Delegate
 *   [ ] State Delegate
 *   [ ] Component Delegate
 *   [ ] Component Stream DOM serializer
 *   [ ] Lifecycle Delegate
 *
 * Goals:
 * No Magic, lead devs to write valid code via rails
 * Serializable streams with isomorphic reducers to a dom/state sink
 *
 */
export class StreamWeaver {
  public readable: ReadableStream<string>;
  constructor({ root, registry }: StreamWeaverOptions) {
    // Handle Promise root by deferring to async path
    if (root instanceof Promise) {
      this.readable = this.createAsyncStream(root, registry);
      return;
    }

    // Try direct serialization (returns null if content has async components)
    const html = serializeElement(root, registry);

    if (html !== null) {
      // Fast path: direct serialization succeeded
      this.readable = this.createDirectStream(html);
    } else {
      // Slow path: has async components, use DelegateStream
      this.readable = this.createDelegateStream(root, registry);
    }
  }

  /**
   * Fast path for static content - direct string output
   */
  private createDirectStream(html: string): ReadableStream<string> {
    let offset = 0;
    let firstChunkSent = false;

    return new ReadableStream<string>({
      pull: (controller) => {
        if (offset >= html.length) {
          controller.close();
          return;
        }

        // Flush immediately on first chunk for TTFB
        if (!firstChunkSent) {
          const firstChunk = html.slice(0, BUFFER_TARGET_SIZE);
          controller.enqueue(firstChunk);
          offset = firstChunk.length;
          firstChunkSent = true;
          return;
        }

        // Emit subsequent chunks
        const chunk = html.slice(offset, offset + BUFFER_TARGET_SIZE);
        controller.enqueue(chunk);
        offset += chunk.length;
      },
    });
  }

  /**
   * Slow path using DelegateStream for async component support
   */
  private createDelegateStream(root: Element, registry?: WeaverRegistry): ReadableStream<string> {
    const delegate = new ComponentDelegate(registry);
    const writer = delegate.writable.getWriter();

    writer
      .write(root)
      // eslint-disable-next-line @typescript-eslint/promise-function-async
      .then(() => writer.close())
      .catch((error: unknown) => {
        console.error(new Error("Error Writing `rootNode` to output stream", { cause: error }));
      });

    return delegate.readable.pipeThrough(new ComponentSerializer());
  }

  /**
   * Handle Promise<Element> root - must use async path
   */
  private createAsyncStream(root: Promise<Element>, registry?: WeaverRegistry): ReadableStream<string> {
    const delegate = new ComponentDelegate(registry);
    const writer = delegate.writable.getWriter();

    root
      // eslint-disable-next-line @typescript-eslint/promise-function-async
      .then((resolvedRoot) => writer.write(resolvedRoot))
      // eslint-disable-next-line @typescript-eslint/promise-function-async
      .then(() => writer.close())
      .catch((error: unknown) => {
        console.error(new Error("Error Writing `rootNode` to output stream", { cause: error }));
      });

    return delegate.readable.pipeThrough(new ComponentSerializer());
  }
}
