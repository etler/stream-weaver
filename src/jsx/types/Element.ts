import { Node } from "./Node";
import type { Component } from "./Component";
import { Fragment } from "../Fragment";

interface BaseElement<Type, Props, Children extends Node[]> {
  type: Type;
  props: Props;
  children: Children;
}

export type IntrinsicElement<Props = unknown> = BaseElement<string, Props, Node[]>;

export type FragmentElement = BaseElement<typeof Fragment, void, Node[]>;

export type ComponentElement<Props = unknown> = BaseElement<Component<Props>, Props, []>;

export type Element<Props = unknown> = ComponentElement<Props> | IntrinsicElement<Props> | FragmentElement;
