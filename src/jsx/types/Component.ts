import { Node } from "./Node";

export type Component = (props: Record<string, unknown>) => Node | Promise<Node>;
