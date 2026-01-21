/**
 * Qwik App Component
 *
 * Uses Qwik's component$ for resumable components.
 * This is the actual Qwik way to build components.
 */

import { component$ } from "@builder.io/qwik";
import { COMPONENT_DATA, type Item } from "../../../shared/types.ts";

// Component for individual item using component$
const ItemComponent = component$<{ item: Item }>(({ item }) => {
  return (
    <li class="item">
      <h2>{item.name}</h2>
      <p>{item.description}</p>
      <div class="tags">
        {item.tags.map((tag) => (
          <span key={tag} class="tag">
            {tag}
          </span>
        ))}
      </div>
    </li>
  );
});

// Main App component
export const App = component$(() => {
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
          <section class="metadata">
            <p>Author: {metadata.author}</p>
            <p>Version: {metadata.version}</p>
          </section>
          <ul class="items">
            {items.map((item) => (
              <ItemComponent key={item.id} item={item} />
            ))}
          </ul>
        </main>
        <footer>
          <p>Rendered by Qwik</p>
        </footer>
      </body>
    </html>
  );
});

export default App;
