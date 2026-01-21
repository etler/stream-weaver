import { ComponentDelegate } from "@/ComponentDelegate/ComponentDelegate";
import { chunkify } from "@/ComponentDelegate/chunkify";
import { tokenize } from "@/ComponentDelegate/tokenize";
import { Token } from "@/ComponentDelegate/types/Token";
import { ComponentSerializer, serializeToken } from "@/ComponentHtmlSerializer/ComponentSerializer";
import { Element } from "@/jsx/types/Element";
import { WeaverRegistry } from "@/registry/WeaverRegistry";

// Buffer target size for fast path (matches ComponentSerializer)
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

    // Tokenize and chunkify to detect if content is static
    const chunks = chunkify(tokenize(root, registry));
    const isStatic = chunks.every((chunk) => Array.isArray(chunk));

    if (isStatic) {
      // Fast path: all chunks are static token arrays
      // Serialize directly without DelegateStream overhead
      this.readable = this.createStaticStream(chunks as Token[][]);
    } else {
      // Slow path: has async components, use DelegateStream
      this.readable = this.createDelegateStream(root, registry);
    }
  }

  /**
   * Fast path for static content - bypasses DelegateStream entirely
   */
  private createStaticStream(chunks: Token[][]): ReadableStream<string> {
    let chunkIndex = 0;
    let buffer = "";
    let firstChunkSent = false;

    return new ReadableStream<string>({
      pull: (controller) => {
        // Process chunks until we have enough to emit or we're done
        while (chunkIndex < chunks.length) {
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          const tokenChunk = chunks[chunkIndex]!;
          chunkIndex++;

          for (const token of tokenChunk) {
            buffer += serializeToken(token);
          }

          // Flush immediately on first content for TTFB
          if (!firstChunkSent && buffer.length > 0) {
            controller.enqueue(buffer);
            buffer = "";
            firstChunkSent = true;
            return;
          }

          // Buffer subsequent content into larger chunks
          if (buffer.length >= BUFFER_TARGET_SIZE) {
            controller.enqueue(buffer);
            buffer = "";
            return;
          }
        }

        // Flush remaining buffer and close
        if (buffer.length > 0) {
          controller.enqueue(buffer);
          buffer = "";
        }
        controller.close();
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
