# Development Planning: Stream Weaver MVP POC

This document outlines the execution plan to build the **Stream Weaver MVP** using the **Source Phase Import** architecture.

---

### **Phase 1: Foundation & Tooling**

**Goal:** Configure the build system to treat Action Files as static assets (`import source`) and establish the project structure.

#### **Step 1.1: Vite Configuration**

* **Action:** Update `vite.config.ts`.
* **Requirement:** Ensure that `import source` (or the `?url` proxy) returns the public URL of the emitted chunk.
* **Verification:** Log an imported source in `index.ts`. It must be a string (URL).

#### **Step 1.2: Project Structure**

* `src/actions/`: Stateless logic files.
* `src/components/`: Stream-generating functions.
* `src/runtime/`: The Signal Sink and ID management logic.

---

### **Phase 2: The Core Protocol (The Addressable Factory)**

**Goal:** Enable the server to serialize "Code Handles" and "Signals" into a unified format while maintaining full Type Safety.

#### **Step 2.1: The Type System (The Developer Contract)**

* **Action:** Create `src/types/Addressable.ts`.
* **Requirement:** Define how Signals and Actions are represented in the codebase.

```typescript
export type Address = string; // e.g., "s1", "a1"

export interface Signal<T> {
  id: Address;
  value: T;
}

export interface Binding<T = any> extends Signal<T> {
  module: string;    // URL to the code chunk
  signals: Address[]; // Array of dependency IDs
  export: string;    // Named export (default: "default")
}

```

#### **Step 2.2: The Wire Format (The Network Contract)**

* **Action:** Define the serialized representation for the `html` loom.
* **Logic:** To save bytes, the stream uses minimal representations.
* **Dependency Reference:** Just the ID string: `"s1"` or `"a1"`.
* **Action Registration:** A condensed JSON object in the `data-action` attribute:
```json
{ "id": "a1", "m": "/inc.js", "s": ["s1"] }

```





#### **Step 2.3: Implement `createAction**`

* **Action:** Create `src/createAction.ts`.
* **Logic:**
* Accept a `ModuleSource` and a dependency array.
* **Inference:** Use `ReturnType<typeof source>` to determine the Signal type `T` for the `Binding<T>`.
* Return a `Binding` object that contains its own unique `id`.



#### **Step 2.4: Upgrade `ComponentSerializer**`

* **Action:** Modify `src/ComponentHtmlSerializer/ComponentSerializer.ts`.
* **Logic:** Detect `Binding` objects in attributes. Serialize them using the **Wire Format** defined in Step 2.2.

---

### **Phase 3: The Universal Signal System**

**Goal:** Create reactive primitives that ignore the "Rules of Hooks" and work anywhere.

#### **Step 3.1: Implement `createSignal**`

* **Action:** Create `src/runtime/Signal.ts`.
* **Logic:** `createSignal<T>(initial)` returns the `Signal<T>` interface.
* **Allocation:** Can be defined as a global constant or within a dynamic loop.

#### **Step 3.2: Implement `StreamWeaver.context` (The Value Weave)**

* **Action:** Update `StreamWeaver.ts`.
* **Logic:** Emit `<script>weaver.set("s1", 10)</script>` for every signal created to populate the client Sink before logic executes.

---

### **Phase 4: The Client Runtime (The Sink)**

**Goal:** Build the <1kb script that acts as the distributed execution bus.

#### **Step 4.1: The Entry Point**

* **Action:** Create `src/runtime/client.ts`.
* **Logic:** Initialize `window.weaver = { signals: new Map() }` and the global event listener.

#### **Step 4.2: Event Delegation & Resolution**

* **Action:** Implement the event handler.
1. Parse the wire format JSON from `data-action`.
2. `await import(binding.m)`.
3. Resolve dependencies from `weaver.signals` Map.
4. Invoke logic and update the Sink at `binding.id` with the result.



#### **Step 4.3: State Proxy (Optimistic UI)**

* **Action:** Wrap Signal values in a `Proxy`.
* **Logic:** When `signal.value = x` happens, update the Map and all DOM nodes marked with `data-bind="id"`.

---

### **Phase 5: Integration & Demo**

**Goal:** Prove "Zero-Hydration" interactivity and Higher-Order Actions.

#### **Step 5.1: The "Recursive Transformation" Demo**

* **Action:** Create `actions/total.ts` and `components/Cart.tsx`.
* **Requirement:** Prove that one action can consume the output ID of another action with full TypeScript verification.

#### **Step 5.2: End-to-End Test**

* **Scenario:** Click a button -> Load logic -> Update Sink -> UI reflects change -> All without hydration.
