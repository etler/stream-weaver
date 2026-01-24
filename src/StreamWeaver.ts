import { ComponentDelegate } from "@/ComponentDelegate";
import { ComponentSerializer } from "@/ComponentSerializer";
import { Element } from "@/jsx/types/Element";
import { WeaverRegistry } from "@/registry/WeaverRegistry";

export interface StreamWeaverOptions {
  root: Element | Promise<Element>;
  registry?: WeaverRegistry;
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
    const delegate = new ComponentDelegate(registry);
    const writer = delegate.writable.getWriter();

    // Normalize root to Promise for unified handling
    const rootPromise = root instanceof Promise ? root : Promise.resolve(root);

    rootPromise
      .then(async (resolvedRoot) => writer.write(resolvedRoot))
      .then(async () => writer.close())
      .catch((error: unknown) => {
        console.error(new Error("Error writing root element to stream", { cause: error }));
      });

    this.readable = delegate.readable.pipeThrough(new ComponentSerializer());
  }
}
