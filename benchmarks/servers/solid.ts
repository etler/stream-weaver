/**
 * SolidJS SSR Benchmark Server
 *
 * Minimal streaming SSR server using SolidJS's renderToString.
 * SolidJS SSR requires compilation to transform JSX to optimized template strings.
 * This benchmark uses string templates to simulate compiled SolidJS output.
 */

import { createServer } from "node:http";
import { renderToStringAsync } from "solid-js/web";
import { COMPONENT_DATA } from "../shared/types.ts";

const PORT = 3003;

// SolidJS compiled output is template strings - we simulate this directly
function App() {
  const { title, items, metadata } = COMPONENT_DATA;

  const itemsHtml = items
    .map(
      (item) => `
      <li class="item">
        <h2>${escapeHtml(item.name)}</h2>
        <p>${escapeHtml(item.description)}</p>
        <div class="tags">
          ${item.tags.map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("")}
        </div>
      </li>`,
    )
    .join("");

  return `<html>
    <head>
      <title>${escapeHtml(title)}</title>
    </head>
    <body>
      <header>
        <h1>${escapeHtml(title)}</h1>
      </header>
      <main>
        <section class="metadata">
          <p>Author: ${escapeHtml(metadata.author)}</p>
          <p>Version: ${escapeHtml(metadata.version)}</p>
        </section>
        <ul class="items">
          ${itemsHtml}
        </ul>
      </main>
      <footer>
        <p>Rendered by SolidJS</p>
      </footer>
    </body>
  </html>`;
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const server = createServer((req, res) => {
  if (req.url !== "/") {
    res.writeHead(404);
    res.end("Not Found");
    return;
  }

  const handleRequest = async (): Promise<void> => {
    try {
      // Use renderToStringAsync to get the SolidJS SSR overhead
      // even though our component is sync, this measures the framework overhead
      const html = await renderToStringAsync(() => App());

      res.writeHead(200, {
        "Content-Type": "text/html; charset=utf-8",
        "Transfer-Encoding": "chunked",
      });

      // Simulate streaming by chunking the output
      const chunkSize = 1024;
      for (let offset = 0; offset < html.length; offset += chunkSize) {
        res.write(html.slice(offset, offset + chunkSize));
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
  console.log(`SolidJS benchmark server running on http://localhost:${PORT}`);
});
