import { defineConfig } from "vite";
import path from "path";
import { weaverPlugin } from "../src/plugin";

export default defineConfig({
  root: path.resolve(__dirname),
  plugins: [weaverPlugin()],
  esbuild: {
    jsx: "automatic",
    jsxImportSource: "stream-weaver",
  },
  resolve: {
    alias: {
      // Stream-weaver library aliases - resolve internal @/ paths used in source
      "@/": path.resolve(__dirname, "../src") + "/",
      "@": path.resolve(__dirname, "../src"),
      // Allow stream-weaver to resolve to parent's src during development
      "stream-weaver/jsx-runtime": path.resolve(__dirname, "../src/jsx/jsx-runtime.ts"),
      "stream-weaver/jsx-dev-runtime": path.resolve(__dirname, "../src/jsx/jsx-dev-runtime.ts"),
      "stream-weaver/client": path.resolve(__dirname, "../src/client/ClientWeaver.ts"),
      "stream-weaver/polyfills": path.resolve(__dirname, "../src/polyfills/readableStreamFrom.ts"),
      "stream-weaver": path.resolve(__dirname, "../src/index.ts"),
    },
  },
  ssr: {
    // Ensure stream-weaver is bundled in SSR mode
    noExternal: ["stream-weaver"],
  },
  build: {
    outDir: path.resolve(__dirname, "dist/client"),
    rollupOptions: {
      input: {
        client: path.resolve(__dirname, "src/client.ts"),
        // Include all logic modules as separate entries
        ...Object.fromEntries(
          [
            "increment",
            "decrement",
            "double",
            "incrementFibInput",
            "incrementPrimeLimit",
            "fibonacciWorker",
            "primeCountWorker",
            "fetchUserDeferred",
            "fetchPostsDeferred",
            "fetchUserFromDb",
            "fetchStatsAction",
            "slowIncrement",
            "toggle",
            "setUserId1",
            "setUserId2",
            "setUserId3",
            "incrementRefresh",
            "addToCart",
            "clearCart",
            "append",
            "checkmark",
            "countingStream",
            "latest",
            "getServerTime",
          ].map((name) => [name, path.resolve(__dirname, `src/logic/${name}.ts`)]),
        ),
        // Include components
        ConditionalFeature: path.resolve(__dirname, "src/components/ConditionalFeature.tsx"),
        // Include worker script for Web Workers
        worker: path.resolve(__dirname, "../src/worker/worker.ts"),
      },
      output: {
        entryFileNames: "assets/[name].js",
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]",
        preserveModules: false,
      },
      preserveEntrySignatures: "strict",
    },
  },
  server: {
    port: 3000,
    fs: {
      // Allow serving files from the entire project (needed for logic module loading)
      allow: [path.resolve(__dirname, "..")],
    },
  },
});
