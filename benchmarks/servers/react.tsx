/**
 * React SSR Benchmark Server
 *
 * Minimal streaming SSR server using React's renderToReadableStream.
 * No framework overhead - just the core streaming render.
 */

import { createServer } from "node:http";
import React from "react";
import { renderToReadableStream } from "react-dom/server";
import { COMPONENT_DATA } from "../shared/types.ts";

const PORT = 3002;

// Build the component tree using React
function App() {
  const { title, items, metadata } = COMPONENT_DATA;

  return (
    <html>
      <head>
        <title>{title}</title>
      </head>
      <body>
        <header>
          <h1>{title}</h1>
        </header>
        <main>
          <section className="metadata">
            <p>Author: {metadata.author}</p>
            <p>Version: {metadata.version}</p>
          </section>
          <ul className="items">
            {items.map((item) => (
              <li key={item.id} className="item">
                <h2>{item.name}</h2>
                <p>{item.description}</p>
                <div className="tags">
                  {item.tags.map((tag) => (
                    <span key={tag} className="tag">
                      {tag}
                    </span>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        </main>
        <footer>
          <p>Rendered by React</p>
        </footer>
      </body>
    </html>
  );
}

const server = createServer((req, res) => {
  if (req.url !== "/") {
    res.writeHead(404);
    res.end("Not Found");
    return;
  }

  const handleRequest = async (): Promise<void> => {
    try {
      const stream = await renderToReadableStream(<App />);

      res.writeHead(200, {
        "Content-Type": "text/html; charset=utf-8",
        "Transfer-Encoding": "chunked",
      });

      const reader = stream.getReader();
      let result = await reader.read();
      while (!result.done) {
        res.write(result.value);
        result = await reader.read();
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
  console.log(`React benchmark server running on http://localhost:${PORT}`);
});
