/**
 * SSR Context for module loading
 *
 * During SSR with Vite, modules need to be loaded via vite.ssrLoadModule
 * to get proper transforms and module resolution. This context provides
 * a way to configure the module loader.
 */

/**
 * Module loader function signature
 * Returns the module's default export
 */
export type ModuleLoader = (src: string) => Promise<unknown>;

/**
 * SSR context holding the module loader
 */
interface SSRContext {
  moduleLoader?: ModuleLoader;
}

/**
 * Global SSR context
 */
const ssrContext: SSRContext = {};

/**
 * Configure the SSR module loader
 * Call this before rendering with the Vite ssrLoadModule function
 *
 * @example
 * ```typescript
 * const vite = await createViteServer({ ... });
 * setSSRModuleLoader(async (src) => {
 *   const module = await vite.ssrLoadModule(src);
 *   return module;
 * });
 * ```
 */
export function setSSRModuleLoader(loader: ModuleLoader): void {
  ssrContext.moduleLoader = loader;
}

/**
 * Clear the SSR module loader
 */
export function clearSSRModuleLoader(): void {
  ssrContext.moduleLoader = undefined;
}

/**
 * Get the current SSR module loader
 */
export function getSSRModuleLoader(): ModuleLoader | undefined {
  return ssrContext.moduleLoader;
}

/**
 * Load a module for SSR using the configured loader
 * Falls back to direct import if no loader is configured
 */
export async function loadSSRModule(src: string): Promise<unknown> {
  if (ssrContext.moduleLoader) {
    return ssrContext.moduleLoader(src);
  }

  // Fallback to direct import (may not work in all environments)
  return await import(/* @vite-ignore */ src);
}
