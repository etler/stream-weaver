/**
 * Configuration options for the Weaver plugin
 */
export interface WeaverPluginOptions {
  /**
   * Base path for generated logic module URLs
   * @default "/@weaver/logic"
   */
  logicBasePath?: string;
}

/**
 * Entry in the logic manifest
 */
export interface LogicManifestEntry {
  /** The stable logic ID */
  id: string;
  /** The public URL for runtime import */
  src: string;
  /** Original source path (for debugging) */
  originalPath: string;
}

/**
 * The logic manifest mapping IDs to URLs
 */
export type LogicManifest = Record<string, LogicManifestEntry>;

/**
 * Result of transforming a source file
 */
export interface TransformResult {
  /** Transformed source code */
  code: string;
  /** Source map (if available) */
  map?: unknown;
  /** Logic modules discovered during transformation */
  logicModules: LogicModuleInfo[];
}

/**
 * Information about a discovered logic module
 */
export interface LogicModuleInfo {
  /** Generated stable ID */
  id: string;
  /** Import path from the source */
  importPath: string;
  /** Resolved absolute path */
  resolvedPath: string;
}

/**
 * Internal state for tracking transformations across files
 */
export interface PluginState {
  /** Map of resolved paths to their logic IDs */
  pathToId: Map<string, string>;
  /** Map of logic IDs to their info */
  idToInfo: Map<string, LogicModuleInfo>;
}
