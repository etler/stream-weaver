import type { Element as JsxElement } from "./types/Element";
import type { ComponentSignal } from "../signals/types";

declare global {
  namespace JSX {
    type Element = JsxElement;
    // ElementType allows: string tags, Component functions, and ComponentSignals
    // Using any for Component to allow flexible props typing
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    type ElementType = string | ((props: any) => any) | ComponentSignal;
    type IntrinsicElements = Record<string, Record<string, unknown>>;
  }
}

export {};
