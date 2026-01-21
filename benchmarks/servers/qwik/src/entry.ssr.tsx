/**
 * Qwik SSR Entry Point
 *
 * This is the entry point for server-side rendering.
 * It exports a render function that Qwik's SSR uses.
 */

import { renderToString, type RenderToStringOptions, type RenderToStringResult } from "@builder.io/qwik/server";
import { App } from "./root";

// Minimal manifest to suppress "Missing client manifest" warnings
// We're only benchmarking SSR, not client resumption
const minimalManifest = {
  manifestHash: "benchmark",
  symbols: {},
  mapping: {},
  bundles: {},
  version: "1.0.0",
};

export async function render(opts?: RenderToStringOptions): Promise<RenderToStringResult> {
  return renderToString(<App />, {
    containerTagName: "div",
    qwikLoader: "never", // Skip loader for benchmark (no client interactivity needed)
    manifest: minimalManifest,
    ...opts,
  });
}

export { App };
