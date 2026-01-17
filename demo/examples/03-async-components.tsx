/**
 * Example 3: Async Components
 * Demonstrates async functional components with inline data fetching
 *
 * IMPOSSIBLE IN OTHER FRAMEWORKS:
 * - React requires Suspense boundaries for async components
 * - Vue requires <Suspense> wrapper and async setup()
 * - Solid requires createResource() for async data
 *
 * Stream Weaver streams HTML as data arrives - just use await!
 */

// Simulated API calls with delays to demonstrate streaming
async function fetchUser(id: number): Promise<{ id: number; name: string; email: string }> {
  await new Promise((resolve) => setTimeout(resolve, 100));
  return {
    id,
    name: "Jane Developer",
    email: "jane@example.com",
  };
}

async function fetchStats(): Promise<{ commits: number; prs: number; reviews: number }> {
  await new Promise((resolve) => setTimeout(resolve, 150));
  return {
    commits: 1247,
    prs: 89,
    reviews: 156,
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

/**
 * Async component that fetches user stats
 * Note: This is a nested async component - no special handling needed!
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function UserStats({ userId }: { userId: number }): Promise<JSX.Element> {
  // Just await inline - Stream Weaver handles the streaming
  const stats = await fetchStats();

  return (
    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; margin: 1rem 0;">
      <div style="background: #e3f2fd; padding: 1rem; border-radius: 8px; text-align: center;">
        <div style="font-size: 2rem; font-weight: bold; color: #1976d2;">{String(stats.commits)}</div>
        <div style="color: #666; font-size: 0.9rem;">Commits</div>
      </div>
      <div style="background: #e8f5e9; padding: 1rem; border-radius: 8px; text-align: center;">
        <div style="font-size: 2rem; font-weight: bold; color: #388e3c;">{String(stats.prs)}</div>
        <div style="color: #666; font-size: 0.9rem;">Pull Requests</div>
      </div>
      <div style="background: #fff3e0; padding: 1rem; border-radius: 8px; text-align: center;">
        <div style="font-size: 2rem; font-weight: bold; color: #f57c00;">{String(stats.reviews)}</div>
        <div style="color: #666; font-size: 0.9rem;">Reviews</div>
      </div>
    </div>
  );
}

/**
 * Another async component for recent activity
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function RecentActivity({ userId }: { userId: number }): Promise<JSX.Element> {
  const activities = await fetchRecentActivity();

  return (
    <div style="margin-top: 1.5rem;">
      <h3 style="margin: 0 0 1rem 0; color: #333;">Recent Activity</h3>
      <ul style="list-style: none; padding: 0; margin: 0;">
        {activities.map((activity) => {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-return
          return (
            <li
              key={String(activity.id)}
              style="padding: 0.75rem; border-bottom: 1px solid #eee; display: flex; justify-content: space-between;"
            >
              <span>{activity.action}</span>
              <span style="color: #999; font-size: 0.9rem;">{activity.time}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * Main async component - fetches user data and renders nested async components
 *
 * Look ma, no Suspense! No loading states! No useEffect!
 * Just async/await like you always wanted.
 */
async function UserDashboard({ userId }: { userId: number }): Promise<JSX.Element> {
  // Fetch user data inline - the HTML streams as this resolves
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

      {/* Nested async components - they stream independently! */}
      {await UserStats({ userId: user.id })}
      {await RecentActivity({ userId: user.id })}
    </div>
  );
}

/**
 * Root component for the demo
 */
export async function AsyncComponentsExample(): Promise<JSX.Element> {
  return (
    <div style="padding: 1rem;">
      <h1 style="text-align: center; color: #333;">Async Components Demo</h1>
      <p style="text-align: center; color: #666; max-width: 500px; margin: 0 auto 2rem auto;">
        This entire dashboard is built with async components. Each section fetches its own data with plain await - no
        Suspense, no loading states, no useEffect. The HTML streams to you as data arrives.
      </p>

      <div style="background: #fff8e1; padding: 1rem; border-radius: 8px; margin-bottom: 2rem; max-width: 600px; margin-left: auto; margin-right: auto;">
        <strong>What makes this special:</strong>
        <ul style="margin: 0.5rem 0 0 0; padding-left: 1.5rem;">
          <li>UserDashboard is an async function that awaits fetchUser()</li>
          <li>UserStats is a nested async component that awaits fetchStats()</li>
          <li>RecentActivity is another nested async component</li>
          <li>No Suspense boundaries, no special wrappers needed</li>
        </ul>
      </div>

      {/* The main async component - just await it! */}
      {await UserDashboard({ userId: 1 })}
    </div>
  );
}
