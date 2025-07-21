import { Node } from "@/ComponentConductor/types/Node";
import type { Component } from "./Component";
import { Fragment } from "@/ComponentConductor/Fragment";

interface BaseElement<Type> {
  type: Type;
  props: Record<string, unknown>;
  children: Node[];
}

export type IntrinsicElement = BaseElement<string>;

export type ComponentElement = BaseElement<Component>;

export type FragmentElement = BaseElement<typeof Fragment>;

export type Element = IntrinsicElement | ComponentElement | FragmentElement;
