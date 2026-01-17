import { defineConfig } from "vite";
import path from "path";

export default defineConfig({
  root: path.resolve(__dirname),
  esbuild: {
    jsx: "automatic",
    jsxImportSource: "@/jsx",
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "../src"),
    },
  },
  build: {
    outDir: path.resolve(__dirname, "dist"),
    rollupOptions: {
      input: {
        client: path.resolve(__dirname, "client.ts"),
      },
      output: {
        entryFileNames: "[name].js",
      },
    },
  },
  server: {
    port: 3001,
  },
});
