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

The `createAction` and `createComponent` factories infer their identities from the module's default export. We use **Positional Argument Mapping** (Spread) to keep signatures framework-ignorant.

```typescript
// Definition (logic/math.ts)
export default (val: number, factor: number) => val * factor;

// Usage
import source mathSrc from './logic/math';
// createAction infers the return type and automatically wraps it: Signal<number>
const result = createAction(mathSrc, [countSignal, factorSignal]);

```

### 2.2 How Inference Flows

1. **Unwrapping:** The factory extracts the `ReturnType` of the logic module.
2. **Automatic Signalification:** The return type is automatically wrapped in a `Signal<T>`.
3. **Recursive Matching:** If `result` is passed to a component, TypeScript verifies the component's positional argument matches the unwrapped value of `result`.

---

## 3. The Runtime Factories (`createSignal`, `createAction`, `createComponent`)

These are **Deterministic Address Generators**. They ignore the "Rules of Hooks" because they rely on explicit ID addressing rather than positional memory.

### 3.1 Universal Allocation

These factories can be called **anywhere**: Global constants, dynamic loops, or inside other logic modules. The framework never relies on call order; it only cares about the **Address**.

### 3.2 The Serializer (The "Loom")

When the server encounters these primitives, it serializes them differently based on their role in the DOM:

1. **Signals (`createSignal`):**
* Generates an ID (e.g., `s1`).
* Flushes a `<script>` tag to register the initial value.


2. **Logic (`createAction`):**
* Generates an ID (e.g., `a1`).
* Serializes the binding (URL + Deps) into the Sink's registry.
* **Side Effect:** None (Virtual).


3. **UI (`createComponent`):**
* Generates an ID (e.g., `c1`).
* Serializes the binding (URL + Deps) into the Sink's registry.
* **Side Effect:** Flushes a **DOM Portal** (`<div data-w-id="c1">`) to reserve the physical screen real estate for the component's output.



---

## 4. The Wire Protocol (Condensed)

### 4.1 The `Binding` Address

Metadata is woven directly into the DOM (for components) or sent as a minimal JSON frame (for actions).

**The Component Portal (Physical):**

```html
<div
  data-w-id="c1"
  data-w-src="/assets/UserProfile.js"
  data-w-deps="s1, s2"
>
  </div>

```

**The Action Binding (Virtual):**

```json
{
  "id": "a1",                 // The Address
  "module": "/assets/math.js", // Stable URL
  "signals": ["s1", "a2"]      // Positional Dependency IDs
}

```

### 4.2 The Value Frame

Pushed to the stream to populate the global Sink.

```html
<script>weaver.set("s1", 10)</script>

```

---

## 5. The Signal Sink (Client Runtime)

The Sink is a <1kb singleton agent acting as a **Distributed Execution Bus**.

### 5.1 The Resolution Flow (Recursive)

1. **Event/Signal Trigger:** The Sink identifies an affected Address ID.
2. **Import:** Dynamic `import()` fetches the module source.
3. **Address Resolution:** It looks up dependency IDs in its `Map`.
* **Honesty:** If a dependency is an action ID (`a2`) that is "dirty," the Sink triggers that logic first.


4. **Execution (The Spread):** The Sink unwraps the dependency values and calls `module.default(...values)`.
5. **Update Strategy:**
* **Data Action (`createAction`):** Stores the result in the Map under the ID `a1`.
* **UI Component (`createComponent`):** Takes the resulting HTML/DOM and **surgically swaps** the content of the element matching `[data-w-id="c1"]`.



### 5.2 The Unified State Proxy

To enable `signal.value++`, the Sink wraps all resolved dependencies in a Proxy.

* **Set Trap:**
1. Updates the Sink's Map.
2. Synchronously updates all DOM elements with surgical bindings (`data-w-bind`).
3. Marks all dependent Actions (`aX`) and Components (`cX`) as "Dirty" for the next resolution cycle.
