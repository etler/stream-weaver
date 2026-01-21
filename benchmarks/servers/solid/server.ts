/**
 * SolidJS SSR Benchmark Server
 *
 * Uses SolidJS's actual SSR rendering with createComponent and ssr template functions.
 * This represents real SolidJS SSR overhead, not just template strings.
 */

import { createServer } from "node:http";
import { renderToStringAsync, ssr, ssrElement, escape, createComponent } from "solid-js/web";
import { COMPONENT_DATA, type Item } from "../../shared/types.ts";

const PORT = 3003;

// Component for individual item
function ItemComponent(props: { item: Item }) {
  return ssrElement(
    "li",
    { class: "item" },
    () =>
      ssr`${ssrElement("h2", {}, () => escape(props.item.name))}${ssrElement("p", {}, () => escape(props.item.description))}${ssrElement(
        "div",
        { class: "tags" },
        () => ssr`${props.item.tags.map((tag) => ssrElement("span", { class: "tag" }, () => escape(tag)))}`,
      )}`,
    true,
  );
}

// Main App component
function App() {
  const { title, items, metadata } = COMPONENT_DATA;

  return ssrElement(
    "html",
    {},
    () =>
      ssr`${ssrElement("head", {}, () => ssrElement("title", {}, () => escape(title)))}${ssrElement(
        "body",
        {},
        () =>
          ssr`${ssrElement("header", {}, () => ssrElement("h1", {}, () => escape(title)))}${ssrElement(
            "main",
            {},
            () =>
              ssr`${ssrElement(
                "section",
                { class: "metadata" },
                () =>
                  ssr`${ssrElement("p", {}, () => ssr`Author: ${escape(metadata.author)}`)}${ssrElement(
                    "p",
                    {},
                    () => ssr`Version: ${escape(metadata.version)}`,
                  )}`,
              )}${ssrElement(
                "ul",
                { class: "items" },
                () => ssr`${items.map((item) => createComponent(ItemComponent, { item }))}`,
              )}`,
          )}${ssrElement("footer", {}, () => ssrElement("p", {}, () => ssr`Rendered by SolidJS`))}`,
      )}`,
    true,
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
      const html = await renderToStringAsync(() => createComponent(App, {}));

      res.writeHead(200, {
        "Content-Type": "text/html; charset=utf-8",
        "Transfer-Encoding": "chunked",
      });

      // Stream in chunks like other benchmarks
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
  };

  void handleRequest();
});

server.listen(PORT, () => {
  console.log(`SolidJS benchmark server running on http://localhost:${PORT}`);
});
