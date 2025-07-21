import { Node } from "./Node";

export type Component<Props = unknown> = (props: Props) => Node | Promise<Node>;
