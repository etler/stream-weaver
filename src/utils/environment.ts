/**
 * Environment detection utilities
 */

/**
 * Detects if code is running on the server (Node.js) or client (browser)
 */
export function isServer(): boolean {
  return typeof window === "undefined";
}

/**
 * Detects if code is running on the client (browser)
 */
export function isClient(): boolean {
  return typeof window !== "undefined";
}
