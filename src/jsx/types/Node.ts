import type { Element } from "./Element";
import type { AnySignal } from "@/signals/types";

export type Node =
  | Node[]
  | Element
  | AnySignal
  // Serializable
  | string
  | number
  // Ignored
  | boolean
  | null
  | undefined;
