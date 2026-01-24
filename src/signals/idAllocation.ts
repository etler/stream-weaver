import { isClient } from "@/utils/environment";

/**
 * Module-level counter for generating unique IDs for source signals
 */
let sourceIdCounter = 0;

/**
 * Generates a unique ID for a source signal (StateSignal, LogicSignal)
 * These IDs must be unique across all instances
 * Uses different prefixes for server (s) and client (c) to avoid collisions
 *
 * @returns A unique signal ID (e.g., 's1', 's2', ... on server, 'c1', 'c2', ... on client)
 */
export function allocateSourceId(): string {
  sourceIdCounter++;
  const prefix = isClient() ? "c" : "s";
  return `${prefix}${sourceIdCounter}`;
}

/**
 * Simple hash function for generating content-addressable IDs
 * Uses the FNV-1a algorithm for fast, deterministic hashing
 *
 * @param str - String to hash
 * @returns Hash as a hex string
 */
function hashString(str: string): string {
  let hash = 2166136261; // FNV offset basis

  for (let index = 0; index < str.length; index++) {
    hash ^= str.charCodeAt(index);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }

  return (hash >>> 0).toString(36);
}

/**
 * Generates a content-addressable ID for derived signals
 * The same logic ID + dependency IDs will always produce the same ID
 *
 * @param logicId - ID of the LogicSignal
 * @param depIds - Array of dependency signal IDs
 * @returns Content-addressable ID
 */
export function allocateDerivedId(logicId: string, depIds: string[]): string {
  const content = `${logicId}:${depIds.join(",")}`;
  return hashString(content);
}

/**
 * Generates a content-addressable ID for logic signals with options
 * The same src + options will always produce the same ID
 *
 * @param src - Source path of the logic module
 * @param timeout - Timeout option (undefined, 0, or positive number)
 * @param context - Context option ('server' | 'client' | 'worker' | undefined)
 * @returns Content-addressable logic ID
 */
export function allocateLogicId(
  src: string,
  timeout: number | undefined,
  context: "server" | "client" | "worker" | undefined,
): string {
  // Include options in the hash to differentiate same module with different options
  const content = `${src}:timeout=${timeout ?? ""}:context=${context ?? ""}`;
  return `logic_${hashString(content)}`;
}
