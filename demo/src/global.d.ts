/**
 * Global type declarations for stream-weaver demo
 */

// Import JSX types from stream-weaver jsx-runtime and re-export globally
import type { JSX as StreamWeaverJSX } from "stream-weaver/jsx-runtime";

declare global {
  namespace JSX {
    type Element = StreamWeaverJSX.Element;
    type ElementType = StreamWeaverJSX.ElementType;
    type IntrinsicElements = StreamWeaverJSX.IntrinsicElements;
  }
}

export {};
