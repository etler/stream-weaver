import { chunkify } from "@/ComponentConductor/chunkify";
import { tokenize } from "@/ComponentConductor/tokenize";
import { Token } from "@/ComponentConductor/types/Token";
import { ConductorStream } from "@/lib/ConductorStream";
import { Node } from "@/jsx/types/Node";

export class ComponentConductor extends ConductorStream<Node, Token> {
  constructor() {
    super({
      transform: (node, chain) => {
        const chunks = chunkify(tokenize(node));
        for (const chunk of chunks) {
          if (Array.isArray(chunk)) {
            chain(chunk);
          } else {
            const conductor = new ComponentConductor();
            const writer = conductor.writable.getWriter();
            chain(conductor.readable);
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
