/**
 * Example 3: Async Components
 * Demonstrates both async functional components AND async logic signals
 *
 * IMPOSSIBLE IN OTHER FRAMEWORKS:
 * - React requires Suspense boundaries for async components
 * - Vue requires <Suspense> wrapper and async setup()
 * - Solid requires createResource() for async data
 *
 * Stream Weaver streams HTML as data arrives - just use await!
 *
 * This demo shows TWO approaches:
 * 1. Async components (UserDashboard, RecentActivity) - await directly in component
 * 2. Async logic signals (UserStats) - async handler with M11 executeLogic
 */
import { defineSignal, defineHandler, defineLogic, defineMutator } from "stream-weaver";

// Simulated API calls with delays to demonstrate streaming
async function fetchUser(id: number): Promise<{ id: number; name: string; email: string }> {
  await new Promise((resolve) => setTimeout(resolve, 100));
  return {
    id,
    name: "Jane Developer",
    email: "jane@example.com",
  };
}

async function fetchRecentActivity(): Promise<{ id: number; action: string; time: string }[]> {
  await new Promise((resolve) => setTimeout(resolve, 200));
  return [
    { id: 1, action: "Merged PR #423", time: "2 hours ago" },
    { id: 2, action: "Reviewed PR #421", time: "4 hours ago" },
    { id: 3, action: "Pushed to main", time: "Yesterday" },
  ];
}

// --- Async Logic Signals (M11) ---
// UserStats uses separate state signals + async handler to fetch data

// Individual state signals for each stat (enables reactive updates per field)
const commits = defineSignal(0);
const prs = defineSignal(0);
const reviews = defineSignal(0);
// Wrap in mutators for handler mutation access
const setCommits = defineMutator(commits);
const setPrs = defineMutator(prs);
const setReviews = defineMutator(reviews);

// Async action logic that fetches and updates all stats (use mutators for write access)
const fetchStatsLogic = defineLogic(import("../logic/fetchStatsAction"));
const fetchStats = defineHandler(fetchStatsLogic, [setCommits, setPrs, setReviews]);

/**
 * UserStats - powered by async logic signal (M11)
 *
 * Unlike the other components, this one does NOT await in the component body.
 * Instead, it uses a state signal + async handler pattern:
 * - State signal holds the data
 * - Async handler fetches data (simulates API call)
 * - Click button triggers the async handler
 * - executeLogic() awaits the Promise before updating state
 *
 * This demonstrates the M11 async logic pattern in action!
 */
function UserStats(): JSX.Element {
  return (
    <div style="margin: 1rem 0;">
      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem;">
        <div style="background: #e3f2fd; padding: 1rem; border-radius: 8px; text-align: center;">
          <div style="font-size: 2rem; font-weight: bold; color: #1976d2;">{commits}</div>
          <div style="color: #666; font-size: 0.9rem;">Commits</div>
        </div>
        <div style="background: #e8f5e9; padding: 1rem; border-radius: 8px; text-align: center;">
          <div style="font-size: 2rem; font-weight: bold; color: #388e3c;">{prs}</div>
          <div style="color: #666; font-size: 0.9rem;">Pull Requests</div>
        </div>
        <div style="background: #fff3e0; padding: 1rem; border-radius: 8px; text-align: center;">
          <div style="font-size: 2rem; font-weight: bold; color: #f57c00;">{reviews}</div>
          <div style="color: #666; font-size: 0.9rem;">Reviews</div>
        </div>
      </div>
      <div style="text-align: center; margin-top: 1rem;">
        <button
          onClick={fetchStats}
          style="padding: 0.5rem 1.5rem; font-size: 1rem; cursor: pointer; background: #1976d2; color: white; border: none; border-radius: 4px;"
        >
          Fetch Stats (async)
        </button>
        <div style="font-size: 0.8rem; color: #999; margin-top: 0.5rem;">
          ⚡ Click to trigger async logic signal (500ms delay)
        </div>
      </div>
    </div>
  );
}

/**
 * Async component for recent activity
 */
async function RecentActivity(_props: { userId: number }): Promise<JSX.Element> {
  const activities = await fetchRecentActivity();

  return (
    <div style="margin-top: 1.5rem;">
      <h3 style="margin: 0 0 1rem 0; color: #333;">Recent Activity</h3>
      <ul style="list-style: none; padding: 0; margin: 0;">
        {activities.map((activity) => (
          <li
            key={String(activity.id)}
            style="padding: 0.75rem; border-bottom: 1px solid #eee; display: flex; justify-content: space-between;"
          >
            <span>{activity.action}</span>
            <span style="color: #999; font-size: 0.9rem;">{activity.time}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Main async component - fetches user data and renders nested async components
 */
async function UserDashboard({ userId }: { userId: number }): Promise<JSX.Element> {
  const user = await fetchUser(userId);

  return (
    <div style="max-width: 600px; margin: 2rem auto; padding: 2rem; border: 1px solid #ddd; border-radius: 8px; background: white;">
      <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 1.5rem;">
        <div style="width: 64px; height: 64px; background: #1976d2; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-size: 1.5rem; font-weight: bold;">
          {user.name.charAt(0)}
        </div>
        <div>
          <h2 style="margin: 0;">{user.name}</h2>
          <p style="margin: 0.25rem 0 0 0; color: #666;">{user.email}</p>
        </div>
      </div>

      {/* UserStats: sync component with async logic signal (M11) */}
      <UserStats />
      {/* RecentActivity: async component with direct await */}
      <RecentActivity userId={user.id} />
    </div>
  );
}

/**
 * Root component for the demo
 */
export function AsyncComponentsExample(): JSX.Element {
  return (
    <div style="padding: 1rem;">
      <h1 style="text-align: center; color: #333;">Async Components Demo</h1>
      <p style="text-align: center; color: #666; max-width: 500px; margin: 0 auto 2rem auto;">
        This entire dashboard is built with async components. Each section fetches its own data with plain await - no
        Suspense, no loading states, no useEffect. The HTML streams to you as data arrives.
      </p>

      <div style="background: #fff8e1; padding: 1rem; border-radius: 8px; margin-bottom: 2rem; max-width: 600px; margin-left: auto; margin-right: auto;">
        <strong>Two async patterns in one demo:</strong>
        <ul style="margin: 0.5rem 0 0 0; padding-left: 1.5rem;">
          <li>
            <strong>Async components:</strong> UserDashboard and RecentActivity use <code>await</code> directly in the
            component
          </li>
          <li>
            <strong>Async logic signals:</strong> UserStats uses an async handler - click the button to see M11's{" "}
            <code>executeLogic</code> await the Promise
          </li>
        </ul>
      </div>

      <UserDashboard userId={1} />
    </div>
  );
}
