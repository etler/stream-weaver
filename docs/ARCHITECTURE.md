# Stream Weaver: The Canonical Stream Architecture

## 1. Mission Statement

To eliminate the barrier between Server and Client by treating the entire application lifecycle—rendering, state, and logic—as a **single, continuous, serializable stream of addresses**.

Stream Weaver rejects the "Hydration" model (React) and the "Magical Closure" model (Qwik) in favor of a **Canonical Stream**: a recursive, type-safe flow of data and logic that executes identically on the server and the browser.

## 2. The Need: Escaping the "Uncanny Valley"

Modern web development is stuck in a compromise between two extremes:

1. **The Hydration Tax (React/Next.js):** To make HTML interactive, the browser must re-download and re-execute the entire component tree. This creates massive bundle bloat and CPU-heavy "waterfalls."
2. **The Resumability Trap (Qwik):** To avoid hydration, frameworks use complex compilers to "capture" closures and serialize state. While performant, this introduces "Magic"—invisible cognitive load, fragile refactoring, and accidental serialization of massive objects.

**The Industry Gap:**
There is no framework that offers **Zero-Hydration performance** while maintaining **Architectural Transparency**. Developers want the raw speed of HTML streaming but are forced to accept "Black Box" compilers to get it. Stream Weaver fills this gap by demanding **Explicitness**.

## 3. Core Philosophy

### I. The Network is the Computer

We build **Universal Components** that exist on a stream.

* A component is just a function that writes to a `ReadableStream`.
* A "State Update" is just a JSON frame pushed to that same stream.
* The browser is not a "Runtime"; it is a **Sink** that reacts to the stream.

### II. Explicit Over Implicit (No Magic)

We reject "Automatic Closure Capture."
In a distributed system, implicitly capturing variables from a parent scope is dangerous.
**The Rule of Signals:** *Logic must be stateless. Dependencies must be explicit.*

* **Bad (Implicit):** `() => count.value++` (Relies on closure magic).
* **Good (Explicit):** `(s) => s.value++` (Pure function, explicit input).

### III. Logic is Data (The Law of Addressability)

We treat executable code (functions) exactly like strings or numbers. Logic is a serializable value that can be referenced, hashed, cached, and streamed. By leveraging **Source Phase Imports**, we treat code as a static asset to be delivered only when needed.

### IV. Universal Allocation (Ignoring the "Rules of Hooks")

Because every entity in Stream Weaver is an **Explicitly Addressed Pointer** (via a unique ID), we eliminate the positional memory constraints of traditional frameworks.

* **Deterministic Factories:** We use `createSignal` and `createAction` to allocate addresses.
* **No Boundaries:** These factories can be called anywhere—inside components, in global utility files, or inside dynamic loops. The framework never relies on call order; it only cares about the **Address**.

## 4. High-Level Approach

### Layer 1: The Transport (Recursive Stream)

The backbone is a parallel, recursive `ReadableStream`.

* **No VDOM Diffing:** The server pushes HTML strings directly.
* **Out-of-Order Streaming:** Signals and Logic references can be streamed *before, during, or after* the HTML they bind to.

### Layer 2: The Logic (Source Handles & Factory API)

To solve the "Bundler Problem," we utilize **Source Phase Imports** (`import source`).

* **`createSignal<T>(value)`**: Allocates a reactive slot in the global Sink.
* **`createAction(source, signals)`**: Generates a **Binding**—a serializable bundle of a code URL and dependency IDs.
* **Derived Logic**: Actions can return Signals. This creates a **Distributed Call Stack** where the output of one action becomes the addressable dependency of another.

### Layer 3: The Engine (The Signal Sink)

The client-side runtime is a <1kb **Signal Sink**. It does not "render" components; it acts as an address resolver.

* **It Listens:** It captures the stream of Signal updates (`s1 = 5`).
* **It Binds:** It maps DOM events to `data-action` JSON bindings.
* **It Executes:** When an event fires, it lazy-loads the module, injects the current Signal values by ID, and executes the logic.

## 6. Design Goals

### I. Ergonomics without "Magic"

We prioritize **Architectural Transparency**. If data crosses a network boundary, you must explicitly declare it. This ensures you never accidentally ship a 5MB closure because you referenced a variable you shouldn't have.

### II. The "Standardized Referencing" Standard

We use **Source Phase Imports** (`import source`). The build tool handles chunk generation and URL stability automatically using standard ECMAScript syntax. You get the performance of a manual registry with the DX of standard imports.

### III. Type Safety as the First Defense

We leverage TypeScript generics to bridge the gap. By analyzing the imported Action Module, we infer the exact shape of the data it requires. If an action returns a Signal, the compiler ensures that any consuming action expects that specific type.

### IV. Surgical Efficiency (The "Zero-Waste" Bundle)

By isolating logic into **Pure Action Modules**, we guarantee **Per-Interaction Tree Shaking**. A "Buy Button" handler loads *only* the code required to process that purchase.

### V. Isomorphic Purity

Our strict isolation model enforces "Clean Room" development. Functions are pure and stateless, receiving their context only via arguments. The same reducer can execute on the Server, in a Web Worker, or on the Client without modification.

### VI. Standards over Proprietary Systems

We bet on the Platform:

* **Transport:** `ReadableStream` (Standard Streams API).
* **Code:** **Source Phase Imports** (Stage 3 ECMAScript Proposal).
* **Loading:** Dynamic `import()` (Standard ES Modules).
