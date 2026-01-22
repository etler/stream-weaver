import { ComponentElement } from "@/jsx/types/Element";
import { Chunk } from "./types/Chunk";
import { TokenOrExecutable, NodeExecutable, ComputedExecutable } from "./types/Token";

type ChunkItem = Chunk | ComponentElement | NodeExecutable | ComputedExecutable;

export function chunkify(list: (TokenOrExecutable | ComponentElement)[]): ChunkItem[] {
  return list.reduce<ChunkItem[]>((acc, item): ChunkItem[] => {
    // NodeExecutable - keep separate for async processing
    if ("kind" in item && item.kind === "node-executable") {
      acc.push(item);
      return acc;
    }

    // ComputedExecutable - keep separate for async processing
    if ("kind" in item && item.kind === "computed-executable") {
      acc.push(item);
      return acc;
    }

    // Regular Token - group into chunks
    if ("kind" in item) {
      const tail = acc.at(-1);
      if (Array.isArray(tail)) {
        tail.push(item);
      } else {
        acc.push([item]);
      }
    } else {
      // ComponentElement - keep separate for async processing
      acc.push(item);
    }
    return acc;
  }, []);
}
