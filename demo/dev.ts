/**
 * Development server for Stream Weaver demos
 * Handles SSR, client bundle serving, and hot module reloading
 */
import { createServer as createViteServer } from "vite";
import { createServer } from "http";
import * as path from "path";
import { fileURLToPath } from "url";

const currentFilename = fileURLToPath(import.meta.url);

const currentDirname = path.dirname(currentFilename);

const PORT = 3000;

async function startDevServer() {
  // Create Vite server in middleware mode
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: "custom",
    root: path.resolve(currentDirname),
    resolve: {
      alias: {
        "@": path.resolve(currentDirname, "../src"),
      },
    },
  });

  const server = createServer((req, res) => {
    const url = req.url ?? "/";
    void (async () => {
      // Serve client files, logic modules, component modules, and Vite assets through Vite
      if (
        url.startsWith("/client.") ||
        url.startsWith("/logic/") ||
        url.startsWith("/components/") ||
        url.startsWith("/@")
      ) {
        vite.middlewares(req, res, () => {
          res.statusCode = 404;
          res.end("Not found");
        });
        return;
      }

      try {
        // Load and render the appropriate example
        let html = "";

        if (url === "/") {
          html = await indexPage();
        } else if (url === "/counter") {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
          const module = (await vite.ssrLoadModule("./examples/01-counter.tsx")) as { Counter: () => JSX.Element };
          html = await renderExample("Counter", module.Counter);
        } else if (url === "/computed") {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
          const module = (await vite.ssrLoadModule("./examples/02-computed.tsx")) as {
            ComputedExample: () => JSX.Element;
          };
          html = await renderExample("Computed Signals", module.ComputedExample);
        } else if (url === "/async") {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
          const module = (await vite.ssrLoadModule("./examples/03-async-components.tsx")) as {
            AsyncComponentsExample: () => JSX.Element;
          };
          html = await renderExample("Async Components", module.AsyncComponentsExample);
        } else if (url === "/shared-state") {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
          const module = (await vite.ssrLoadModule("./examples/04-shared-state.tsx")) as {
            SharedStateExample: () => JSX.Element;
          };
          html = await renderExample("Shared State", module.SharedStateExample);
        } else if (url === "/dynamic-state") {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
          const module = (await vite.ssrLoadModule("./examples/05-dynamic-state.tsx")) as {
            DynamicStateExample: () => JSX.Element;
          };
          html = await renderExample("Dynamic State", module.DynamicStateExample);
        } else {
          res.writeHead(404, { "Content-Type": "text/plain" });
          res.end("Not Found");
          return;
        }

        // Transform HTML through Vite
        html = await vite.transformIndexHtml(url, html);

        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(html);
      } catch (error) {
        console.error("Error:", error);
        if (error instanceof Error) {
          vite.ssrFixStacktrace(error);
        }
        res.writeHead(500, { "Content-Type": "text/plain" });
        res.end(error instanceof Error ? error.message : "Internal Server Error");
      }
    })();
  });

  server.listen(PORT, () => {
    console.log(`🌊 Stream Weaver demo server running at http://localhost:${PORT}`);
    console.log(`\nExamples:`);
    console.log(`  http://localhost:${PORT}/counter`);
    console.log(`  http://localhost:${PORT}/computed`);
    console.log(`  http://localhost:${PORT}/async`);
    console.log(`  http://localhost:${PORT}/shared-state`);
    console.log(`  http://localhost:${PORT}/dynamic-state`);
  });
}

/**
 * Render an example with SSR
 */
async function renderExample(title: string, Component: () => JSX.Element): Promise<string> {
  // Dynamic imports to avoid bundling issues
  const { StreamWeaver } = await import("../src/StreamWeaver");
  const { WeaverRegistry } = await import("../src/registry/WeaverRegistry");

  const registry = new WeaverRegistry();

  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const root = Component();
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const weaver = new StreamWeaver({ root, registry });

  // Collect HTML chunks - computed signals will show initial value (or empty)
  // Client will execute computed signals when it loads
  const chunks: string[] = [];
  for await (const chunk of weaver.readable) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
    chunks.push(chunk as string);
  }
  const body = chunks.join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - Stream Weaver</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      margin: 0;
      padding: 0;
      background: #f5f5f5;
    }
  </style>
  <script>
    // Create a stub weaver object that queues calls until ClientWeaver is ready
    window.weaver = window.weaver || {
      weaverQueue: [],
      push: function(msg) { this.weaverQueue.push(msg); }
    };
  </script>
</head>
<body>
  ${body}
  <script type="module" src="/client.ts"></script>
</body>
</html>`;
}

/**
 * Index page with links to examples
 */
async function indexPage(): Promise<string> {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Stream Weaver Demos</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      max-width: 800px;
      margin: 0 auto;
      padding: 2rem;
      background: #f5f5f5;
    }
    h1 {
      color: #333;
    }
    .examples {
      display: grid;
      gap: 1rem;
      margin-top: 2rem;
    }
    .example-card {
      background: white;
      padding: 1.5rem;
      border-radius: 8px;
      text-decoration: none;
      color: inherit;
      border: 2px solid #ddd;
      transition: border-color 0.2s;
    }
    .example-card:hover {
      border-color: #0066cc;
    }
    .example-card h2 {
      margin: 0 0 0.5rem 0;
      color: #0066cc;
    }
    .example-card p {
      margin: 0;
      color: #666;
    }
  </style>
</head>
<body>
  <h1>🌊 Stream Weaver Demos</h1>
  <p>Interactive examples demonstrating Stream Weaver's reactive signals system.</p>

  <div class="examples">
    <a href="/counter" class="example-card">
      <h2>01. Counter</h2>
      <p>Basic state signals and event handlers</p>
    </a>

    <a href="/computed" class="example-card">
      <h2>02. Computed Signals</h2>
      <p>Reactive computed values that update automatically</p>
    </a>

    <a href="/async" class="example-card">
      <h2>03. Async Components</h2>
      <p>Inline await in components - no Suspense, no loading states, just async</p>
    </a>

    <a href="/shared-state" class="example-card">
      <h2>04. Shared State</h2>
      <p>Module-level state shared across components - no Context providers needed</p>
    </a>

    <a href="/dynamic-state" class="example-card">
      <h2>05. Dynamic State</h2>
      <p>State in loops and conditionals - breaking the "Rules of Hooks"</p>
    </a>
  </div>
</body>
</html>`;
}

startDevServer().catch((err: unknown) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
