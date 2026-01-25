import { WeaverRegistry } from "@/registry/WeaverRegistry";
import { SignalToken } from "@/SignalDelegate/types";
import { renderNode } from "@/html";
import type { Node } from "@/jsx/types/Node";
import { PENDING } from "@/signals/pending";
import { Sink } from "./Sink";

/**
 * SinkTransform
 *
 * Transforms SignalToken events into DOM updates via Sink.
 * This is the client-side equivalent of ComponentSerializer.
 *
 * - For node signals: serialize Node → HTML, sync to DOM
 * - For other signals: format value → string, sync to DOM
 */
export class SinkTransform extends TransformStream<SignalToken, SignalToken> {
  constructor(registry: WeaverRegistry, sink: Sink) {
    super({
      transform: (event, controller) => {
        const signal = registry.getSignal(event.id);
        const value = registry.getValue(event.id);

        if (signal?.kind === "node") {
          // Node signals have Node values that need HTML serialization
          // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
          const html = renderNode(value as Node, { registry }) ?? "";
          sink.sync(event.id, html);
        } else {
          // Primitive values - convert to string (PENDING becomes empty)
          // eslint-disable-next-line @typescript-eslint/no-base-to-string
          const text = value === PENDING ? "" : String(value ?? "");
          sink.sync(event.id, text);
        }

        // Pass through for downstream transforms
        controller.enqueue(event);
      },
    });
  }
}
