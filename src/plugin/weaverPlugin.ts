import type { Plugin } from "vite";
import type { SourceMapInput } from "rollup";
import * as path from "path";
import * as fs from "fs";
import { transformCode } from "./transform";
import { generateFileHash } from "./hash";
import type { WeaverPluginOptions, LogicManifest, PluginState } from "./types";

/**
 * Extensions to try when resolving imports without extensions
 */
const EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".mts"];

/**
 * Create the Stream Weaver Vite/Rollup plugin
 *
 * This plugin transforms dynamic import expressions in signal creation calls
 * into LogicSignal objects with stable, content-addressable IDs.
 *
 * Example transformation:
 * ```js
 * // Input
 * const doubled = defineComputed(import("./double"), [count]);
 *
 * // Output
 * const doubled = defineComputed({id:"logic_abc123",kind:"logic",src:"./double"}, [count]);
 * ```
 *
 * @param options - Plugin configuration options
 * @returns Vite/Rollup plugin
 */
export function weaverPlugin(options: WeaverPluginOptions = {}): Plugin {
  const { logicBasePath = "/@weaver/logic" } = options;

  // Plugin state - tracks all discovered logic modules across files
  const state: PluginState = {
    pathToId: new Map(),
    idToInfo: new Map(),
  };

  let manifest: LogicManifest = {};

  return {
    name: "weaver-logic-transform",

    // Transform source files
    transform(code, id) {
      // Skip node_modules and non-JS/TS files
      if (id.includes("node_modules")) {
        return null;
      }

      if (!/\.(js|ts|jsx|tsx|mjs|mts)$/.test(id)) {
        return null;
      }

      // Quick check - skip files that don't contain target function calls
      if (
        !code.includes("defineComputed") &&
        !code.includes("defineAction") &&
        !code.includes("defineHandler") &&
        !code.includes("defineComponent") &&
        !code.includes("defineLogic")
      ) {
        return null;
      }

      // Resolve import paths to absolute paths with extension
      const resolvePath = (importPath: string, importer: string): string | null => {
        // Handle relative imports
        if (importPath.startsWith(".")) {
          const dir = path.dirname(importer);
          const basePath = path.resolve(dir, importPath);

          // If path already has an extension, use it directly
          if (path.extname(basePath)) {
            return basePath;
          }

          // Try common extensions
          for (const ext of EXTENSIONS) {
            const fullPath = basePath + ext;
            if (fs.existsSync(fullPath)) {
              return fullPath;
            }
          }

          // Fallback to path without extension
          return basePath;
        }

        // Handle absolute and package imports
        // In a full implementation, we'd use Vite's resolve
        return importPath;
      };

      // Transform the code
      const result = transformCode(code, id, resolvePath);

      // If no transformations were made, return null to skip
      if (result.logicModules.length === 0) {
        return null;
      }

      // Track discovered modules
      for (const mod of result.logicModules) {
        state.pathToId.set(mod.resolvedPath, mod.id);
        state.idToInfo.set(mod.id, mod);
      }

      return {
        code: result.code,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
        map: result.map as SourceMapInput,
      };
    },

    // Generate manifest during build
    generateBundle() {
      // Build manifest from tracked modules
      manifest = {};

      for (const [id, info] of state.idToInfo) {
        // Generate the public URL for this logic module
        const hash = generateFileHash(info.resolvedPath);
        const basename = path.basename(info.importPath, path.extname(info.importPath));
        const publicUrl = `${logicBasePath}/${basename}-${hash}.js`;

        manifest[id] = {
          id,
          src: publicUrl,
          originalPath: info.importPath,
        };
      }

      // Emit manifest as a virtual module
      this.emitFile({
        type: "asset",
        fileName: "weaver-manifest.json",
        source: JSON.stringify(manifest, null, 2),
      });
    },

    // Resolve logic modules during dev server
    resolveId(source) {
      // Handle logic module requests from the manifest path
      if (source.startsWith(logicBasePath)) {
        // Extract the original path from our tracked modules
        for (const info of state.idToInfo.values()) {
          const hash = generateFileHash(info.resolvedPath);
          const basename = path.basename(info.importPath, path.extname(info.importPath));
          const expectedPath = `${logicBasePath}/${basename}-${hash}.js`;

          if (source === expectedPath) {
            return info.resolvedPath;
          }
        }
      }

      return null;
    },
  };
}

// Re-export types
export type { WeaverPluginOptions, LogicManifest, LogicManifestEntry } from "./types";
