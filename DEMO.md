# Stream Weaver Demo Guide

## Quick Start

Run the demo server:

```bash
npm run demo
```

Then open http://localhost:3000 in your browser.

## Available Examples

### 1. Counter (http://localhost:3000/counter)
A simple counter demonstrating:
- State signals (`defineSignal`)
- Event handlers (`defineHandler`)
- DOM event binding (`onClick`)
- Reactive updates

Click the + and - buttons to see the counter update in real-time.

### 2. Computed Signals (http://localhost:3000/computed)
Shows reactive computed values:
- Computed signals (`defineComputed`)
- Automatic dependency tracking
- Cascading updates through the signal graph

The "Doubled" value automatically updates whenever the count changes.

## How It Works

### Server-Side Rendering (SSR)
1. Components render on the server using `StreamWeaver`
2. Signals are serialized with HTML comment bind markers: `<!--^id-->value<!--/id-->`
3. Signal definitions are included as inline scripts

### Client Hydration
1. `ClientWeaver` initializes from the server HTML
2. Bind markers are discovered via DOM tree walking
3. Event listeners attach via global event delegation
4. The reactive system activates

### Reactive Flow
```
User Click → Handler → State Update → SignalDelegate → Computed Re-execution → Sink DOM Update
```

## Project Structure

```
demo/
├── dev.ts              # Vite-based dev server with SSR
├── client.ts           # Client entry point (hydration)
├── examples/           # Demo components
│   ├── 01-counter.tsx
│   └── 02-computed.tsx
└── logic/              # Shared logic modules
    ├── increment.js    # Handler: count++
    ├── decrement.js    # Handler: count--
    └── double.js       # Computed: count * 2
```

## Key Technologies

- **SSR**: Server-side rendering with streaming HTML
- **Hydration**: Client-side activation of server-rendered HTML
- **Signals**: Fine-grained reactive primitives
- **Content-Addressable IDs**: Deterministic signal identification
- **Event Delegation**: Single global listener per event type
- **Bind Markers**: HTML comments for DOM update targeting

## Development

### Adding a New Example

1. Create your component in `demo/examples/`:
```tsx
// demo/examples/03-my-example.tsx
import { defineSignal, defineHandler } from "../../src/signals";

const state = defineSignal("initial");
const handler = defineHandler(import("../logic/my-logic.js"), [state]);

export function MyExample() {
  return (
    <div>
      <h1>My Example</h1>
      <p>{state}</p>
      <button onClick={handler}>Click</button>
    </div>
  );
}
```

2. Add route in `demo/dev.ts`:
```typescript
} else if (url === "/my-example") {
  const { MyExample } = await vite.ssrLoadModule("./examples/03-my-example.tsx");
  html = await renderExample("My Example", MyExample);
}
```

3. Add link to index page in `demo/dev.ts` → `indexPage()`

4. Create your logic module in `demo/logic/`:
```javascript
// demo/logic/my-logic.js
export default function myLogic(event, state) {
  state.value = "updated!";
}
```

## Technical Details

### Signal Lifecycle

**Server:**
1. Signal created with `defineSignal(init)`
2. ID allocated (counter-based: s1, s2, ...)
3. Value stored in `WeaverRegistry`
4. Serialized to HTML with bind markers + definition script

**Client:**
1. Definition parsed from `<script>weaver.push(...)</script>`
2. Registered in client-side `WeaverRegistry`
3. Bind markers found via `TreeWalker` API
4. Ranges created for content replacement
5. Event delegation routes user actions to `SignalDelegate`
6. Updates flow through reactive graph to DOM

### Reactivity Model

Stream Weaver uses a **push-based** reactive system:
- State changes push to `SignalDelegate` via writable stream
- Delegate queries dependency graph for affected computed signals
- Computed signals re-execute in parallel
- Results emit as signal-update events
- Sink applies updates to DOM via Range API

### Why This Architecture?

**Universal Addressability**: Every signal has a unique, stable ID. Signals work anywhere—no component boundaries, no context restrictions.

**Content-Addressable Logic**: Same logic + same deps = same ID. Enables deduplication and caching.

**Explicit Dependencies**: No hidden closures. Dependencies declared upfront for precise tracking.

**Streaming SSR**: Components render in parallel, output streams in order. Progressive enhancement ready.

**Event Delegation**: Single listener per event type. Efficient, memory-light, dynamic content friendly.

## Next Steps

- Try modifying the examples
- Add your own logic modules
- Experiment with nested components
- Profile the reactive update cycle in DevTools

Enjoy exploring Stream Weaver! 🌊
