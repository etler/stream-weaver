import { ComponentConductor } from "@/ComponentConductor/ComponentConductor";
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
 *   [ ] Hydration Conductor
 *   [x] Component Conductor
 *   [ ] Fallback Component Conductor
 * [ ] Server Stream HTML Serializer
 *   [ ] Hydration Stream HTML Serializer
 *   [x] Component Stream HTML Serializer
 *   [ ] Fallback Component Stream HTML Serializer
 * [x] Browser Stream Deserializer (Inherent)
 * [ ] Browser Client Weaver
 *   [ ] Interaction Conductor
 *   [ ] State Conductor
 *   [ ] Component Conductor
 *   [ ] Component Stream DOM serializer
 *   [ ] Lifecycle Conductor
 *
 */
export class StreamWeaver {
  public readable: ReadableStream;
  constructor({ root }: StreamWeaverOptions) {
    const conductor = new ComponentConductor();
    const writer = conductor.writable.getWriter();
    this.readable = conductor.readable.pipeThrough(new ComponentSerializer());
    (async () => {
      await writer.write(await root);
      await writer.close();
    })().catch((error: unknown) => {
      console.error(new Error("Error Writing `rootNode` to output stream", { cause: error }));
    });
  }
}
