import { Node } from "./Node";
import type { Component } from "./Component";
import { Fragment } from "../Fragment";

interface BaseElement<Type, Props, Children extends Node[]> {
  type: Type;
  props: Props;
  children: Children;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type IntrinsicElement<Props = any> = BaseElement<string, Props, Node[]>;

export type FragmentElement = BaseElement<typeof Fragment, void, Node[]>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ComponentElement<Props = any> = BaseElement<Component<Props>, Props, []>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Element<Props = any> = ComponentElement<Props> | IntrinsicElement<Props> | FragmentElement;
