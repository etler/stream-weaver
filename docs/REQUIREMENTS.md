# 📝 Product Requirements Document (PRD): Stream Weaver

## 1. Executive Summary

**Stream Weaver** is a next-generation web framework designed to deliver **Zero-Hydration** applications via a **Canonical Stream** architecture. It treats the entire application (Transport, Logic, UI, State) as a serializable stream of **Universal Addresses**.

The goal is to build a Proof of Concept (PoC) that validates the core hypothesis: **Explicit Addressability + Source Phase Imports + Component-Action Unification = The Highest Possible Performance with Zero Runtime Magic.**

## 2. Core Pillars

1. **Transport:** Sequential, recursive `ReadableStream` of HTML + Data Frames.
2. **Logic & UI:** Stateless modules referenced via **Source Phase Imports** (`import source`).
3. **State:** Universal Signals allocated anywhere. No positional "Rules of Hooks."
4. **Runtime:** A <1kb "Signal Sink" that resolves addresses (IDs) to values, data, or DOM fragments in linear order.

## 3. Technical Specifications

### 3.1. The API Surface (Universal Factories)

The framework must expose an API that treats state, logic, and UI as first-class, addressable data.

* **`createSignal(initialValue)`**: Allocates a reactive address (`s1`). Returns `{ kind: 'state', id, value }`.
    * **Requirement:** Must be callable globally, in loops, or inside components.

* **`createAction(src, deps, key)`**:
    * **Input:** A `ModuleSource` handle, an array of dependency IDs (`deps`), and an export name (`key`).
    * **Behavior:** Binds a code URL to a unique ID (e.g., `a1`).
    * **Spread Pattern:** Logic functions receive dependencies as individual positional arguments.
    * **Return:** An `ActionBinding` representing the **virtual result** of the logic.

* **`createComponent(src, props, key)`**:
    * **Implicit Usage:** Triggered by Capitalized JSX tags (`<UserCard />`).
    * **Behavior:** Identical to `createAction` but identifies the result as a **DOM Portal**.
    * **Return:** A `ComponentBinding` representing the **Physical UI Slot**.

### 3.2. The Bundler Integration (Vite)

**Role:** Ensure Logic and Component files are treated as addressable assets.

* **Requirement 3.2.1:** Support **Source Phase Imports** (Stage 3).
* **Requirement 3.2.2:** Enforce **Per-Interaction Code Splitting**.
* **Requirement 3.2.3:** **JSX Transformer.**
    * Convert `<Component />` into `weaver.createComponent(src, props, key)`.
    * Ensure native tags (`div`, `span`) remain static Loom instructions.

### 3.3. The Runtime (Linear Signal Sink)

**Role:** The client-side execution bus that resolves IDs.

* **Requirement 3.3.1:** Maintain a `store` (Map<Address, Value>) and `registry` (Map<Address, Definition>).
* **Requirement 3.3.2:** **Recursive & Positional Resolution.**
    * Map dependency IDs (`deps`) to values recursively and **spread** them into the resolved module function.
    * **Lazy Loading:** Only `import()` the source when resolution is requested.
* **Requirement 3.3.3:** **Universal Slot Swapping.**
    * If a `ComponentBinding` changes its value, the Sink must find the corresponding **Portal (`data-w-id`)** and surgically swap the DOM.
* **Requirement 3.3.4:** **Surgical DOM Updates.**
    * Use `data-w-bind="id"` for text content.
    * Use `data-w-id="id"` for component portals.

### 3.4. The Transport (The Unified Wire Format)

**Role:** The server-side orchestrator.

* **Requirement 3.4.1:** **Everything is an ID.**
* **Requirement 3.4.2:** **Registration Frames (Explicit Protocol).**
    * Signals: `<script>weaver.set("s1", value)</script>`
    * Actions: `<script>weaver.registerAction("a1", { src, key, deps })</script>`
    * Portals: `<div data-w-id="c1" data-w-src="..." data-w-key="..." data-w-deps="...">`
* **Requirement 3.4.3:** **Sequential Delivery.**
    * The server guarantees that definitions (State/Actions) arrive before or alongside their usage in the HTML stream.

## 4. Implementation Phase 1: The "Walking Skeleton"

### Step 1: Build Setup
* Vite config for `import source` URL resolution.

### Step 2: Universal Allocation
* Implement `createSignal`, `createAction`, and `createComponent` as ID generators.

### Step 3: The Stream Pipeline
* Implement the decoupled server pipeline:
    * `ComponentDelegate` (Logic Resolver -> Markers)
    * `SignalSerializer` (Markers -> Protocol Tokens)
    * `ComponentSerializer` (Tokens -> HTML String)

### Step 4: The Sink (The Bus)
* Implement the <1kb runtime (`src/runtime/client.ts`) that performs **Lazy Recursive Resolution**.

### Step 5: The Loop (Component Swap)
* **Success Metric:** Change a signal -> Trigger a Resolver Action -> Resolver returns a new Component Binding -> Sink fetches new component and swaps the DOM portal.

## 5. Constraints & Non-Goals

* **NO** VDOM. The Sink performs surgical updates or total portal swaps.
* **NO** Hydration. Components are executed on the client **only** when they need to be born or changed.
* **NO** Framework-aware logic. Functions must be pure and signal-ignorant.

## 6. Testing Strategy

* **Signature Stability:** Verify that the positional argument order in the source module matches the `deps` array in the binding.
* **Component Isolation:** Verify that a component portal can be updated without re-running any other code in the application.
