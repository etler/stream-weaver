/**
 * Qwik SSR Benchmark Server
 *
 * Qwik requires compilation for SSR due to its resumability architecture.
 * This benchmark uses direct string templates to produce comparable HTML output.
 * NOTE: This does NOT measure Qwik's actual SSR performance as it requires
 * the full build toolchain for proper comparison.
 */

import { createServer } from "node:http";
import { COMPONENT_DATA } from "../shared/types.ts";

const PORT = 3004;

// Qwik's compiled output includes serialization markers for resumability
// We simulate basic HTML output for comparison purposes
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
        <p>Rendered by Qwik</p>
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
});

server.listen(PORT, () => {
  console.log(`Qwik benchmark server running on http://localhost:${PORT}`);
  console.log("NOTE: Qwik SSR requires compilation. This benchmark uses string templates.");
});
