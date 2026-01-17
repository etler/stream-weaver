import { createHash } from "crypto";

/**
 * Generate a stable, deterministic ID from a file path
 * Uses SHA-256 hash truncated to 8 characters for brevity
 *
 * @param path - The resolved file path to hash
 * @returns A stable ID in the format "logic_xxxxxxxx"
 */
export function generateLogicId(path: string): string {
  const hash = createHash("sha256").update(path).digest("hex").slice(0, 8);
  return `logic_${hash}`;
}

/**
 * Generate a filename hash for the output file
 * Uses SHA-256 hash truncated to 8 characters
 *
 * @param path - The resolved file path to hash
 * @returns An 8-character hash string
 */
export function generateFileHash(path: string): string {
  return createHash("sha256").update(path).digest("hex").slice(0, 8);
}
