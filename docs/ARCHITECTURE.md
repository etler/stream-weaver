# 📐 Stream Weaver: The Canonical Stream Architecture

## 1. Mission Statement

To eliminate the barrier between Server and Client by treating the entire application lifecycle—rendering, state, and logic—as a **single, continuous, serializable stream of operations**.

Stream Weaver rejects the "Hydration" model (React) and the "Magical Closure" model (Qwik) in favor of a **Canonical Stream**: a recursive, type-safe flow of data where the Client is simply a continuation of the Server's execution context, processing events instead of requests.

## 2. The Need: Escaping the "Uncanny Valley"

Modern web development is stuck in a compromise between two extremes:

1. **The Hydration Tax (React/Next.js):** To make HTML interactive, the browser must re-download and re-execute the entire component tree. This creates massive bundle bloat and CPU-heavy "double execution."
2. **The Resumability Trap (Qwik):** To avoid hydration, frameworks use complex compilers to "capture" closures. While performant, this creates "Black Box" magic and accidental serialization of massive objects.

**The Industry Gap:**
Stream Weaver fills the gap by demanding **Architectural Honesty**. It transforms "Explicitness" from a tax into a **Superpower**, giving developers the ability to address any part of a distributed system using a unified pointer within a continuous stream.

## 3. Core Philosophy

### I. The Component is an Action

A Component is not a template; it is a **Pure UI Action**.

* It takes **Raw Values** as arguments (delivered via spread).
* It returns a **Stream Instruction** (compiled JSX).
* It is **Environment-Agnostic**: It can run on the server to emit HTML tokens or on the client to emit DOM Patch tokens. **It never runs twice.**

### II. Logic is Data (The Law of Addressability)

We treat executable code exactly like strings or numbers. Logic is a serializable value. By leveraging **Source Phase Imports** (Stage 3), we treat code as a static asset to be delivered only when needed.

### III. Explicit Over Implicit (No Magic)

We reject "Automatic Closure Capture." Logic must be explicitly bound.

* **Bad (Implicit):** `() => count.value++` (Relies on closure magic).
* **Good (Explicit):** `createAction(incSrc, [count])` (Pure function, explicit input).

### IV. State is Stream Context

State is not a "place" in a database or a global store. State is the **accumulated context** of the stream itself.
* **Registry as Context:** The stream maintains a scope (Registry) that evolves as it processes definitions.
* **Updates as Flow:** A "State Update" is just a message flowing down the stream that modifies this context for future operations.

## 4. High-Level Approach

### Layer 1: Isomorphic Stream Orchestration

The core engine is the **Stream Weaver**, powered by the `DelegateStream` primitive. It functions identically on Server and Client, providing ordered consumption of parallel production.

* **Server:** `Request -> Logic Stream -> HTML Stream -> Browser Parser`
* **Client:** `Event -> Logic Stream -> DOM Patch Stream -> DOM Patcher`

The Client Weaver is effectively the Server Weaver running inside the browser, accepting **Events** as its input source instead of HTTP Requests.

### Layer 2: The Server Weaver (HTML Production)

The server orchestrates the initial render.

1.  **Component Delegate:** Executes logic and yields `Binding Markers` and `Registration Scripts`.
2.  **HTML Serializer:** Converts the stream into HTML bytes.
    * **Bindings:** Emitted as `...` ranges.
    * **Context:** Emitted as `<script>weaver.register(...)</script>` to prime the client's stream context.

### Layer 3: The Client Weaver (Interaction Processing)

The client runtime is a living stream instance that continues where the server left off. It uses the **ChainExplode** operation to expand simple events into complex updates.

1.  **Interaction Delegate:** An infinite stream that listens for DOM events (e.g., `click`).
2.  **ChainExplode:** When an event occurs, it matches an Action ID and "explodes" a new **Action Stream** into the pipeline.
3.  **State Conductor:** The Action Stream yields `SignalUpdate` messages. These update the stream's internal Context (Registry) and trigger derived computations.
4.  **Binding Conductor:** Computed values flow into Component functions, which yield `BindingUpdate` messages containing new DOM structures.

### Layer 4: The Binding Sink

The final consumer is a dumb, lightweight (~1kb) **DOM Patcher**. It is not a runtime; it is a sink.

* **It Tracks:** It maintains a Map of active DOM ranges (`Binding Markers`) found in the HTML.
* **It Patches:** It consumes the Client Weaver's output stream. When it receives a `{ id: 'b1', nodes: [...] }` message, it blindly replaces the content of range `b1`.

## 5. Design Goals

### I. Zero-Hydration / Zero-Waste

By isolating logic into **Pure Modules**, we guarantee per-interaction tree shaking. A "Buy Button" loads *only* the code required for that button. The code used to render the page on the server is never downloaded by the client.

### II. Time-Travel Continuity

Because the entire client session is a linear stream of operations derived from events, the application state is deterministic. Replaying the Event Stream guarantees the exact same DOM state, unlocking trivial Time-Travel Debugging.

### III. Isomorphic Purity

Our strict isolation model enforces "Clean Room" development. Functions receive context only via positional arguments (Spread Pattern). The same logic executes on the Server, in a Web Worker, or on the Client without modification.

### IV. The "Standardized Referencing" Standard

We bet on the Platform:

* **Source Phase Imports:** (Stage 3 ECMAScript) for code addressing.
* **Streams API:** For recursive, sequential delivery.
* **ES Modules:** For native lazy-loading.
