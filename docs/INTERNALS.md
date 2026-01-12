# ⚙️ INTERNALS.md: The Mechanics of Stream Weaver

> **Warning:** This document describes the internal plumbing of the framework. Application developers do not need to know this to use Stream Weaver.

## 1. The Build Architecture (Source Phase Imports)

Stream Weaver rejects proprietary compiler transforms in favor of the **ECMAScript Source Phase Import** proposal (Stage 3). We treat logic and UI not as inline closures, but as addressable, static assets.

### 1.1 The "Code as Data" Pattern

Instead of writing logic inline, which requires complex AST analysis to "extract" for code-splitting, Stream Weaver relies on importing the **Source** of a module.

**Developer Input (`App.tsx`):**

```typescript
// 1. Import 'Source Handles'
import source incrementLogic from './actions/increment';
import source UserProfile from './components/UserProfile';

// 2. Pass handles to factories (Implicit or Explicit)
const incAction = createAction(incrementLogic, [count]);
const uiSlot = <UserProfile user={userSignal} />; // Implicit createComponent call

```

### 1.2 The Bundler Pipeline

1. **Asset Emission:** The bundler treats every `source` import as a separate chunk/entry point.
2. **Handle Generation:** The import resolves to a `ModuleSource` object containing the stable public URL.
3. **Zero Execution:** The server **never executes** the imported logic for client-side use; it simply weaves the URL into the stream as a pointer.

---

## 2. The Type Inference Engine (TypeScript)

Stream Weaver enforces type safety across the network boundary. Because actions and components are **Universal Transformers**, we use recursive inference to ensure safety.

### 2.1 The "Spread" Signature Inference

The `createAction` and `createComponent` factories infer their identities from the module's export. We use **Positional Argument Mapping** (Spread) to keep signatures framework-ignorant.

```typescript
// Definition (logic/math.ts)
export const add = (val: number, factor: number) => val * factor;

// Usage
import source mathSrc from './logic/math';
// createAction infers the return type and automatically wraps it: Signal<number>
const result = createAction(mathSrc, [countSignal, factorSignal], 'add');

```

### 2.2 How Inference Flows

1. **Unwrapping:** The factory extracts the `ReturnType` of the logic module.
2. **Automatic Signalification:** The return type is automatically wrapped in a `Signal<T>`.
3. **Recursive Matching:** If `result` is passed to a component, TypeScript verifies the component's positional argument matches the unwrapped value of `result`.

---

## 3. The Server Runtime (Pipeline & Factories)

These are **Deterministic Address Generators**. They ignore the "Rules of Hooks" because they rely on explicit ID addressing rather than positional memory.

### 3.1 Universal Allocation

These factories can be called **anywhere**: Global constants, dynamic loops, or inside other logic modules. The framework never relies on call order; it only cares about the **Address**.

* **`createSignal`**: Allocates a state ID (`s1`).
* **`createAction`**: Allocates a logic ID (`a1`).
* **`createComponent`**: Allocates a portal ID (`c1`).

### 3.2 The Stream Pipeline (Decoupled Serialization)

To maintain clean separation of concerns, the server render pipeline is composed of three distinct transform streams. Logic is decoupled from HTML generation.

1. **`ComponentDelegate` (Logic Layer)**
* **Input:** JSX Nodes, Promises, Signals.
* **Role:** Resolves async logic and builds the execution plan.
* **Output:** A stream of **`Marker`** objects (`Signal`, `Open`, `Close`, `Text`).


2. **`SignalSerializer` (Protocol Layer)**
* **Input:** `Marker`.
* **Role:** Translates abstract markers into the Wire Protocol.
* **Transformation:**
* `Signal` -> `<script>weaver.set(...)</script>`
* `Open` -> `<div data-w-id="...">`




3. **`ComponentSerializer` (Syntax Layer)**
* **Input:** HTML Tokens.
* **Role:** Handles string escaping and final byte emission.
* **Output:** `ReadableStream<string>` (HTML).



---

## 4. The Wire Protocol (Serialization Standards)

Stream Weaver uses a **Readable, Explicit Protocol**. It does not use minified shorthands (like `w.s`) in the protocol itself, relying on Gzip/Brotli for compression.

### 4.1 State Signal (`kind: 'state'`)

Pushed to the stream immediately to populate the client store.

```html
<script>weaver.set("s1", 10)</script>
```

### 4.2 Action Binding (`kind: 'action'`)

Registers logic without executing or downloading it.

```html
<script>
  weaver.registerAction("a1", {
    src: "/assets/logic.js",
    key: "default",      // The named export
    deps: ["s1", "a2"]   // Positional dependency IDs
  })
</script>
```

### 4.3 Component Portal (`kind: 'component'`)

The physical anchor for a component.

```html
<div
  data-w-id="c1"
  data-w-src="/assets/UserProfile.js"
  data-w-key="default"
  data-w-deps="s1,s2"
>
  </div>
```

---

## 5. The Signal Sink (Client Runtime)

The Sink is a <1kb singleton agent acting as a **Linear Distributed Resolver**. It assumes **Sequential Delivery**—definitions arrive before or alongside their usage.

### 5.1 The Global API (`window.weaver`)

* **`store`**: `Map<Address, any>` (Memory).
* **`registry`**: `Map<Address, ActionDefinition>` (Logic).
* **`set(id, val)`**: Updates state and triggers surgical DOM updates.
* **`registerAction(id, def)`**: Caches logic definitions (zero network).
* **`resolve(id)`**: The recursive execution engine.

### 5.2 The Resolution Flow (Recursive & Lazy)

When a signal changes or an event fires:

1. **Cache Check:** Check `store`. If value exists, return it.
2. **Definition Lookup:** Retrieve definition from `registry`.
3. **Recursive Resolution:**
* Call `resolve()` for all dependency IDs in `deps`.
* *Note:* This happens in parallel (`Promise.all`).


4. **Lazy Import:**
* Dynamic `await import(src)`.
* This is the **first time** code is downloaded.


5. **Execution (The Spread):**
* Access `module[key]`.
* Call `fn(...resolvedValues)`.


6. **Surgical Update:**
* If the result is data, update the `store`.
* If the result is a Node (Component), swap the content of the Portal `div`.



### 5.3 The Unified State Proxy

To enable `signal.value++`, the Sink wraps all resolved dependencies in a Proxy.

* **Set Trap:**
1. Updates the Sink's Map.
2. Synchronously updates all DOM elements with surgical bindings (`data-w-bind`).
3. Triggers re-resolution for dependent Portals (`c1`).
