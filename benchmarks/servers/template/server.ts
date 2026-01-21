/**
 * Template String Control Benchmark Server
 *
 * This is the CONTROL TEST - plain template strings with no framework overhead.
 * It represents the theoretical minimum for string-based HTML generation.
 *
 * Use this to establish a baseline for comparison with actual framework SSR.
 */

import { createServer } from "node:http";
import { COMPONENT_DATA } from "../../shared/types.ts";

const PORT = 3006;

// Plain template string rendering - no framework, minimal overhead
function renderApp(): string {
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
        <p>Rendered by Template Strings</p>
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

  try {
    const html = renderApp();

    res.writeHead(200, {
      "Content-Type": "text/html; charset=utf-8",
      "Transfer-Encoding": "chunked",
    });

    // Stream the output in chunks
    const chunkSize = 2048;
    for (let offset = 0; offset < html.length; offset += chunkSize) {
      res.write(html.slice(offset, offset + chunkSize));
    }

    res.end();
  } catch (error: unknown) {
    console.error("Render error:", error);
    res.writeHead(500);
    res.end("Internal Server Error");
  }
});

server.listen(PORT, () => {
  console.log(`Template String (Control) benchmark server running on http://localhost:${PORT}`);
});
