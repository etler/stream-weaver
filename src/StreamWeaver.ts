import { ComponentDelegate } from "@/ComponentDelegate/ComponentDelegate";
import { ComponentSerializer } from "@/ComponentHtmlSerializer/ComponentSerializer";
import { Element } from "@/jsx/types/Element";
import { WeaverRegistry } from "@/registry/WeaverRegistry";

export interface StreamWeaverOptions {
  root: Element | Promise<Element>;
  registry?: WeaverRegistry; // Optional registry for signal binding
}

/**
 * StreamWeaver
 *
 * Server-side streaming renderer that processes JSX through ComponentDelegate.
 * The fast path optimization for sync subtrees is handled inside ComponentDelegate,
 * allowing sync portions to be serialized directly even within async pages.
 */
export class StreamWeaver {
  public readable: ReadableStream<string>;

  constructor({ root, registry }: StreamWeaverOptions) {
    // Handle Promise root by deferring resolution
    if (root instanceof Promise) {
      this.readable = this.createAsyncStream(root, registry);
      return;
    }

    // All content goes through ComponentDelegate which handles fast path internally
    this.readable = this.createDelegateStream(root, registry);
  }

  /**
   * Create a delegate stream for processing content
   * ComponentDelegate handles fast path optimization for sync subtrees internally
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
   * Handle Promise<Element> root - wait for resolution before processing
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
