# 📐 Stream Weaver: The Canonical Stream Architecture

## 1. Mission Statement

To eliminate the barrier between Server and Client by treating the entire application lifecycle—rendering, state, and logic—as a **single, continuous, serializable stream of addresses**.

Stream Weaver rejects the "Hydration" model (React) and the "Magical Closure" model (Qwik) in favor of a **Canonical Stream**: a recursive, type-safe flow of data and logic where every UI element and every piece of logic is a **Stateless Transformer** residing at a stable address.

## 2. The Need: Escaping the "Uncanny Valley"

Modern web development is stuck in a compromise between two extremes:

1. **The Hydration Tax (React/Next.js):** To make HTML interactive, the browser must re-download and re-execute the entire component tree. This creates massive bundle bloat and CPU-heavy "double execution."
2. **The Resumability Trap (Qwik):** To avoid hydration, frameworks use complex compilers to "capture" closures. While performant, this creates "Black Box" magic and accidental serialization of massive objects.

**The Industry Gap:**
Stream Weaver fills the gap by demanding **Architectural Honesty**. It transforms "Explicitness" from a tax into a **Superpower**, giving developers the ability to address any part of a distributed system (Server or Client) using a unified pointer.

## 3. Core Philosophy

### I. The Component is an Action

A Component is not a template; it is a **Pure UI Action**.

* It takes **Raw Values** as arguments (delivered via spread).
* It returns a **Loom Instruction** (compiled JSX).
* It is **Environment-Agnostic**: It can run once on the server to flush HTML or once on the client to resolve a structural swap. **It never runs twice.**

### II. Logic is Data (The Law of Addressability)

We treat executable code exactly like strings or numbers. Logic is a serializable value. By leveraging **Source Phase Imports** (Stage 3), we treat code as a static asset to be delivered only when needed.

### III. Explicit Over Implicit (No Magic)

We reject "Automatic Closure Capture." Logic must be explicitly bound.

* **Bad (Implicit):** `() => count.value++` (Relies on closure magic).
* **Good (Explicit):** `createAction(incSrc, [count])` (Pure function, explicit input).

### IV. Universal Allocation

Because every entity is an **Explicitly Addressed Pointer** (`s1`, `a1`, `c1`), we eliminate positional memory constraints ("Rules of Hooks").

* **Deterministic Factories:** `createSignal`, `createAction`, and `createComponent` allocate addresses immediately.
* **No Boundaries:** Factories can be called anywhere—inside loops, components, or global files. The framework cares only about the **Address**.

## 4. High-Level Approach

### Layer 1: The Transport (Sequential Delivery)

The backbone is a **Sequential, Recursive Stream** powered by `DelegateStream`.

* **Parallel Production, Ordered Consumption:** The server may execute logic in parallel, but the `AsyncIterableSequencer` ensures that the output (HTML + Scripts) arrives at the client in a strictly deterministic, topological order.
* **The Linear Guarantee:** The client runtime assumes that if Component `c1` depends on Action `a1`, the definition for `a1` has already appeared in the stream.

### Layer 2: The Decoupled Pipeline (Server-Side)

We strictly separate **Logic** from **Serialization** using a composable stream pipeline:

1.  **Component Delegate (Logic Layer):** Resolves Promises and emits high-level `Marker` objects (`Signal`, `Open`, `Close`, `Text`). It knows nothing about HTML.
2.  **Signal Serializer (Protocol Layer):** Transforms Operations into Wire Protocol tokens.
    * `Signal` $\to$ `<script>weaver.set(...)</script>`
    * `Open` $\to$ `<div data-w-id="...">`
3.  **Component Serializer (Syntax Layer):** Converts tokens into escaped HTML strings.

### Layer 3: The Engine (The Linear Sink)

The client-side runtime is a <1kb **Signal Sink**. It acts as a **Distributed Resolver** that expects instructions in linear order.

* **It Registers:** As `<script>` tags stream in, it populates the `weaver.store` (State) and `weaver.registry` (Logic Definitions) immediately.
* **It Listens:** It observes DOM nodes for `data-w-bind` (Text) and `data-w-id` (Portals).
* **It Resolves:** When a signal changes, it triggers the recursive resolution engine:
    1.  Resolve dependencies (`deps`) from the store.
    2.  Lazy-load the module source (`src`).
    3.  Execute the specific export (`key`).
    4.  Surgically update the DOM.

## 5. Design Goals

### I. Zero-Hydration / Zero-Waste

By isolating logic into **Pure Modules**, we guarantee per-interaction tree shaking. A "Buy Button" loads *only* the code required for that button. The code used to render the page on the server is never downloaded by the client.

### II. Linear Resumption

The client resumes interactivity linearly as the stream arrives. There is no "Hydration Phase" that blocks the main thread. If a user clicks a button that has streamed in, the Action ID is already registered, and execution happens instantly.

### III. Isomorphic Purity

Our strict isolation model enforces "Clean Room" development. Functions receive context only via positional arguments (Spread Pattern). The same logic executes on the Server, in a Web Worker, or on the Client without modification.

### IV. The "Standardized Referencing" Standard

We bet on the Platform:

* **Source Phase Imports:** (Stage 3 ECMAScript) for code addressing.
* **Streams API:** For recursive, sequential delivery.
* **ES Modules:** For native lazy-loading.
