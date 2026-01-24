import { SuspenseSignal } from "./types";
import { allocateSourceId } from "./idAllocation";

/**
 * Creates a SuspenseSignal that shows fallback content while children contain PENDING signals
 *
 * @param fallback - Content to show while children are loading
 * @param children - Children content that may contain PENDING signals
 * @returns SuspenseSignal for use in JSX
 *
 * @example
 * ```tsx
 * <Suspense fallback={<Loading />}>
 *   <AsyncContent data={pendingSignal} />
 * </Suspense>
 * ```
 */
export function defineSuspense(fallback: unknown, children: unknown): SuspenseSignal {
  return {
    id: allocateSourceId(),
    kind: "suspense",
    fallback,
    children,
    pendingDeps: [],
  };
}
