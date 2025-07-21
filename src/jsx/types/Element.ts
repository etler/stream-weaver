import { Node } from "./Node";
import type { Component } from "./Component";
import { Fragment } from "../Fragment";

interface BaseElement<Type> {
  type: Type;
  props: Record<string, unknown>;
}

interface StaticElement<Type> extends BaseElement<Type> {
  children: Node[];
}

export type ComponentElement = BaseElement<Component>;

export type IntrinsicElement = StaticElement<string>;

export type FragmentElement = StaticElement<typeof Fragment>;

export type Element = ComponentElement | IntrinsicElement | FragmentElement;
