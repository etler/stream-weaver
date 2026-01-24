/**
 * Deferred user fetching logic
 * Simulates a network request with a delay
 * @param _refreshCount - Ignored, but triggers re-fetch when changed
 */
export default async function fetchUserDeferred(_refreshCount?: number): Promise<string> {
  // Simulate network delay
  await new Promise((resolve) => setTimeout(resolve, 1500));

  const user = {
    id: 1,
    name: "Alice Johnson",
    email: "alice@example.com",
    role: "Admin",
    lastSeen: new Date().toLocaleTimeString(),
  };

  return JSON.stringify(user, null, 2);
}
