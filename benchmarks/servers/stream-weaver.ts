/**
 * Stream Weaver SSR Benchmark Server
 *
 * Minimal streaming SSR server that directly calls StreamWeaver's render function.
 * No framework overhead - just the core streaming render.
 */

import { createServer } from "node:http";
import { COMPONENT_DATA } from "../shared/types.ts";

// Import from built package
import { StreamWeaver, WeaverRegistry } from "../../dist/index.js";
import { jsx } from "../../dist/jsx/jsx-runtime.js";

const PORT = 3001;

// Build the component tree using Stream Weaver's jsx
function buildApp() {
  const { title, items, metadata } = COMPONENT_DATA;

  return jsx("html", {
    children: [
      jsx("head", {
        children: [jsx("title", { children: title })],
      }),
      jsx("body", {
        children: [
          jsx("header", {
            children: [jsx("h1", { children: title })],
          }),
          jsx("main", {
            children: [
              jsx("section", {
                className: "metadata",
                children: [
                  jsx("p", { children: `Author: ${metadata.author}` }),
                  jsx("p", { children: `Version: ${metadata.version}` }),
                ],
              }),
              jsx("ul", {
                className: "items",
                children: items.map((item) =>
                  jsx("li", {
                    key: item.id,
                    className: "item",
                    children: [
                      jsx("h2", { children: item.name }),
                      jsx("p", { children: item.description }),
                      jsx("div", {
                        className: "tags",
                        children: item.tags.map((tag) =>
                          jsx("span", {
                            key: tag,
                            className: "tag",
                            children: tag,
                          }),
                        ),
                      }),
                    ],
                  }),
                ),
              }),
            ],
          }),
          jsx("footer", {
            children: [jsx("p", { children: "Rendered by Stream Weaver" })],
          }),
        ],
      }),
    ],
  });
}

const server = createServer((req, res) => {
  if (req.url !== "/") {
    res.writeHead(404);
    res.end("Not Found");
    return;
  }

  const registry = new WeaverRegistry();
  const root = buildApp();
  const weaver = new StreamWeaver({ root, registry });

  res.writeHead(200, {
    "Content-Type": "text/html; charset=utf-8",
    "Transfer-Encoding": "chunked",
  });

  const reader = weaver.readable.getReader();

  const processStream = async (): Promise<void> => {
    try {
      let result = await reader.read();
      while (!result.done) {
        res.write(result.value);
        result = await reader.read();
      }
    } finally {
      res.end();
    }
  };

  void processStream();
});

server.listen(PORT, () => {
  console.log(`Stream Weaver benchmark server running on http://localhost:${PORT}`);
});
