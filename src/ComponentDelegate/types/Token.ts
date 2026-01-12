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

export type Token = OpenTagToken | CloseTagToken | TextToken;
