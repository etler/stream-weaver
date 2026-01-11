# 📝 Product Requirements Document (PRD): Stream Weaver

## 1. Executive Summary

**Stream Weaver** is a next-generation web framework designed to deliver **Zero-Hydration** applications via a **Canonical Stream** architecture. It treats the entire application (Transport, Logic, State) as a serializable stream of **Universal Addresses**.

The goal is to build a Proof of Concept (PoC) that validates the core hypothesis: **Explicit Addressability + Source Phase Imports = The Highest Possible Performance with Zero Runtime Magic.**

## 2. Core Pillars

1. **Transport:** Recursive, out-of-order `ReadableStream` of HTML + Data Frames.
2. **Logic:** Static Action Files referenced via **Source Phase Imports** (`import source`).
3. **State:** Universal Signals allocated anywhere. No positional "Rules of Hooks."
4. **Runtime:** A <1kb "Signal Sink" that resolves addresses (IDs) to values or code.

## 3. Technical Specifications

### 3.1. The API Surface (Universal Factories)

The framework must expose an API that treats state and logic as first-class, addressable data.

* **`createSignal(initialValue)`**: Allocates a reactive address. Returns `{ value, id }`.
* **Requirement:** Must be callable globally, in loops, or inside components.


* **`createAction(logicHandle, dependencies)`**:
* **Input:** A `ModuleSource` handle and an array of `Address` IDs (Signals or other Actions).
* **Behavior:** Binds the logic URL to a unique ID (e.g., `a1`).
* **Return:** A `Binding` object that satisfies the `Signal` interface (allowing actions to be passed to other actions).


* **`html` tagged template**: A loom that detects `Binding` objects in attributes and serializes them into the wire format.

### 3.2. The Bundler Integration (Vite)

**Role:** Ensure Logic files are treated as addressable assets.

* **Requirement 3.2.1:** Support **Source Phase Imports** (Stage 3).
* *Behavior:* `import source x from './file'` results in a `ModuleSource` containing the public URL.


* **Requirement 3.2.2:** Enforce **Per-Interaction Code Splitting**.
* *Validation:* Actions must be emitted as separate chunks and *not* included in the main bundle.


* **Requirement 3.2.3:** Type Safety (Inference).
* Ensure TypeScript infers the return type of an action module so `createAction` can act as a **Derived Signal Factory**.



### 3.3. The Runtime (Signal Sink)

**Role:** The client-side execution bus that resolves IDs.

* **Requirement 3.3.1:** Maintain a `Map<Address, Value>` (The Signal Sink).
* **Requirement 3.3.2:** Implement **Recursive Resolution**.
* If an action depends on an ID that belongs to another action (`a_id`), the Sink must ensure the dependency logic executes or resolves before the consumer runs.


* **Requirement 3.3.3:** Universal Event Delegation.
* Parse `data-action` attributes and dynamically `import()` the code.


* **Requirement 3.3.4:** Surgical DOM Updates.
* Use a `data-bind="id"` strategy to update specific nodes when a value at an address changes.



### 3.4. The Transport (The Unified Wire Format)

**Role:** The server-side orchestrator.

* **Requirement 3.4.1:** **Everything is an ID.** Dependencies in the stream are always string pointers (`"s1"`, `"a1"`).
* **Requirement 3.4.2:** **Registration Frames.**
* Signals: `weaver.set("s1", value)`
* Actions: `data-action='{"id":"a1", "module":"/url.js", "signals":["s1"]}'`


* **Requirement 3.4.3:** Out-of-Order Execution.
* Emit frames as soon as an address is allocated, regardless of tree depth.



## 4. Implementation Phase 1: The "Walking Skeleton"

*Goal: A derived logic chain (Action A -> Action B -> UI).*

### Step 1: Build Setup

* Configure Vite to treat `import source` as a URL provider.

### Step 2: Universal Allocation

* Implement `createSignal` and `createAction` as ID generators that work outside of the component lifecycle.

### Step 3: The Sink (The Bus)

* Implement the client runtime that fetches code and resolves IDs from a flat Map.

### Step 4: The Loop (Chain Explosion)

* **Success Metric:** Create one action that doubles a number, and a second action that formats that number. Verify the UI updates correctly using only the second action's ID.

## 5. Constraints & Non-Goals

* **NO** "Rules of Hooks." If an ID is addressable, it is valid.
* **NO** VDOM. The Sink performs surgical `textContent` or attribute updates.
* **NO** Implicit State. If it’s not in the Sink, it doesn’t exist for the logic.

## 6. Testing Strategy

* **Address Stability:** Verify that a signal created at the top of a module has the same ID across multiple requests if intended (or unique IDs per request if isolated).
* **Composition Safety:** Verify TS fails if `Action B` expects a `Signal<string>` but is passed the result of `Action A` which returns `Signal<number>`.

---

## 7. User Stories

> **Story A: The Global Signal**
> "As a developer, I want to define a signal in a shared `state.ts` file and use it in ten different components without 'Context Providers' or 'Prop Drilling'."

> **Story B: The Action Chain**
> "As a developer, I want to create a 'Validation Action' that returns a boolean signal, and pass that signal into a 'Submit Action' as a dependency, all via serialized IDs."

> **Story C: The Dynamic Loom**
> "As an AI agent streaming a UI, I want to dynamically generate a new button and a new action handler in the middle of a stream, assigning them unique addresses that the browser can immediately resolve."
