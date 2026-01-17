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
import { jsx } from "../../src/jsx/jsx";

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

  return jsx("div", {
    style: "display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; margin: 1rem 0;",
    children: [
      jsx("div", {
        style: "background: #e3f2fd; padding: 1rem; border-radius: 8px; text-align: center;",
        children: [
          jsx("div", { style: "font-size: 2rem; font-weight: bold; color: #1976d2;", children: String(stats.commits) }),
          jsx("div", { style: "color: #666; font-size: 0.9rem;", children: "Commits" }),
        ],
      }),
      jsx("div", {
        style: "background: #e8f5e9; padding: 1rem; border-radius: 8px; text-align: center;",
        children: [
          jsx("div", { style: "font-size: 2rem; font-weight: bold; color: #388e3c;", children: String(stats.prs) }),
          jsx("div", { style: "color: #666; font-size: 0.9rem;", children: "Pull Requests" }),
        ],
      }),
      jsx("div", {
        style: "background: #fff3e0; padding: 1rem; border-radius: 8px; text-align: center;",
        children: [
          jsx("div", { style: "font-size: 2rem; font-weight: bold; color: #f57c00;", children: String(stats.reviews) }),
          jsx("div", { style: "color: #666; font-size: 0.9rem;", children: "Reviews" }),
        ],
      }),
    ],
  });
}

/**
 * Another async component for recent activity
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function RecentActivity({ userId }: { userId: number }): Promise<JSX.Element> {
  const activities = await fetchRecentActivity();

  return jsx("div", {
    style: "margin-top: 1.5rem;",
    children: [
      jsx("h3", { style: "margin: 0 0 1rem 0; color: #333;", children: "Recent Activity" }),
      jsx("ul", {
        style: "list-style: none; padding: 0; margin: 0;",
        children: activities.map((activity) =>
          jsx("li", {
            key: String(activity.id),
            style: "padding: 0.75rem; border-bottom: 1px solid #eee; display: flex; justify-content: space-between;",
            children: [
              jsx("span", { children: activity.action }),
              jsx("span", { style: "color: #999; font-size: 0.9rem;", children: activity.time }),
            ],
          }),
        ),
      }),
    ],
  });
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

  return jsx("div", {
    style:
      "max-width: 600px; margin: 2rem auto; padding: 2rem; border: 1px solid #ddd; border-radius: 8px; background: white;",
    children: [
      jsx("div", {
        style: "display: flex; align-items: center; gap: 1rem; margin-bottom: 1.5rem;",
        children: [
          jsx("div", {
            style:
              "width: 64px; height: 64px; background: #1976d2; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-size: 1.5rem; font-weight: bold;",
            children: user.name.charAt(0),
          }),
          jsx("div", {
            children: [
              jsx("h2", { style: "margin: 0;", children: user.name }),
              jsx("p", { style: "margin: 0.25rem 0 0 0; color: #666;", children: user.email }),
            ],
          }),
        ],
      }),

      // Nested async components - they stream independently!

      await UserStats({ userId: user.id }),

      await RecentActivity({ userId: user.id }),
    ],
  });
}

/**
 * Root component for the demo
 */
export async function AsyncComponentsExample(): Promise<JSX.Element> {
  return jsx("div", {
    style: "padding: 1rem;",
    children: [
      jsx("h1", { style: "text-align: center; color: #333;", children: "Async Components Demo" }),
      jsx("p", {
        style: "text-align: center; color: #666; max-width: 500px; margin: 0 auto 2rem auto;",
        children:
          "This entire dashboard is built with async components. Each section fetches its own data with plain await - no Suspense, no loading states, no useEffect. The HTML streams to you as data arrives.",
      }),

      jsx("div", {
        style:
          "background: #fff8e1; padding: 1rem; border-radius: 8px; margin-bottom: 2rem; max-width: 600px; margin-left: auto; margin-right: auto;",
        children: [
          jsx("strong", { children: "What makes this special:" }),
          jsx("ul", {
            style: "margin: 0.5rem 0 0 0; padding-left: 1.5rem;",
            children: [
              jsx("li", { children: "UserDashboard is an async function that awaits fetchUser()" }),
              jsx("li", { children: "UserStats is a nested async component that awaits fetchStats()" }),
              jsx("li", { children: "RecentActivity is another nested async component" }),
              jsx("li", { children: "No Suspense boundaries, no special wrappers needed" }),
            ],
          }),
        ],
      }),

      // The main async component - just await it!

      await UserDashboard({ userId: 1 }),
    ],
  });
}
