/**
 * Deferred posts fetching logic
 * Simulates a network request with a delay
 * @param _refreshCount - Ignored, but triggers re-fetch when changed
 */
export default async function fetchPostsDeferred(_refreshCount?: number): Promise<string> {
  // Simulate network delay (slightly longer than user)
  await new Promise((resolve) => setTimeout(resolve, 2000));

  const posts = [
    { id: 1, title: "Getting Started with Stream Weaver" },
    { id: 2, title: "Understanding Suspense Boundaries" },
    { id: 3, title: "Server-Side Rendering Made Easy" },
  ];

  const time = new Date().toLocaleTimeString();
  return posts.map((p) => `- ${p.title}`).join("\n") + `\n\nFetched at: ${time}`;
}
