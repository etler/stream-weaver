import type { Element } from "@/ComponentConductor/types/Element";

export type Node =
  | Node[]
  | Element
  // Serializable
  | string
  | number
  // Ignored
  | boolean
  | null
  | undefined;
