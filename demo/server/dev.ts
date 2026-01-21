/**
 * Development server for Stream Weaver demo
 * Handles SSR, client bundle serving, and hot module reloading
 */
import { createServer as createViteServer, ViteDevServer } from "vite";
import { createServer } from "http";
import * as path from "path";
import { fileURLToPath } from "url";
import type { JSX } from "stream-weaver/jsx-dev-runtime";

const currentFilename = fileURLToPath(import.meta.url);
const currentDirname = path.dirname(currentFilename);
const demoRoot = path.resolve(currentDirname, "..");

const PORT = 3000;

async function startDevServer() {
  // Create Vite server in middleware mode
  const vite = await createViteServer({
    configFile: path.resolve(demoRoot, "vite.config.ts"),
    server: { middlewareMode: true },
    appType: "custom",
  });

  const server = createServer((req, res) => {
    const url = req.url ?? "/";
    void (async () => {
      // Serve static files and Vite assets
      if (
        url.startsWith("/src/") ||
        url.startsWith("/@") ||
        url.startsWith("/node_modules/")
      ) {
        vite.middlewares(req, res, () => {
          res.statusCode = 404;
          res.end("Not found");
        });
        return;
      }

      try {
        let html = "";

        if (url === "/") {
          html = await indexPage();
        } else if (url === "/counter") {
          const module = (await vite.ssrLoadModule("./src/pages/Counter.tsx")) as {
            Counter: () => JSX.Element;
          };
          html = await renderExample("Counter", module.Counter, vite);
        } else if (url === "/computed") {
          const module = (await vite.ssrLoadModule("./src/pages/Computed.tsx")) as {
            ComputedExample: () => JSX.Element;
          };
          html = await renderExample("Computed Signals", module.ComputedExample, vite);
        } else if (url === "/async") {
          const module = (await vite.ssrLoadModule("./src/pages/AsyncComponents.tsx")) as {
            AsyncComponentsExample: () => Promise<JSX.Element>;
          };
          html = await renderExample("Async Components", module.AsyncComponentsExample, vite);
        } else if (url === "/shared-state") {
          const module = (await vite.ssrLoadModule("./src/pages/SharedState.tsx")) as {
            SharedStateExample: () => JSX.Element;
          };
          html = await renderExample("Shared State", module.SharedStateExample, vite);
        } else if (url === "/dynamic-state") {
          const module = (await vite.ssrLoadModule("./src/pages/DynamicState.tsx")) as {
            DynamicStateExample: () => JSX.Element;
          };
          html = await renderExample("Dynamic State", module.DynamicStateExample, vite);
        } else if (url === "/deferred") {
          const module = (await vite.ssrLoadModule("./src/pages/DeferredDemo.tsx")) as {
            DeferredDemoExample: () => JSX.Element;
          };
          html = await renderExample("Deferred Logic", module.DeferredDemoExample, vite);
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
    console.log(`Stream Weaver demo running at http://localhost:${PORT}`);
    console.log(`\nExamples:`);
    console.log(`  http://localhost:${PORT}/counter`);
    console.log(`  http://localhost:${PORT}/computed`);
    console.log(`  http://localhost:${PORT}/async`);
    console.log(`  http://localhost:${PORT}/shared-state`);
    console.log(`  http://localhost:${PORT}/dynamic-state`);
    console.log(`  http://localhost:${PORT}/deferred`);
  });
}

/**
 * Render an example with SSR
 */
async function renderExample(
  title: string,
  Component: () => JSX.Element | Promise<JSX.Element>,
  vite: ViteDevServer,
): Promise<string> {
  // Dynamic imports for SSR (using relative path for root execution)
  const { StreamWeaver, WeaverRegistry, setSSRModuleLoader, clearSSRModuleLoader } = await import(
    "../../src/index.js"
  );

  // Configure SSR module loader to use Vite's ssrLoadModule
  // Convert absolute paths to Vite-friendly project-relative paths
  setSSRModuleLoader(async (src: string) => {
    let vitePath = src;

    // Convert absolute filesystem paths to project-relative paths
    if (src.startsWith("/")) {
      // Make it relative to demo root for Vite
      if (src.startsWith(demoRoot)) {
        vitePath = "./" + src.slice(demoRoot.length + 1);
      } else {
        // For paths outside demo root, use absolute path
        vitePath = src;
      }
    }

    return await vite.ssrLoadModule(vitePath);
  });

  const registry = new WeaverRegistry();
  const root = await Component();
  const weaver = new StreamWeaver({ root, registry });

  // Collect HTML chunks
  const chunks: string[] = [];
  for await (const chunk of weaver.readable) {
    chunks.push(chunk as string);
  }
  const body = chunks.join("");

  // Clear the SSR module loader after rendering
  clearSSRModuleLoader();

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - Stream Weaver Demo</title>
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
  <script type="module" src="/src/client.ts"></script>
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
  <title>Stream Weaver Demo</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      max-width: 800px;
      margin: 0 auto;
      padding: 2rem;
      background: #f5f5f5;
    }
    h1 { color: #333; }
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
    .example-card:hover { border-color: #0066cc; }
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
  <h1>Stream Weaver Demo</h1>
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

    <a href="/deferred" class="example-card">
      <h2>06. Deferred Logic</h2>
      <p>Non-blocking async with timeout: 0 - compare blocking vs deferred execution</p>
    </a>
  </div>
</body>
</html>`;
}

startDevServer().catch((err: unknown) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
