import { LogicSignal } from "@/signals/types";
import { loadSSRModule } from "@/ssr/ssrContext";
import { isServer } from "@/utils/environment";

/**
 * Module interface for dynamically imported logic
 */
interface LogicModule {
  default: (...args: unknown[]) => unknown;
}

/**
 * Loads a logic module and returns the default export function
 * Uses dynamic import to load the module at runtime
 *
 * On the server, uses the SSR module loader (configured via setSSRModuleLoader)
 * On the client, uses Vite's /@fs/ prefix for absolute paths
 *
 * @param logicSignal - LogicSignal definition containing the module URL
 * @returns Promise that resolves to the logic function
 */
export async function loadLogic(logicSignal: LogicSignal): Promise<(...args: unknown[]) => unknown> {
  // On server, use SSR module loader
  // Prefer src (absolute path) over ssrSrc (relative path) for reliability
  if (isServer()) {
    const src = logicSignal.src !== "" ? logicSignal.src : logicSignal.ssrSrc;
    if (src === undefined || src === "") {
      throw new Error(`Logic signal ${logicSignal.id} has no src path`);
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
    const module = (await loadSSRModule(src)) as LogicModule;
    return module.default;
  }

  // On client, use src with /@fs/ prefix for absolute filesystem paths
  let { src } = logicSignal;

  // In development, Vite serves files outside the root via /@fs/ prefix
  // Absolute filesystem paths (not web paths like /assets/) need this prefix
  // Only add /@fs for paths that look like filesystem paths (contain system path separators)
  if (src.startsWith("/") && !src.startsWith("/@") && !src.startsWith("/assets/")) {
    src = `/@fs${src}`;
  }

  // Type assertion is necessary for dynamic import
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
  const module = (await import(/* @vite-ignore */ src)) as LogicModule;
  return module.default;
}
