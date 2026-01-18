import { defineConfig } from "vite";
import path from "path";

export default defineConfig({
  root: path.resolve(__dirname),
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
    outDir: path.resolve(__dirname, "dist"),
    rollupOptions: {
      input: {
        client: path.resolve(__dirname, "src/client.ts"),
      },
      output: {
        entryFileNames: "[name].js",
      },
    },
  },
  server: {
    port: 3000,
  },
});
