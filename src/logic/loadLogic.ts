import { LogicSignal } from "@/signals/types";

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
 * @param logicSignal - LogicSignal definition containing the module URL
 * @returns Promise that resolves to the logic function
 */
export async function loadLogic(logicSignal: LogicSignal): Promise<(...args: unknown[]) => unknown> {
  // Type assertion is necessary for dynamic import
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
  const module = (await import(logicSignal.src)) as LogicModule;
  return module.default;
}
