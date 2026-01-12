# 🔭 Development Planning: Stream Weaver MVP POC

This document outlines the execution plan to build the **Stream Weaver MVP** using the **Source Phase Import** architecture. It treats the entire application (Transport, Logic, UI, State) as a serializable stream of **Universal Addresses**.

---

### **Phase 1: Foundation & Tooling (The Dual Build)**

**Goal:** Configure the build system to create two distinct artifacts that share a common "Universal Key" (the source file path).

#### **Step 1.1: Vite Configuration (`vite.config.ts`)**

* **Action:** Configure a multi-pass build pipeline.
* **Pass 1: Client Build:**
* Standard Vite production build.
* **Output:** `dist/client/` (Hashed assets).
* **Requirement:** Must generate `manifest.json`.


* **Pass 2: Server Build:**
* **Output:** `dist/server/` (Node.js compatible).
* **Config:** `build.rollupOptions.output.preserveModules = true`.
* **Goal:** Ensure the server file structure mirrors the source directory exactly.

* **Module Registry Map**
* **Output:** A registry file for mapping server import source paths to public client module bundle urls.
* **Goal:** Enable component imports to be executable serverside and resolve to the correct addressable code urls client side.

* **Verification:**
* Ensure that importing a file via `?url` on the server returns the **Source Path ID** (e.g., `/src/components/User.tsx`), not a file system path.
* Ensure Action and Component bindings contain the public client module bundle urls.

#### **Step 1.2: Project Structure**

* `src/actions/`: Stateless logic files.
* `src/components/`: Pure UI functions.
* `src/runtime/`: The factories and client-side runtime.
* `src/streaming/`: Server-side stream transformers.

---

### **Phase 2: The Address Contract (Types & Factories)**

**Goal:** Define the data structures for the **Wire Protocol**.

**Constraints:**

* **Wire Format:** The `Binding` interface describes what the **Client** receives. Therefore, `src` must be a fetchable URL.
* **Server State:** The Server will work with an "Internal Binding" type that holds the `UniversalKey` until serialization.

#### **Step 2.1: The Wire Type System (`src/types/Addressable.ts`)**

* **Action:** Create the strict type definitions for the **Client Protocol**.

```typescript
export type Address = string;      // "s1", "a1", "c1"
export type ModuleSource = string; // Public URL to script

export interface Signal<T = unknown> {
  id: Address;
  value: T;
  kind: 'state' | 'action' | 'component';
}

// 1. State: The Atom
export interface StateSignal<T> extends Signal<T> {
  kind: 'state';
}

// 2. Binding: The Code Link
export interface Binding<T = unknown> extends Signal<T> {
  src: ModuleSource;
  key?: string;    // Export name (default: "default")
  deps: Address[]; // Positional dependency IDs
}

// 3. Action: Virtual Logic
export interface ActionBinding<T = unknown> extends Binding<T> {
  kind: 'action';
}

// 4. Component: Physical UI Portal
export interface ComponentBinding extends Binding<unknown> {
  kind: 'component';
}

export type AnySignal<T = unknown> = StateSignal<T> | ActionBinding<T> | ComponentBinding;

```

#### **Step 2.2: The Universal Factories (`src/runtime/factories.ts`)**

* **Action:** Implement the ID allocators. Use global counters for this POC.
* **Logic:**
* `createSignal(value)` -> Returns `StateSignal`. Output ID: `s1`, `s2`...
* `createAction(src, deps, key)` -> Returns `ActionBinding`. Output ID: `a1`...
* `createComponent(src, props, key)` -> Returns `ComponentBinding`. Output ID: `c1`...


* **Signature Distinction:**
* **Actions (Spread):** The `deps` array maps to positional arguments: `fn(...deps)`.
* **Components (Props):** The `props` object is passed directly as the single argument: `fn(props)`. This object preserves the shallow prop structure, allowing specific values to be either static data or Signal IDs.

---

### **Phase 3: The Stream Pipeline (Server-Side)**

**Goal:** Decouple "Logic Resolution" from "HTML Serialization" using a composite stream pipeline.
**Architecture:** `ComponentDelegate` (Logic) -> `SignalSerializer` (Protocol) -> `ComponentSerializer` (Stringify).

#### **Step 3.1: Define Stream Markers**

* **Action:** Create `src/ComponentDelegate/types/Marker.ts`.
* **Logic:**

```typescript
import { StateSignal, ActionBinding, ComponentBinding } from "../../types/Addressable";

export type Marker =
  | { kind: 'text'; content: string }
  | { kind: 'signal'; signal: StateSignal | ActionBinding } // Mark <script> injection
  | { kind: 'open'; binding: ComponentBinding }             // Mark Portal start
  | { kind: 'close' };                                      // Mark Portal end

```

#### **Step 3.2: Refactor `ComponentDelegate**`

* **Action:** Update `src/ComponentDelegate/ComponentDelegate.ts`.
* **Logic:**
* **Input:** JSX Nodes / Promises / Signals.
* **Process:** Resolve Promises, iterate children.
* **Output:** Emit `Marker` objects. **Do not emit HTML strings here.**

#### **Step 3.3: Implement `SignalSerializer` (The Transformer)**

* **Action:** Create `src/streaming/SignalSerializer.ts`.
* **Type:** `TransformStream<Marker, Token>` (where `Token` is the existing HTML Token type).
* **Logic:** Translate Markers into the **Wire Protocol**:
* **Signal (State):** `<script>weaver.set("s1", val)</script>`
* **Signal (Action):** `<script>weaver.registerAction("a1", { src, key, deps })</script>`
* *Note:* `deps` is the array of Signal IDs for positional arguments.
* **Component Open:** Emit Open Tag `<div data-w-id="c1" data-w-src="..." data-w-key="..." data-w-props="...">`
* *Note:* `data-w-props` is a serialized JSON object where values are either static data or Signal IDs.
* **Component Close:** Emit `</div>`
* **Text:** Pass through as text tokens.



#### **Step 3.4: Integrate `StreamWeaver.ts**`

* **Action:** Update the pipeline construction.

```typescript
delegate.readable
  .pipeThrough(new SignalSerializer())    // Protocol Layer (Markers -> Tokens)
  .pipeThrough(new ComponentSerializer()) // Syntax Layer (Tokens -> String)

```

---

### **Phase 4: The Client Runtime (The Linear Sink)**

**Goal:** Build the <1kb script that acts as the distributed execution bus.

#### **Step 4.1: The Entry Point (`src/runtime/client.ts`)**

* **Action:** Initialize `window.weaver`.
* **Global Interface:** `window.weaver = { set, registerAction, resolve }`

#### **Step 4.2: Runtime Logic**

* **`set(id, value)`**:
* Update `store`.
* Update DOM text nodes matching `[data-w-bind="s1"]`.
* Trigger dirty portals matching `[data-w-deps*="s1"]`.


* **`registerAction(id, def)`**:
* Store the definition in the registry.
* **DO NOT** import code yet (Lazy).


* **`resolve(id)`**:
1. Check Store (return value if exists).
2. Check Registry.
3. **Recursion:** `await Promise.all(deps.map(resolve))` (Parallel).
4. **Import:** `await import(src)`.
5. **Execute:** `module[key](...resolvedDeps)`.



#### **Step 4.3: Surgical DOM Integration**

* **Action:** Implement `resolvePortal(id)` logic.
* **Process:**
1. **Locate:** Find the DOM anchor matching `[data-w-id="c1"]`.
2. **Read:** Extract `data-w-src`, `data-w-key`, and `data-w-props`.
3. **Resolve Props:** Parse `data-w-props` (JSON). Iterate through its values; if a value is a Signal ID, resolve it from the `store` recursively.
4. **Import:** Lazy load the `src` module if not present.
5. **Render:** Call the component function with the resolved `props` object as the single argument: `fn(props)`.
6. **Swap:** Replace the portal's inner content with the result.


---

### **Phase 5: Integration & Demo**

**Goal:** Prove "Zero-Hydration" interactivity and Component Swapping.

#### **Step 5.1: The "Component Switcher" Demo**

* **Action:** Create `actions/view-resolver.ts` and components `Login/Profile`.
* **Requirement:**
1. Render initial HTML stream (Server).
2. Client receives `weaver.set("s1", false)` (Logged Out).
3. User clicks "Login" (Updates `s1` to `true`).
4. Sink triggers `view-resolver` action (Logic).
5. Action returns a new `ComponentBinding` (for `<Profile />`).
6. Sink swaps the DOM portal.



#### **Step 5.2: End-to-End Verification**

* **Test:** Verify that the `Profile` component code was **not loaded** by the browser until the interaction occurred.
