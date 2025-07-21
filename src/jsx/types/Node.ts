import type { Element } from "./Element";

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
