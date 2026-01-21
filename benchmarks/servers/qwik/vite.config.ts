import { defineConfig } from "vite";
import { qwikVite } from "@builder.io/qwik/optimizer";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

// eslint-disable-next-line no-underscore-dangle
const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: __dirname,
  plugins: [
    qwikVite({
      csr: false,
      rootDir: __dirname,
      srcDir: resolve(__dirname, "src"),
      entryStrategy: { type: "inline" }, // Inline all code for simpler benchmark
      client: {
        input: resolve(__dirname, "src/root.tsx"),
        outDir: resolve(__dirname, "dist/client"),
      },
      ssr: {
        input: resolve(__dirname, "src/entry.ssr.tsx"),
        outDir: resolve(__dirname, "dist/server"),
      },
    }),
  ],
  build: {
    minify: false, // Don't minify for fair comparison
    sourcemap: false,
  },
});
