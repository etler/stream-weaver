# Stream Weaver: The Canonical Stream Architecture

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

We treat executable code exactly like strings or numbers. Logic is a serializable value. By leveraging **Source Phase Imports**, we treat code as a static asset to be delivered only when needed.

### III. Explicit Over Implicit (No Magic)

We reject "Automatic Closure Capture."

* **Bad (Implicit):** `() => count.value++` (Relies on closure magic).
* **Good (Explicit):** `(count) => count + 1` (Pure function, explicit input).

### IV. Universal Allocation

Because every entity is an **Explicitly Addressed Pointer**, we eliminate positional memory constraints (Rules of Hooks).

* **Deterministic Factories:** `createSignal` and `createAction` allocate addresses.
* **No Boundaries:** Factories can be called anywhere—inside loops, components, or global files. The framework cares only about the **Address**.

## 4. High-Level Approach

### Layer 1: The Transport (Addressable DOM)

The backbone is a parallel, recursive `ReadableStream`.

* **The Sink as Registry:** The client-side runtime (The Sink) uses the DOM as its address book.
* **Surgical Holes:** Signals are bound to specific text nodes or attributes via IDs (`data-w-id`).
* **Interactive Portals:** Custom components are bound via Action IDs and Source URLs (`data-w-src`).

### Layer 2: The Factory (Implicit Signal Boundaries)

The JSX transform automates the "Plumbing" of addressability:

* **Native Tags (`div`, `span`):** Compiled to static strings with surgical signal holes. Zero overhead.
* **Custom Components (`<UserCard />`):** Automatically wrapped in an addressable **Component Signal**.
* **Automatic Wrapping:** The return value of any Action or Component is automatically wrapped in a Signal, making the entire UI a **Recursive Reactive Graph**.

### Layer 3: The Engine (The Signal Sink)

The client-side runtime is a <1kb **Signal Sink**. It does not "render" components; it acts as a **Distributed Resolver**.

* **It Listens:** Captures stream updates for signal values.
* **It Resolves:** When a signal changes, it identifies affected **Component Addresses**.
* **It Executes:** It lazy-loads the module source, spreads the current signal values into the pure function, and performs a surgical DOM transplant.

## 5. Design Goals

### I. Zero-Hydration / Zero-Waste

By isolating logic into **Pure Modules**, we guarantee per-interaction tree shaking. A "Buy Button" loads *only* the code required for that button. The code used to render the page on the server is never downloaded by the client.

### II. Fractal Resumability

Any component can be re-resolved in isolation. You don't need a "Root" or a "Provider." You just need the **Action Address** and the **Signal IDs**.

### III. Isomorphic Purity

Our strict isolation model enforces "Clean Room" development. Functions receive context only via arguments (Spread Pattern). The same logic executes on the Server, in a Web Worker, or on the Client without modification.

### IV. The "Standardized Referencing" Standard

We bet on the Platform:

* **Source Phase Imports:** (Stage 3 ECMAScript) for code addressing.
* **Streams API:** For recursive, out-of-order delivery.
* **ES Modules:** For native lazy-loading.
