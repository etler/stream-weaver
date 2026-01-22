import { AnySignal, NodeSignal, LogicSignal, ComponentSignal, ComputedSignal } from "@/signals/types";

export interface OpenTagToken {
  kind: "open";
  tag: string;
  attributes: Record<string, string | null>;
}

export interface CloseTagToken {
  kind: "close";
  tag: string;
}

export interface TextToken {
  kind: "text";
  content: string;
}

export interface BindMarkerOpenToken {
  kind: "bind-marker-open";
  id: string; // Signal ID
}

export interface BindMarkerCloseToken {
  kind: "bind-marker-close";
  id: string; // Signal ID
}

export interface SignalDefinitionToken {
  kind: "signal-definition";
  signal: AnySignal; // Signal definition to serialize
}

/**
 * NodeExecutable represents a component node that needs to be executed
 * Contains all the information needed to load and run the component
 */
export interface NodeExecutable {
  kind: "node-executable";
  node: NodeSignal;
  logic: LogicSignal;
  component: ComponentSignal;
}

/**
 * ComputedExecutable represents a computed signal with server-context logic
 * that needs to be executed asynchronously during SSR
 */
export interface ComputedExecutable {
  kind: "computed-executable";
  computed: ComputedSignal;
  logic: LogicSignal;
}

export type Token =
  | OpenTagToken
  | CloseTagToken
  | TextToken
  | BindMarkerOpenToken
  | BindMarkerCloseToken
  | SignalDefinitionToken;

export type TokenOrExecutable = Token | NodeExecutable | ComputedExecutable;
