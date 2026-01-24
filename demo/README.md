# Stream Weaver Demos

Interactive examples demonstrating Stream Weaver's reactive signals system.

## Running the Demos

```bash
npm run demo
```

Then open http://localhost:3000 in your browser.

## Examples

### 01. Counter
Basic state signals and event handlers. Demonstrates:
- Creating state signals with `defineSignal()`
- Creating event handlers with `defineHandler()`
- Binding handlers to DOM events with `onClick`
- Reactive DOM updates

### 02. Computed Signals
Reactive computed values that update automatically. Demonstrates:
- Creating computed signals with `defineComputed()`
- Automatic dependency tracking
- Reactive propagation through the signal graph
- Server-side execution of computed values

## How It Works

1. **Server-Side Rendering (SSR)**:
   - Examples are rendered on the server using `StreamWeaver`
   - Signals are serialized into the HTML with bind markers
   - Signal definitions are included as inline `<script>` tags

2. **Client Hydration**:
   - `ClientWeaver` reads signal definitions from the HTML
   - Bind markers are discovered and tracked
   - Event listeners are attached via global event delegation
   - The reactive system springs to life

3. **Reactive Updates**:
   - User interactions trigger handlers
   - Handlers mutate state signals
   - Changes propagate through computed signals
   - DOM updates happen automatically via the Sink

## File Structure

```
demo/
├── README.md           # This file
├── dev.ts             # Development server with Vite
├── client.ts          # Client entry point
├── examples/          # Demo examples
│   ├── 01-counter.tsx
│   └── 02-computed.tsx
└── logic/             # Shared logic modules
    ├── increment.js
    ├── decrement.js
    └── double.js
```

## Adding New Examples

1. Create a new file in `demo/examples/`
2. Define your component using JSX and signals
3. Add a route in `demo/dev.ts`
4. Add a link on the index page

Example:

```tsx
// demo/examples/03-my-example.tsx
import { defineSignal, defineHandler } from "../../src/signals";

const myState = defineSignal("initial");
const myHandler = defineHandler(import("../logic/my-logic.js"), [myState]);

export function MyExample() {
  return (
    <div>
      <h1>My Example</h1>
      <p>{myState}</p>
      <button onClick={myHandler}>Click me</button>
    </div>
  );
}
```

Then add to `dev.ts`:

```typescript
else if (url === "/my-example") {
  const { MyExample } = await vite.ssrLoadModule("./examples/03-my-example.tsx");
  html = await renderExample("My Example", MyExample);
}
```
