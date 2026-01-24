import { jsx } from "./jsx";
import { Element as JsxElement } from "./types/Element";
import type { ComponentSignal } from "@/signals/types";

export { jsx };
export { jsx as jsxs };
export { jsx as jsxDEV };
export { Fragment } from "./Fragment";

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace JSX {
  export type Element = JsxElement;

  // ElementType includes ComponentSignal so it can be used as <ComponentSignal ... />
  export type ElementType = JsxElement["type"] | ComponentSignal;

  export type IntrinsicElements = Record<string, Record<string, unknown>>;
}
