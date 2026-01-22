/**
 * Server-side logic that returns the current server time
 *
 * This demonstrates server logic with no dependencies - useful for
 * server-only operations like getting environment variables, server time, etc.
 */
export default function getServerTime(): string {
  // This runs on the server - we have access to Node.js APIs
  const now = new Date();
  return now.toLocaleString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZoneName: "short",
  });
}
