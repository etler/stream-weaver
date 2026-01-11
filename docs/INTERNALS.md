# ⚙️ INTERNALS.md: The Mechanics of Stream Weaver

> **Warning:** This document describes the internal plumbing of the framework. Application developers do not need to know this to use Stream Weaver.

## 1. The Build Architecture (Source Phase Imports)

Stream Weaver rejects proprietary compiler transforms in favor of the **ECMAScript Source Phase Import** proposal (Stage 3). We treat logic not as inline closures, but as addressable, static assets.

This architecture delegates "Extraction" and "Splitting" entirely to the bundler (Vite/Rollup), ensuring maximum compatibility and stability.

### 1.1 The "Code as Data" Pattern

Instead of writing logic inline (which requires complex AST analysis to extract), Stream Weaver relies on importing the **Source** of a module.

**Developer Input (`Counter.tsx`):**

```typescript
// 1. We import the 'Source Handle', not the execution.
import source incrementLogic from './actions/increment';

// 2. We pass this handle to the runtime.
const handler = createAction(incrementLogic, [count]);

```

### 1.2 The Bundler Pipeline

When Vite processes an `import source ...` statement, it performs standard code splitting:

1. **Asset Emission:** The file `./actions/increment.ts` is treated as a separate entry point or chunk.
2. **Handle Generation:** The import resolves to a `ModuleSource` object (or a polyfilled equivalent) containing the stable, public URL of that chunk.
* **Example:** `{ url: "/assets/increment-B5x9sD.js" }`


3. **Zero Execution:** Crucially, the server rendering the component **never executes** the imported logic. It simply passes the *reference* (the URL) to the client.

---

## 2. The Type Inference Engine (TypeScript)

Stream Weaver enforces type safety across the network boundary using standard TypeScript generics, without relying on compiler "Type Tunneling."

### 2.1 The "Dual Import" Pattern

To ensure the View respects the Logic's requirements, we leverage the split between *Value* and *Type*.

```typescript
// The Definition (actions/increment.ts)
export default ([signal]: [Signal<number>]) => signal.value++;

```

```typescript
// The Usage (Counter.tsx)
import source incrementSrc from './actions/increment'; // The Runtime Handle
import type incrementType from './actions/increment';  // The Contract

// The `createAction` signature enforces the contract:
createAction<typeof incrementType>(incrementSrc, [count]);

```

### 2.2 How Inference Flows

1. **Constraint:** `createAction<Module>` expects `Module` to be a module type with a default export.
2. **Analysis:** TS extracts `Parameters<Module['default']>[0]` from the type definition.
3. **Enforcement:** The `dependencies` array (`[count]`) is checked against that parameter list.

This ensures that if `actions/increment.ts` changes its signature to require a string, `Counter.tsx` immediately fails to compile.

---

## 3. The Runtime Bridge (`createAction`)

The `createAction` hook is the bridge between the **ModuleSource** handle and the **Wire Protocol**.

### 3.1 Server-Side (Render Phase)

When running in Node/Bun/Edge:

1. **Input:** Receives the `ModuleSource` object (containing the chunk URL).
2. **Serialization:** It extracts the URL (e.g., `/assets/inc.js`) and creates a binding definition.
3. **Output:** Returns a JSON-serializable ID string.

**Return Value:** `{"module":"/assets/inc.js","signals":["s1"]}`

### 3.2 Client-Side (Hydration Phase)

When running in the Browser:

1. **Input:** Receives the same `ModuleSource` object.
2. **Output:** Returns an Event Handler that calls `window.weaver.run()`, passing the static URL found in the source handle.

---

## 4. The Wire Protocol

Stream Weaver uses a minimal JSON protocol to bind logic to DOM elements. This keeps the HTML payload small.

### 4.1 The `data-action` Attribute

This attribute is placed on interactive elements.

```json
// Format
{
  "module": "/assets/increment-B5x.js",  // Module Path (from Source Import)
  "export": "default",                   // Export Name (defaults to default)
  "signals": ["s1", "s2"]                // Dependency Signal IDs
}
```

**Example:**

```html
<button data-action='{"module":"/assets/increment-B5x.js","signals":["s1"]}'>+</button>

```

### 4.2 The Signal Frame

Signals are pushed to the stream as `<script>` tags that execute immediately.

```html
<script>
  window.weaver.set("s1", 0);
</script>

```

---

## 5. The Signal Sink (Client Runtime)

The runtime (`client.ts`) is a singleton agent that knows nothing about components. It only understands **Signals** and **URLs**.

### 5.1 The "Lazy Execution" Flow

1. **Event Delegation:** A global listener catches all `click` events.
2. **Lookup:** It finds the closest `[data-action]` attribute.
3. **Import:** It calls `await import(binding.module)`.
* *Note:* Because `binding.module` comes directly from the bundler's chunk generation, it is a valid, cacheable URL.


4. **Injection:** It looks up the Signal IDs (`binding.signals`) in its local `Map`.
5. **Execution:** It invokes the imported function, passing the Signal values.

### 5.2 The State Proxy

To enable "Write-Back" (e.g., `signal.value++`), the Sink wraps the signals passed to the module in a Proxy.

* **Get:** Reads from the local Map.
* **Set:** Updates the local Map + Triggers a DOM update for bound nodes.
