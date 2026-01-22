/**
 * Production server for Stream Weaver demo
 *
 * Serves pre-built static assets and handles SSR using built code
 */

import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import {
  StreamWeaver,
  WeaverRegistry,
  setSSRModuleLoader,
  clearSSRModuleLoader,
  preExecuteServerLogic,
  registerSignalsInTree,
} from "stream-weaver";

const __dirname = dirname(fileURLToPath(import.meta.url));
const clientDir = join(__dirname, "../dist/client");
const serverDir = join(__dirname, "../dist/server");

// Simple static file server
async function serveStatic(path: string): Promise<{ content: Buffer; contentType: string } | null> {
  try {
    const content = await readFile(join(clientDir, path));
    const ext = path.split(".").pop();
    const contentTypes: Record<string, string> = {
      js: "application/javascript",
      css: "text/css",
      html: "text/html",
      png: "image/png",
      jpg: "image/jpeg",
      svg: "image/svg+xml",
    };
    return {
      content,
      contentType: contentTypes[ext || ""] || "application/octet-stream",
    };
  } catch {
    return null;
  }
}

// Import all pages from the built SSR bundle
const pages = await import(`${serverDir}/assets/pages.js`);

// Route handlers
interface Route {
  path: string;
  component: () => JSX.Element;
}

const routes: Route[] = [
  { path: "/counter", component: pages.Counter },
  { path: "/computed", component: pages.Computed },
  { path: "/async", component: pages.AsyncDemo },
  { path: "/shared-state", component: pages.SharedState },
  { path: "/dynamic-state", component: pages.DynamicState },
  { path: "/deferred", component: pages.DeferredDemo },
  { path: "/server-logic", component: pages.ServerLogicDemo },
  { path: "/suspense", component: pages.SuspenseDemo },
  { path: "/stream", component: pages.StreamDemo },
  { path: "/worker", component: pages.WorkerDemo },
];

/**
 * Generate the index page with links to all demos
 */
function generateIndexPage(): string {
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
      <p>Derived values that auto-update when dependencies change</p>
    </a>
    <a href="/async" class="example-card">
      <h2>03. Async Components</h2>
      <p>Components that load data asynchronously with streaming SSR</p>
    </a>
    <a href="/shared-state" class="example-card">
      <h2>04. Shared State</h2>
      <p>Multiple components reactively sharing state via signals</p>
    </a>
    <a href="/dynamic-state" class="example-card">
      <h2>05. Dynamic State</h2>
      <p>Creating signals dynamically and managing their lifecycle</p>
    </a>
    <a href="/deferred" class="example-card">
      <h2>06. Deferred Logic</h2>
      <p>Non-blocking execution with timeout configuration</p>
    </a>
    <a href="/server-logic" class="example-card">
      <h2>07. Server Logic</h2>
      <p>Server-only logic with automatic RPC to the client</p>
    </a>
    <a href="/suspense" class="example-card">
      <h2>08. Suspense</h2>
      <p>Loading states and fallbacks for async content</p>
    </a>
    <a href="/stream" class="example-card">
      <h2>09. Streaming</h2>
      <p>Real-time data streams with reactive updates</p>
    </a>
    <a href="/worker" class="example-card">
      <h2>10. Worker Threads</h2>
      <p>CPU-intensive computations offloaded to worker threads</p>
    </a>
  </div>
</body>
</html>`;
}

/**
 * Handle /weaver/execute RPC endpoint for server logic
 */
async function handleWeaverExecute(
  req: import("http").IncomingMessage,
  res: import("http").ServerResponse,
): Promise<void> {
  // Read request body
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(chunk as Buffer);
  }
  const body = Buffer.concat(chunks).toString("utf-8");

  try {
    // Parse the signal chain
    interface SignalChain {
      targetId: string;
      signals: unknown[];
    }
    const chain = JSON.parse(body) as SignalChain;

    // Import executeFromChain
    const { executeFromChain } = await import("stream-weaver");

    // Configure SSR module loader for logic execution
    setSSRModuleLoader(async (src: string) => {
      // Map /assets/ URLs to the actual built client assets location
      let modulePath = src;
      if (src.startsWith("/assets/")) {
        // /assets/foo.js -> dist/client/assets/foo.js
        const filename = src.replace(/^\/assets\//, "");
        modulePath = join(clientDir, "assets", filename);
      }
      return await import(modulePath);
    });

    // Execute the signal chain
    const result = await executeFromChain(chain);

    clearSSRModuleLoader();

    // Return the result
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ value: result }));
  } catch (error) {
    console.error("Error executing server logic:", error);
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: error instanceof Error ? error.message : "Internal Server Error" }));
  }
}

/**
 * Render a component to HTML with SSR
 */
async function renderComponent(Component: () => JSX.Element): Promise<string> {
  // Configure SSR module loader for production
  setSSRModuleLoader(async (src: string) => {
    // For component files (.tsx), load from built assets
    if (src.includes("/components/") && src.endsWith(".tsx")) {
      const componentName = basename(src, ".tsx");
      const assetPath = join(clientDir, "assets", `${componentName}.js`);
      return await import(assetPath);
    }
    return await import(src);
  });

  const registry = new WeaverRegistry();
  const root = await Component();

  // Register all signals in the tree first
  registerSignalsInTree(root, registry);

  // Pre-execute server-context computed signals before streaming
  await preExecuteServerLogic(registry);

  const weaver = new StreamWeaver({ root, registry });

  // Collect HTML chunks
  const chunks: string[] = [];
  for await (const chunk of weaver.readable) {
    chunks.push(chunk as string);
  }

  // Clear the SSR module loader after rendering
  clearSSRModuleLoader();

  let html = chunks.join("");

  // Transform module paths from absolute FS paths to /assets/ URLs for client
  // Replace patterns like:
  //   "src":"/Users/.../demo/src/logic/foo.ts" -> "src":"/assets/foo.js"
  //   "src":"/Users/.../demo/src/components/Bar.tsx" -> "src":"/assets/Bar.js"
  html = html.replace(
    /"src":"[^"]*\/demo\/src\/logic\/([^"]+)\.ts"/g,
    '"src":"/assets/$1.js"',
  );
  html = html.replace(
    /"src":"[^"]*\/demo\/src\/components\/([^"]+)\.tsx"/g,
    '"src":"/assets/$1.js"',
  );

  return html;
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host}`);

  // Serve static assets
  if (url.pathname.startsWith("/assets/")) {
    const staticFile = await serveStatic(url.pathname);
    if (staticFile) {
      res.writeHead(200, { "Content-Type": staticFile.contentType });
      res.end(staticFile.content);
      return;
    }
  }

  // Handle RPC endpoint for server logic
  if (url.pathname === "/weaver/execute" && req.method === "POST") {
    await handleWeaverExecute(req, res);
    return;
  }

  // Handle index page separately
  if (url.pathname === "/") {
    const indexHtml = generateIndexPage();
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(indexHtml);
    return;
  }

  // Find matching route
  const route = routes.find((r) => r.path === url.pathname);
  if (!route) {
    res.writeHead(404);
    res.end("Not Found");
    return;
  }

  try {
    // Get page title
    const titles: Record<string, string> = {
      "/": "Counter",
      "/counter": "Counter",
      "/computed": "Computed Signals",
      "/async": "Async Logic",
      "/shared-state": "Shared State",
      "/dynamic-state": "Dynamic State",
      "/deferred": "Deferred Execution",
      "/server-logic": "Server Logic",
      "/suspense": "Suspense",
      "/stream": "Streaming",
      "/worker": "Worker Threads",
    };
    const title = titles[route.path] || "Demo";

    // Render the component
    const body = await renderComponent(route.component);

    // Build complete HTML
    const html = `<!DOCTYPE html>
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
  <script type="module" src="/assets/client.js"></script>
</body>
</html>`;

    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(html);
  } catch (error) {
    console.error("Error rendering page:", error);
    res.writeHead(500);
    res.end("Internal Server Error");
  }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Production server running at http://localhost:${PORT}`);
  console.log();
  console.log("Routes:");
  routes.forEach((route) => {
    console.log(`  http://localhost:${PORT}${route.path}`);
  });
});
