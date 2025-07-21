import { jsx } from "./jsx";
import { Element as JsxElement } from "./types/Element";

export { jsx as jsxs };
export { jsx as jsxDEV };
export { Fragment } from "./Fragment";

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace JSX {
  export type Element = JsxElement;

  export type ElementType = JsxElement["type"];

  export type IntrinsicElements = Record<string, Record<string, unknown>>;
}
