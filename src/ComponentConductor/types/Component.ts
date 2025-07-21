import { Node } from "@/ComponentConductor/types/Node";

export type Component = (props: Record<string, unknown>) => Node | Promise<Node>;
