import { Node } from "./Node";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Component<Props = any> = (props: Props) => Node | Promise<Node>;
