/**
 * Vue SSR Benchmark Server
 *
 * Minimal streaming SSR server using Vue's renderToWebStream.
 * No framework overhead - just the core streaming render.
 */

import { createServer } from "node:http";
import { createSSRApp, h, type VNode } from "vue";
import { renderToWebStream } from "@vue/server-renderer";
import { COMPONENT_DATA } from "../shared/types.ts";

const PORT = 3005;

// Build the component tree using Vue's h() function
function buildApp(): VNode {
  const { title, items, metadata } = COMPONENT_DATA;

  return h("html", [
    h("head", [h("title", title)]),
    h("body", [
      h("header", [h("h1", title)]),
      h("main", [
        h("section", { class: "metadata" }, [
          h("p", `Author: ${metadata.author}`),
          h("p", `Version: ${metadata.version}`),
        ]),
        h(
          "ul",
          { class: "items" },
          items.map((item) =>
            h("li", { key: item.id, class: "item" }, [
              h("h2", item.name),
              h("p", item.description),
              h(
                "div",
                { class: "tags" },
                item.tags.map((tag) => h("span", { key: tag, class: "tag" }, tag)),
              ),
            ]),
          ),
        ),
      ]),
      h("footer", [h("p", "Rendered by Vue")]),
    ]),
  ]);
}

const server = createServer((req, res) => {
  if (req.url !== "/") {
    res.writeHead(404);
    res.end("Not Found");
    return;
  }

  const handleRequest = async (): Promise<void> => {
    try {
      // Create a minimal Vue SSR app
      const app = createSSRApp({
        render() {
          return buildApp();
        },
      });

      // Use renderToWebStream for streaming output
      const stream = renderToWebStream(app);

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
  console.log(`Vue benchmark server running on http://localhost:${PORT}`);
});
