# Development Planning: Stream Weaver MVP POC

This document outlines the execution plan to build the **Stream Weaver MVP** using the **Source Phase Import** architecture, treating components as addressable signals.

---

### **Phase 1: Foundation & Tooling**

**Goal:** Configure the build system to treat Action and Component files as static assets (`import source`) and establish the project structure.

#### **Step 1.1: Vite Configuration**

* **Action:** Update `vite.config.ts`.
* **Requirement:** Ensure that `import source` (or the `?url` proxy) returns the public URL of the emitted chunk.
* **Verification:** Log an imported component source in `index.ts`. It must be a string (URL).

#### **Step 1.2: Project Structure**

* `src/actions/`: Stateless logic files (Data Transformers).
* `src/components/`: Pure UI functions (Loom Transformers).
* `src/runtime/`: The Signal Sink and ID management logic.

---

### **Phase 2: The Core Protocol (The Addressable Factory)**

**Goal:** Enable the server to serialize "Code Handles" and "Signals" into a unified format while maintaining full Type Safety.

#### **Step 2.1: The Type System (The Developer Contract)**

* **Action:** Create `src/types/Addressable.ts`.
* **Requirement:** Define how Signals, Actions, and Components are represented.

```typescript
export type Address = string; // e.g., "s1", "a1", "c1"

export interface Signal<T> {
  id: Address;
  value: T;
}

// Bindings are "Calculated Signals" (Actions or Components)
export interface Binding<T = any> extends Signal<T> {
  module: string;     // URL to the code chunk
  signals: Address[]; // Array of positional dependency IDs (Spread arguments)
  export: string;     // Named export (default: "default")
  type: 'action' | 'component';
}

```

#### **Step 2.2: The Wire Format (The Network Contract)**

* **Action:** Define the serialized representation for the `html` loom.
* **Logic:** Use the DOM as the registry to save bytes.
* **Surgical Binding:** For raw values: `<span data-w-bind="s1"></span>`.
* **Addressable Portal:** For components:

```html
<div data-w-id="c1" data-w-src="/Profile.js" data-w-deps="s1,s2"></div>

```

#### **Step 2.3: Implement `createAction` & `addressable**`

* **Action:** Create `src/factories.ts`.
* **Logic:** * Accept a `ModuleSource` and a dependency array.
* **Spread Inference:** Use TypeScript to ensure the dependency array matches the positional arguments of the source function.
* Return a `Binding` object.


* **JSX Integration:** The compiler wraps capitalized tags in `weaver.addressable()`.

#### **Step 2.4: Upgrade `ComponentSerializer**`

* **Action:** Modify `src/ComponentHtmlSerializer/ComponentSerializer.ts`.
* **Logic:** Detect `Binding` objects. If `type: 'component'`, render the wrapper `div` with `data-w-src` and `data-w-deps`. Execute the component once on the server to fill the initial innerHTML.

---

### **Phase 3: The Universal Signal System**

**Goal:** Create reactive primitives that ignore the "Rules of Hooks" and work anywhere.

#### **Step 3.1: Implement `createSignal**`

* **Action:** Create `src/runtime/Signal.ts`.
* **Logic:** Returns the `Signal<T>` interface.
* **Allocation:** Can be defined as a global constant or within a dynamic loop/component.

#### **Step 3.2: Implement `StreamWeaver.context` (The Value Weave)**

* **Action:** Update `StreamWeaver.ts`.
* **Logic:** Emit `<script>weaver.set("s1", 10)</script>` for every signal created to populate the client Sink before logic executes.

---

### **Phase 4: The Client Runtime (The Sink)**

**Goal:** Build the <1kb script that acts as the distributed execution bus.

#### **Step 4.1: The Entry Point**

* **Action:** Create `src/runtime/client.ts`.
* **Logic:** Initialize `window.weaver = { signals: new Map() }` and the global event/signal observer.

#### **Step 4.2: Resolution & The Spread Invoke**

* **Action:** Implement the resolver.

1. Parse the wire format from `data-w-src` and `data-w-deps`.
2. `await import(moduleURL)`.
3. **The Spread:** Map dependency IDs to current values: `const args = deps.map(id => weaver.get(id))`.
4. **Execution:** `const result = module.default(...args)`.
5. **Update:** * If Action: Update Sink Map.
* If Component: Surgically swap innerHTML of the `data-w-id` container.



#### **Step 4.3: State Proxy (Optimistic UI & Surgicality)**

* **Action:** Wrap Signal values in a `Proxy`.
* **Logic:** When `signal.value = x` happens:
1. Update Map.
2. Sync all `data-w-bind="id"` nodes (Surgical text updates).
3. Mark dependent `data-w-id` portals as "Dirty" for re-resolution.



---

### **Phase 5: Integration & Demo**

**Goal:** Prove "Zero-Hydration" interactivity and Component Swapping.

#### **Step 5.1: The "Component Switcher" Demo**

* **Action:** Create `actions/view-resolver.ts` and components `Login/Profile`.
* **Requirement:** Prove that changing an `isLoggedIn` signal triggers the Sink to fetch and swap the entire component portal without a page reload.

#### **Step 5.2: End-to-End Test**

* **Scenario:** Click a button -> Update Signal -> Trigger Resolver Action -> Resolver returns new JSX Binding -> Sink swaps UI -> **Total bytes executed < 2kb.**
