import { chunkify } from "@/ComponentDelegate/chunkify";
import { tokenize } from "@/ComponentDelegate/tokenize";
import { Token } from "@/ComponentDelegate/types/Token";
import { DelegateStream } from "delegate-stream";
import { Node } from "@/jsx/types/Node";

export class ComponentDelegate extends DelegateStream<Node, Token> {
  constructor() {
    super({
      transform: (node, chain) => {
        const chunks = chunkify(tokenize(node));
        for (const chunk of chunks) {
          if (Array.isArray(chunk)) {
            chain(chunk);
          } else {
            const delegate = new ComponentDelegate();
            const writer = delegate.writable.getWriter();
            chain(delegate.readable);
            (async () => {
              const { type, props } = chunk;
              const node = await type(props);
              await writer.write(node);
              await writer.close();
            })().catch((error: unknown) => {
              console.error(new Error("Component Render Error", { cause: error }));
              // Add error component recover and reconciliation later
            });
          }
        }
      },
      finish: (chain) => {
        chain(null);
      },
    });
  }
}
