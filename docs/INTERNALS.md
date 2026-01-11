# ⚙️ INTERNALS.md: The Mechanics of Stream Weaver

> **Warning:** This document describes the internal plumbing of the framework. Application developers do not need to know this to use Stream Weaver.

## 1. The Build Architecture (Source Phase Imports)

Stream Weaver rejects proprietary compiler transforms in favor of the **ECMAScript Source Phase Import** proposal (Stage 3). We treat logic not as inline closures, but as addressable, static assets.

### 1.1 The "Code as Data" Pattern

Instead of writing logic inline, which requires complex AST analysis to "extract" for code-splitting, Stream Weaver relies on importing the **Source** of a module.

**Developer Input (`Counter.tsx`):**

```typescript
// 1. Import the 'Source Handle', not the execution.
import source incrementLogic from './actions/increment';

// 2. Pass this handle to the factory.
// This allocates a stable ID (e.g., 'a1') and a code pointer.
const incrementAction = createAction(incrementLogic, [count]);

```

### 1.2 The Bundler Pipeline

1. **Asset Emission:** The bundler treats `./actions/increment.ts` as a separate chunk.
2. **Handle Generation:** The import resolves to a `ModuleSource` object containing the stable public URL.
3. **Zero Execution:** The server **never executes** the imported logic; it simply weaves the URL into the stream as a pointer.

---

## 2. The Type Inference Engine (TypeScript)

Stream Weaver enforces type safety across the network boundary using standard TypeScript generics. Because actions can return signals, we use recursive inference to ensure safety when passing one action's result into another.

### 2.1 The "Logic Transformation" Inference

The `createAction` factory uses the return type of the source module to define its own identity.

```typescript
// Definition (logic/math.ts)
// Returns a Signal<number>
export default ([s1]: [Signal<number>]) => s1.value * 2;

// Usage
import source mathSrc from './logic/math';
import type mathType from './logic/math';

// createAction infers that 'doubleSignal' is a Signal<number>
const doubleSignal = createAction<typeof mathType>(mathSrc, [count]);

```

### 2.2 How Inference Flows

1. **Unwrapping:** `createAction` extracts the `ReturnType` of the logic module.
2. **Signature Matching:** If `doubleSignal` is passed as a dependency to a second action, TypeScript verifies that the second action's input matches the first action's output.

---

## 3. The Runtime Factories (`createSignal` & `createAction`)

These are **Deterministic Address Generators**. They ignore the "Rules of Hooks" because they rely on explicit ID addressing rather than positional memory.

### 3.1 Universal Allocation

Unlike React or Qwik, these factories can be called **anywhere**:

* **Global Constants:** For shared application state.
* **Dynamic Loops:** For generating unique interactivity in the middle of a stream.
* **Logic Modules:** For creating nested "Computed" chains.

### 3.2 The Serializer (The "Loom")

When the server encounters these primitives during the "ChainExplode" render:

1. **Signals:** It generates an ID (e.g., `s1`) and flushes a `<script>` tag to register the value.
2. **Actions:** It generates an ID (e.g., `a1`) and serializes the code URL and dependency list into the **Wire Protocol**.

---

## 4. The Wire Protocol (Condensed)

Stream Weaver uses a minimal JSON format to keep the HTML payload surgical.

### 4.1 The `Binding` Address

Represented in the `data-action` attribute of an element.

```json
{
  "id": "a1",           // The Address of this logic (and its result)
  "m": "/assets/inc.js", // Module URL (minified key for 'module')
  "s": ["s1", "a2"],     // Dependencies (Source Signals 's' and Derived Actions 'a')
  "e": "default"         // Export Name
}

```

### 4.2 The Value Frame

Pushed to the stream to populate the global Sink.

```html
<script>weaver.set("s1", 10)</script>

```

---

## 5. The Signal Sink (Client Runtime)

The Sink is a <1kb singleton agent. It acts as a **Distributed Execution Bus**.

### 5.1 The Resolution Flow

1. **Event Capture:** Global listener finds the `data-action` address.
2. **Import:** Dynamic `import(binding.m)` fetches the logic.
3. **Address Resolution:** It looks up all dependency IDs in its `Map`.
* *Honesty:* If a dependency is an action ID (`a2`) that hasn't run yet, the Sink triggers that logic first (Recursive Resolution).


4. **Execution & Update:** It invokes the logic, passes the values, and stores any return value back in the Sink under the action's `id`.

### 5.2 The Unified State Proxy

To enable `signal.value++`, the Sink wraps all resolved dependencies in a Proxy.

* **Set Trap:** 1. Updates the value in the Sink's Map.
2. Synchronously updates all DOM elements marked with `data-bind="ID"`.
3. Triggers re-resolution for any "Derived Actions" that depend on this ID.
