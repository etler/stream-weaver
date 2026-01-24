/**
 * Example: Suspense Component
 *
 * Demonstrates the Suspense component for handling loading states:
 * - Wraps children that may contain PENDING signals
 * - Shows fallback content while children are loading
 * - Automatically swaps to children when all signals resolve
 *
 * USE CASES:
 * - Loading states for async data
 * - Skeleton screens while fetching
 * - Graceful handling of slow network requests
 */
import {
  defineSignal,
  defineComputed,
  defineHandler,
  defineLogic,
  defineMutator,
  defineComponent,
  defineNode,
  Suspense,
} from "stream-weaver";

// --- Deferred Data Signals ---

// Counter for manual refresh (defined first so computed signals can depend on it)
const refreshCount = defineSignal(0);
const setRefreshCount = defineMutator(refreshCount);

// User data with deferred execution (timeout: 0 = always defer)
// Depends on refreshCount to trigger re-fetch when button is clicked
const userLogic = defineLogic(import("../logic/fetchUserDeferred"), { timeout: 0 });
const userData = defineComputed(userLogic, [refreshCount]);

// Posts data with deferred execution
const postsLogic = defineLogic(import("../logic/fetchPostsDeferred"), { timeout: 0 });
const postsData = defineComputed(postsLogic, [refreshCount]);

// Refresh handler - increments counter to trigger refetch (use mutator for write access)
const refreshLogic = defineLogic(import("../logic/incrementRefresh"));
const onRefresh = defineHandler(refreshLogic, [setRefreshCount]);

// Loading skeleton as a ComponentSignal so it can be executed client-side
const LoadingSkeletonLogic = defineLogic(import("../components/LoadingSkeleton"));
const LoadingSkeletonComponent = defineComponent(LoadingSkeletonLogic);

/**
 * User card that displays user data
 */
function UserCard(): JSX.Element {
  return (
    <div style="background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
      <h3 style="margin: 0 0 0.5rem 0; color: #333;">User Profile</h3>
      <pre style="margin: 0; font-size: 0.9rem; color: #666;">{userData}</pre>
    </div>
  );
}

/**
 * Posts list that displays posts data
 */
function PostsList(): JSX.Element {
  return (
    <div style="background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
      <h3 style="margin: 0 0 0.5rem 0; color: #333;">Recent Posts</h3>
      <pre style="margin: 0; font-size: 0.9rem; color: #666;">{postsData}</pre>
    </div>
  );
}

/**
 * Root component for the demo
 */
export function SuspenseExample(): JSX.Element {
  return (
    <div style="padding: 1rem; background: #f1f5f9; min-height: 100vh;">
      <style>
        {`
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
          }
        `}
      </style>

      <h1 style="text-align: center; color: #333;">Suspense Demo</h1>
      <p style="text-align: center; color: #666; max-width: 500px; margin: 0 auto 2rem auto;">
        Suspense shows fallback content while children are loading. Once all PENDING signals resolve, the actual content
        is displayed.
      </p>

      <div style="background: #fef3c7; padding: 1rem; border-radius: 8px; margin-bottom: 2rem; max-width: 500px; margin-left: auto; margin-right: auto;">
        <strong>How it works:</strong>
        <ul style="margin: 0.5rem 0 0 0; padding-left: 1.5rem; font-size: 0.9rem;">
          <li>
            Data fetching uses <code>timeout: 0</code> (always defer)
          </li>
          <li>
            Signals start with <code>PENDING</code> value
          </li>
          <li>Suspense detects PENDING and shows fallback</li>
          <li>When data arrives, content swaps in</li>
        </ul>
      </div>

      <div style="max-width: 500px; margin: 0 auto;">
        {/* Hidden refresh count to ensure it's serialized */}
        <span style="display: none;">{refreshCount}</span>

        <h2 style="color: #333; font-size: 1.2rem;">User Profile (with Suspense)</h2>
        <div style="margin-bottom: 1.5rem;">
          <Suspense fallback={<LoadingSkeletonComponent />}>
            <UserCard />
          </Suspense>
        </div>

        <h2 style="color: #333; font-size: 1.2rem;">Posts List (with Suspense)</h2>
        <div style="margin-bottom: 1.5rem;">
          <Suspense fallback={<LoadingSkeletonComponent />}>
            <PostsList />
          </Suspense>
        </div>

        <div style="text-align: center; margin-top: 2rem;">
          <button
            onClick={onRefresh}
            style="padding: 0.75rem 1.5rem; cursor: pointer; background: #6366f1; color: white; border: none; border-radius: 4px; font-size: 1rem;"
          >
            Refresh Data
          </button>
          <p style="font-size: 0.8rem; color: #999; margin-top: 0.5rem;">
            Click to trigger a re-fetch (client-side only)
          </p>
        </div>
      </div>

      <div style="max-width: 500px; margin: 2rem auto; padding: 1rem; background: #e0e7ff; border-radius: 8px; font-size: 0.9rem;">
        <strong>Note:</strong> During SSR, data fetches are deferred so the page streams immediately with loading
        skeletons. On the client, the actual content replaces the skeletons when data arrives.
      </div>
    </div>
  );
}
