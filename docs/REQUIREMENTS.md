# 📝 Product Requirements Document (PRD): Stream Weaver

## 1. Executive Summary

**Stream Weaver** is a next-generation web framework designed to deliver **Zero-Hydration** applications via a **Canonical Stream** architecture. It treats the entire application (Transport, Logic, State) as a serializable stream.

The goal is to build a Proof of Concept (PoC) that validates the core hypothesis: **Explicit Dependency Injection + Source Phase Imports = The Highest Possible Performance with Zero Runtime Magic.**

## 2. Core Pillars

1. **Transport:** Recursive, out-of-order `ReadableStream` of HTML + Data Frames.
2. **Logic:** Static Action Files referenced via **Source Phase Imports** (`import source`).
3. **State:** Explicit Signals passed as IDs. No implicit closure capture.
4. **Runtime:** A <1kb "Signal Sink" that binds Logic to DOM events.

## 3. Technical Specifications

### 3.1. The API Surface (Developer Experience)

The framework must expose a minimal, React-like API but with strict constraints.

* `createSignal(initialValue)`: Creates a reactive primitive. Returns `{ value, id }`.
* `createAction(logicHandle, dependencies)`:
* **Input:** A `ModuleSource` object (from `import source`) and an array of Signals.
* **Behavior:** Binds the logic URL to the dependencies.
* **Return:** A string ID or event handler attribute for the DOM.


* `html` tagged template: A streaming template literal that handles promises and signal placeholders.

### 3.2. The Bundler Integration (Vite)

**Role:** To ensure that Logic files are treated as static assets, not executed bundles.

* **Requirement 3.2.1:** Support **Source Phase Imports** (Stage 3).
* *Behavior:* `import source x from './file'` must result in a `ModuleSource` object containing the public URL of the chunk.


* **Requirement 3.2.2:** Enforce **Per-Interaction Code Splitting**.
* *Validation:* Verify that imported action files are emitted as separate chunks (e.g., `assets/action-B5x.js`) and are *not* included in the main bundle.


* **Requirement 3.2.3:** Type Safety.
* Ensure TypeScript correctly infers the type of the source handle to validate `createAction` dependencies.



### 3.3. The Runtime (Signal Sink)

**Role:** The client-side engine that executes logic.

* **Requirement 3.3.1:** Maintain a `Map<SignalID, Value>` (The Signal Store).
* **Requirement 3.3.2:** Expose a global entry point (e.g., `window.weaver`) to receive stream data.
* **Requirement 3.3.3:** Implement Event Delegation.
* Listen to bubbling events (click, input) on `document`.
* Parse the `data-action` attribute from the target.
* `import()` the module path found in the attribute (The URL from Step 3.2.1).


* **Requirement 3.3.4:** Create **State Proxies**.
* When logic runs `args[0].value++`, the proxy must:
1. Update the local store.
2. Update the DOM immediately (Optimistic UI).
3. (Future) Push the update back to the server.





### 3.4. The Transport (Server Stream)

**Role:** The orchestrator that renders HTML and Data.

* **Requirement 3.4.1:** Render HTML strings immediately as they are generated.
* **Requirement 3.4.2:** Support **Out-of-Order Flushing**.
* If a Signal is defined *after* the HTML header is sent, emit a `<script>` tag to register it in the Sink.


* **Requirement 3.4.3:** Serialization Format.
* Signals: `["s1", 0]`
* Actions: `{ module: "/assets/action.js", signals: ["s1"] }`



## 4. Implementation Phase 1: The "Walking Skeleton"

*Goal: A counter button that increments.*

### Step 1: The Build Setup

* Initialize a Vite project with TypeScript.
* Configure Vite (or a lightweight plugin) to handle `import source` syntax (or a polyfill syntax if Stage 3 tooling is partial).
* **Success Metric:** Importing a file via `import source` logs a URL object, not the module exports.

### Step 2: The Signal System

* Implement `createSignal` and a basic `html` tag.
* **Success Metric:** Render static HTML with a signal value injected.

### Step 3: The Runtime Sink

* Implement `client.ts` with the event delegation logic.
* **Success Metric:** Clicking the button triggers the dynamic `import()` of the action file URL.

### Step 4: The Loop

* Implement the State Proxy inside the Sink.
* **Success Metric:** Clicking the button updates the DOM text from "0" to "1".

## 5. Constraints & Non-Goals (v1)

* **NO** VDOM or Diffing. Direct DOM updates only.
* **NO** complex reactivity (computed signals, effects) in v1. Direct read/write only.
* **NO** hydration. The HTML sent is final; only specific nodes marked with `data-bind` change.

## 6. Testing Strategy

* **Type Safety:** Verify that `createAction` throws a TypeScript error if the imported action's type signature does not match the passed signals.
* **Isolation:** Verify that the Action File is never executed on the server, only referenced.

---

### 7. User Stories (for Coding Assistants)

> **Story A: The "Code as Data" Flow**
> "As a developer, I want to import my logic file as a reference (URL) so that I can bind it to a button without bundling it into the main thread."

> **Story B: The Safety Net**
> "As a developer, I want the build to fail if I pass the wrong signal type to an external action file, ensuring the contract between View and Logic is broken."

> **Story C: The Lazy Load**
> "As a user, I want the JavaScript for the 'Checkout' button to only download when I actually click 'Checkout', not when the page loads."
