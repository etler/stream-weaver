# Development Planning: Stream Weaver MVP POC**

This document outlines the step-by-step execution plan to build the **Stream Weaver MVP** using the **Source Phase Import** architecture.

---

### **Phase 1: Foundation & Tooling**

**Goal:** Configure the build system to treat Action Files as static assets (`import source`) and establish the project structure.

#### **Step 1.1: Vite Configuration**

* **Action:** Update `vite.config.ts` (or create a lightweight plugin).
* **Requirement:** Ensure that importing a file with `?url` (the MVP proxy for `import source`) returns the public URL of the emitted chunk, not the executed code.
* **Verification:** Create a test file `src/test-action.ts`. Import it in `index.ts` using the configured syntax. Log the result. It must be a string (URL), and the browser network tab should *not* load the file automatically.

#### **Step 1.2: Project Structure**

* **Action:** Create standard directories.
* `src/actions/` (Logic files)
* `src/components/` (UI Components)
* `src/runtime/` (Client Sink & Signals)



---

### **Phase 2: The Core Protocol**

**Goal:** Enable the server to serialize "Code Handles" and "Signals" into HTML attributes.

#### **Step 2.1: Define the `Binding` Type**

* **Action:** Create `src/types/Binding.ts`.
* **Content:** Define the interface for the wire protocol.
```typescript
export interface Binding {
  module: string;         // Module URL
  export?: string;        // Export name (default: "default")
  signals: string[];      // Dependency Signal IDs
}
```



#### **Step 2.2: Implement `createAction**`

* **Action:** Create `src/createAction.ts`.
* **Logic:**
* Accept a `ModuleSource` (URL string for MVP) and dependency array.
* Return a opaque `Binding` object (or a special string marker) that the serializer can recognize.



#### **Step 2.3: Upgrade `ComponentSerializer**`

* **Action:** Modify `src/ComponentHtmlSerializer/ComponentSerializer.ts`.
* **Logic:**
* In `serializeAttributes`, check if a prop value is a `Binding` object.
* If yes, serialize it as `data-action='{"module":"...","signals":[...]}'`.
* *Constraint:* Ensure proper JSON escaping within the HTML attribute.



---

### **Phase 3: The Signal System**

**Goal:** Create the reactive primitives that live on both server and client.

#### **Step 3.1: Implement `createSignal**`

* **Action:** Create `src/runtime/Signal.ts`.
* **Logic:**
* `createSignal<T>(initial: T)` returns `{ id: string, value: T }`.
* **Server-Side:** Generates a unique ID (incrementing counter).
* **Client-Side:** Registers itself in a global registry (`window.weaver.signals`).



#### **Step 3.2: Implement `StreamWeaver.context**`

* **Action:** Update `StreamWeaver.ts` to expose the signal registry.
* **Logic:** Allow the Weaver to flush `<script>` tags that initialize signals on the client (`window.weaver.set("s1", 0)`).

---

### **Phase 4: The Client Runtime (The Sink)**

**Goal:** Build the <1kb script that brings the HTML to life.

#### **Step 4.1: The Entry Point**

* **Action:** Create `src/runtime/client.ts`.
* **Logic:**
* Initialize `window.weaver = { signals: new Map(), ... }`.
* Add a global `click` event listener to `document`.



#### **Step 4.2: Event Delegation & Loading**

* **Action:** Implement the event handler in `client.ts`.
1. `e.target.closest('[data-action]')`.
2. `JSON.parse` the attribute.
3. `await import(binding.module)`.
4. Resolve signal values from `binding.signals` IDs.
5. Invoke the module's default export with `[signals]`.



#### **Step 4.3: State Proxy (Optimistic UI)**

* **Action:** Wrap the signals passed to the action in a `Proxy`.
* **Logic:**
* **Set Trap:** When `signal.value = x` happens:
1. Update local Map.
2. Find all DOM nodes bound to this signal (requires a DOM marking strategy, e.g., `` text nodes or `data-bind="s1"`).
3. Update their `textContent`.





---

### **Phase 5: Integration & Demo**

**Goal:** Prove "Zero-Hydration" interactivity.

#### **Step 5.1: The "Counter" Demo**

* **Action:** Create `src/components/Counter.tsx` and `src/actions/increment.ts`.
* **Code:**
* `increment.ts`: `export default ([s]) => s.value++`.
* `Counter.tsx`: Standard button using `createSignal` and `import source`.



#### **Step 5.2: End-to-End Test**

* **Action:** Create a browser test (Playwright/Puppeteer or manual).
* **Scenario:**
1. Load page. Check network (no `increment.js`).
2. Click button. Check network (`increment.js` loads).
3. Verify DOM updates from 0 to 1.



---

### **Execution Order**

1. **Step 1.1** (Vite Config)
2. **Step 2.3** (Serializer Update)
3. **Step 3.1** (Signals)
4. **Step 4.1 & 4.2** (Client Runtime)
5. **Step 5.1** (Demo Integration)
