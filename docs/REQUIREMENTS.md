# 📝 Product Requirements Document (PRD): Stream Weaver

## 1. Executive Summary

**Stream Weaver** is a next-generation web framework designed to deliver **Zero-Hydration** applications via a **Canonical Stream** architecture. It treats the entire application (Transport, Logic, UI, State) as a serializable stream of **Universal Addresses**.

The goal is to build a Proof of Concept (PoC) that validates the core hypothesis: **Explicit Addressability + Source Phase Imports + Component-Action Unification = The Highest Possible Performance with Zero Runtime Magic.**

## 2. Core Pillars

1. **Transport:** Recursive, out-of-order `ReadableStream` of HTML + Data Frames.
2. **Logic & UI:** Stateless modules referenced via **Source Phase Imports** (`import source`).
3. **State:** Universal Signals allocated anywhere. No positional "Rules of Hooks."
4. **Runtime:** A <1kb "Signal Sink" that resolves addresses (IDs) to values, data, or DOM fragments.

## 3. Technical Specifications

### 3.1. The API Surface (Universal Factories)

The framework must expose an API that treats state, logic, and UI as first-class, addressable data.

* **`createSignal(initialValue)`**: Allocates a reactive address. Returns `{ value, id }`.
* **Requirement:** Must be callable globally, in loops, or inside components.


* **`createAction(logicHandle, dependencies)`**:
* **Input:** A `ModuleSource` handle and an array of `Address` IDs.
* **Behavior:** Binds a code URL to a unique ID (e.g., `a1`).
* **Spread Pattern:** Logic functions receive dependencies as individual positional arguments.
* **Return:** A `Binding` (Signal) representing the **result** of the logic.


* **`addressable(componentHandle, props)`**:
* **Implicit Usage:** Triggered by Capitalized JSX tags (`<UserCard />`).
* **Behavior:** Identical to `createAction` but identifies the result as a **UI Fragment**.
* **Return:** A `ComponentBinding` (Signal) representing the **UI Slot**.



### 3.2. The Bundler Integration (Vite)

**Role:** Ensure Logic and Component files are treated as addressable assets.

* **Requirement 3.2.1:** Support **Source Phase Imports** (Stage 3).
* **Requirement 3.2.2:** Enforce **Per-Interaction Code Splitting**.
* **Requirement 3.2.3:** **JSX Transformer.**
* Convert `<Component />` into `weaver.addressable(ComponentSource, [props])`.
* Ensure native tags (`div`, `span`) remain static Loom instructions.



### 3.3. The Runtime (Signal Sink)

**Role:** The client-side execution bus that resolves IDs.

* **Requirement 3.3.1:** Maintain a `Map<Address, Value>` (The Signal Sink).
* **Requirement 3.3.2:** **Recursive & Positional Resolution.**
* Map dependency IDs to values and **spread** them into the resolved module function.


* **Requirement 3.3.3:** **Universal Slot Swapping.**
* If a `ComponentBinding` changes its value (e.g., returns a different JSX structure), the Sink must surgically swap the DOM at that ID's location.


* **Requirement 3.3.4:** **Surgical DOM Updates.**
* Use `data-w-bind="id"` for text/attributes and `data-w-id="id"` for component portals.



### 3.4. The Transport (The Unified Wire Format)

**Role:** The server-side orchestrator.

* **Requirement 3.4.1:** **Everything is an ID.**
* **Requirement 3.4.2:** **Registration Frames.**
* Signals: `weaver.set("s1", value)`
* Portals: `data-w-id="c1" data-w-src="/UI.js" data-w-deps="s1"`


* **Requirement 3.4.3:** **Out-of-Order Execution.**

## 4. Implementation Phase 1: The "Walking Skeleton"

### Step 1: Build Setup

* Vite config for `import source` URL resolution.

### Step 2: Universal Allocation

* Implement `createSignal`, `createAction`, and `addressable` as ID generators.

### Step 3: The Sink (The Bus)

* Implement the <1kb runtime that fetches code and performs **Spread-based execution**.

### Step 4: The Loop (Component Swap)

* **Success Metric:** Change a signal -> Trigger a Resolver Action -> Resolver returns a new Component Binding -> Sink fetches new component and swaps the DOM portal.

## 5. Constraints & Non-Goals

* **NO** VDOM. The Sink performs surgical updates or total portal swaps.
* **NO** Hydration. Components are executed on the client **only** when they need to be born or changed.
* **NO** Framework-aware logic. Functions must be pure and signal-ignorant.

## 6. Testing Strategy

* **Signature Stability:** Verify that the positional argument order in the source module matches the ID array in the binding.
* **Component Isolation:** Verify that a component portal can be updated without re-running any other code in the application.

---

## 7. User Stories

> **Story A: The Global Signal**
> "As a developer, I want to define a signal globally and have any component in the app surgically update its text content via a `data-w-bind` attribute."

> **Story B: The Lazy UI Switcher**
> "As a developer, I want to return `<AdminPanel />` from a resolver action so that the admin code is only downloaded by the browser if the `isAdmin` signal becomes true."

> **Story C: The Recursive Transformer**
> "As a developer, I want to pass the result of a Data Action as a prop to a Component, ensuring the component only re-resolves when that data actually changes."
