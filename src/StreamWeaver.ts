import { ComponentDelegate } from "@/ComponentDelegate/ComponentDelegate";
import { ComponentSerializer } from "@/ComponentHtmlSerializer/ComponentSerializer";
import { Element } from "@/jsx/types/Element";

export interface StreamWeaverOptions {
  root: Element | Promise<Element>;
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
  public readable: ReadableStream;
  constructor({ root }: StreamWeaverOptions) {
    const delegate = new ComponentDelegate();
    const writer = delegate.writable.getWriter();
    this.readable = delegate.readable.pipeThrough(new ComponentSerializer());
    (async () => {
      await writer.write(await root);
      await writer.close();
    })().catch((error: unknown) => {
      console.error(new Error("Error Writing `rootNode` to output stream", { cause: error }));
    });
  }
}
