import { Token } from "@/ComponentDelegate/types/Token";
import { serializeToken } from "@/ComponentSerializer/serialize";

// Buffer target size for chunks after the first one
const BUFFER_TARGET_SIZE = 2048;

export class ComponentSerializer extends TransformStream<Token, string> {
  constructor() {
    let buffer = "";
    let firstChunkSent = false;

    super({
      transform: (token, controller) => {
        const serialized = serializeToken(token);
        buffer += serialized;

        if (!firstChunkSent) {
          // Flush immediately on first content to optimize TTFB
          controller.enqueue(buffer);
          buffer = "";
          firstChunkSent = true;
        } else if (buffer.length >= BUFFER_TARGET_SIZE) {
          // Buffer subsequent content into larger chunks for HTTP efficiency
          controller.enqueue(buffer);
          buffer = "";
        }
      },
      flush: (controller) => {
        if (buffer.length > 0) {
          controller.enqueue(buffer);
        }
      },
    });
  }
}
