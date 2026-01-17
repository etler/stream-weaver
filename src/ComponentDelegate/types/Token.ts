import { AnySignal } from "@/signals/types";

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

export type Token =
  | OpenTagToken
  | CloseTagToken
  | TextToken
  | BindMarkerOpenToken
  | BindMarkerCloseToken
  | SignalDefinitionToken;
