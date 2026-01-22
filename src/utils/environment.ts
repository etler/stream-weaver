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

/**
 * Detects if code is running in Node.js specifically (not Bun or browser)
 * Used for worker runtime selection - Node uses worker_threads, browser/Bun use Web Workers
 */
export function isNodeOnly(): boolean {
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- process.versions may not exist in all environments
  const hasNodeVersion = typeof process !== "undefined" && process.versions?.node !== undefined;
  // @ts-expect-error - Bun is a global in Bun runtime
  const isBun = typeof Bun !== "undefined";
  return hasNodeVersion && !isBun;
}
