import { ComponentElement } from "@/jsx/types/Element";
import { Chunk } from "./types/Chunk";
import { Token } from "./types/Token";

type ChunkItem = Chunk | ComponentElement;

export function chunkify(list: (Token | ComponentElement)[]): ChunkItem[] {
  return list.reduce<ChunkItem[]>((list, item): ChunkItem[] => {
    if ("kind" in item) {
      const tail = list.at(-1);
      if (Array.isArray(tail)) {
        tail.push(item);
      } else {
        list.push([item]);
      }
    } else {
      list.push(item);
    }
    return list;
  }, []);
}
