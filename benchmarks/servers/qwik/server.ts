/**
 * Qwik SSR Benchmark Server
 *
 * This server uses Qwik's actual SSR with build-time compilation.
 * It builds the Qwik app on startup, then uses the compiled output for SSR.
 */

import { createServer } from "node:http";
import { build } from "vite";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const PORT = 3004;
// eslint-disable-next-line no-underscore-dangle
const __dirname = dirname(fileURLToPath(import.meta.url));

async function startServer() {
  console.log("Building Qwik app...");

  // Build the SSR bundle (silent to avoid noise in benchmarks)
  await build({
    configFile: join(__dirname, "vite.config.ts"),
    mode: "production",
    logLevel: "silent",
    build: {
      ssr: true,
      outDir: join(__dirname, "dist/server"),
      rollupOptions: {
        input: join(__dirname, "src/entry.ssr.tsx"),
      },
    },
  });

  console.log("Build complete, loading SSR module...");

  // Import the built SSR module
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const ssrModule = await import(join(__dirname, "dist/server/entry.ssr.js"));
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
  const render: () => Promise<{ html: string }> = ssrModule.render;

  console.log("Starting server...");

  const server = createServer((req, res) => {
    if (req.url !== "/") {
      res.writeHead(404);
      res.end("Not Found");
      return;
    }

    const handleRequest = async (): Promise<void> => {
      try {
        const result = await render();

        res.writeHead(200, {
          "Content-Type": "text/html; charset=utf-8",
          "Transfer-Encoding": "chunked",
        });

        // Stream in chunks like other benchmarks
        const chunkSize = 2048;
        for (let offset = 0; offset < result.html.length; offset += chunkSize) {
          res.write(result.html.slice(offset, offset + chunkSize));
        }

        res.end();
      } catch (error: unknown) {
        console.error("Render error:", error);
        res.writeHead(500);
        res.end("Internal Server Error");
      }
    };

    void handleRequest();
  });

  server.listen(PORT, () => {
    console.log(`Qwik benchmark server running on http://localhost:${PORT}`);
  });
}

startServer().catch(console.error);
