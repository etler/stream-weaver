import type { Element } from "./Element";
import type { AnySignal } from "@/signals/types";
import { PENDING } from "@/signals/pending";

export type Node =
  | Node[]
  | Element
  | AnySignal
  | typeof PENDING
  // Serializable
  | string
  | number
  // Ignored
  | boolean
  | null
  | undefined;
