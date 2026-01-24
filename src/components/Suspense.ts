import { createSuspense } from "@/signals/defineSuspense";
import type { SuspenseSignal } from "@/signals/types";
import type { Node } from "@/jsx/types/Node";

/**
 * Props for the Suspense component
 */
export interface SuspenseProps {
  /** Content to show while children are loading */
  fallback: Node;
  /** Children that may contain PENDING signals */
  children?: Node;
}

/**
 * Suspense component that shows fallback content while children contain PENDING signals
 *
 * React-style API: wrap children with Suspense and provide a fallback prop.
 * When any signal in children has a PENDING value, the fallback is shown.
 * Once all signals resolve, the children are rendered.
 *
 * @example
 * ```tsx
 * import { Suspense } from "stream-weaver";
 *
 * <Suspense fallback={<Loading />}>
 *   <AsyncContent data={pendingSignal} />
 * </Suspense>
 * ```
 */
export function Suspense(props: SuspenseProps): SuspenseSignal {
  return createSuspense(props.fallback, props.children ?? null);
}
