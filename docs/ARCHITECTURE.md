# 📐 Stream Weaver: Architecture & Vision

## 1. Vision & Mission

Stream Weaver is a **distributed execution bus** built entirely around **Universal Addressability**. It treats the entire application lifecycle—rendering, state management, and logic execution—as a single, continuous, and serializable stream of pointers that flows from the server to the browser.

**Mission Statement:**
To eliminate the barrier between Server and Client by treating the entire application as a **single, continuous, serializable stream of operations**. Stream Weaver rejects both the "Hydration" model (React) and the "Magical Closure" model (Qwik) in favor of a **Canonical Stream**: a recursive, type-safe flow of data where the Client is simply a continuation of the Server's execution context, processing events instead of requests.

This architecture fills the gap between raw performance and developer control. Modern frameworks force a choice: accept the performance penalty of **Hydration** or accept the complexity of **Compiler Magic**. Stream Weaver solves this by enforcing **Explicit Addressability**: every signal and action is a stable, unique ID. This ensures that what crosses the network is exactly what you intended—an explicit "plan" for interactivity that requires zero runtime guessing.

The result is **unbounded flexibility**. Because we use a **Universal Factory** model (`createSignal`, `createAction`, `createComponent`), state and logic are freed from framework rules. They can exist anywhere; in global constants, inside dynamic loops, or within utility files. This enables a "ChainExplode" pattern where the application literally weaves its own interactive capabilities in real-time as the stream arrives.

---

## 2. The Problem Space: Escaping the "Uncanny Valley"

Modern web development is stuck in a compromise between two extremes:

1. **The Hydration Tax (React/Next.js):** To make HTML interactive, the browser must re-download and re-execute the entire component tree. This creates massive bundle bloat and CPU-heavy "double execution."
2. **The Resumability Trap (Qwik):** To avoid hydration, frameworks use complex compilers to "capture" closures. While performant, this creates "Black Box" magic and accidental serialization of massive objects.

**The Industry Gap:**
Stream Weaver fills the gap by demanding **Architectural Honesty**. It transforms "Explicitness" from a tax into a **Superpower**, giving developers the ability to address any part of a distributed system using a unified pointer within a continuous stream.

### Framework Comparisons

#### Stream Weaver vs. React (Next.js / RSC)

The dominant paradigm is **Hydration**. React sends HTML, then sends the JavaScript to re-build that HTML and its memory state.

| Feature | React / Next.js (RSC) | Stream Weaver |
| --- | --- | --- |
| **State Model** | **Positional:** State is tied to a component's location in the tree. | **Addressable:** State is a global ID (`s1`) reachable from anywhere. |
| **Rules of Hooks** | **Strict:** Hooks must be at the top level, in order, in components. | **None:** `createSignal` can be called in loops, globals, or utilities. |
| **Interactivity** | **Hydration:** Re-runs component logic to attach listeners. | **Resumption:** Sink resolves IDs to DOM nodes instantly. |
| **Data Flow** | **Tree-Bound:** Prop drilling or Context Providers. | **Direct:** Any Action can import any Signal ID directly. |

**The Weaver Advantage:**
- **Escape the "Component Prison":** You don't need a "Context Provider" to share state across the app. You just export a signal from a `.ts` file.
- **Zero Double Execution:** The server renders; the client only executes the specific action clicked.

#### Stream Weaver vs. Qwik

Qwik shares our goal of Resumability but achieves it through **Implicit Compiler Magic**. Weaver achieves it through **Explicit Architectural Standards**.

| Feature | Qwik | Stream Weaver |
| --- | --- | --- |
| **Logic Extraction** | **Compiler-Driven:** `$(...)` captures closures. | **Address-Driven:** `import source` references modules. |
| **State Scope** | **Component-Local:** State must be inside `component$`. | **Universal:** State can be global or local singletons. |
| **Reactivity** | **Proxy-Tree:** Serializes a graph of objects. | **Flat Sink:** Serializes a flat Map of IDs. |
| **Standardization** | **Proprietary:** Custom `q-json` and optimizer. | **Standard:** Stage 3 **Source Phase Imports**. |

**The Weaver Advantage:**
- **"Honest" State:** In Qwik, it's easy to accidentally serialize a massive parent object because of a closure. In Weaver, you only serialize what you explicitly pass to the dependency array.
- **No Compiler Debugging:** You never have to wonder why a variable didn't serialize; if it's not an ID in the array, it's not there.

#### Stream Weaver vs. Wiz (Google Internal)

Wiz is the gold standard for "Action-State" separation but is notoriously difficult to author.

| Feature | Wiz | Stream Weaver |
| --- | --- | --- |
| **Authoring** | **Registry Pattern:** Manual string IDs for every action. | **Factory Pattern:** `createAction` uses standard imports. |
| **Type Safety** | **Manual:** Hard to sync template types with logic. | **Automatic:** TS infers types from the `source` handle. |
| **Composition** | **Limited:** Actions are usually flat handlers. | **Recursive:** Actions can return signals and be nested. |

**The Weaver Advantage:**
- **Modern DX:** We provide the "Holy Grail" power of the Wiz model (Action Registries) but automate it using standard TypeScript. You get the world's most performant architecture with the DX of a modern framework.

#### The "Holy Grail" Comparison: Addressability

| The Rule | The Rest of the World | **Stream Weaver** |
| --- | --- | --- |
| **Where can I create state?** | Inside a Component. | **Anywhere (Global, Loop, Utility).** |
| **How is state tracked?** | By its position in the tree. | **By its unique Address (ID).** |
| **Can logic return state?** | Usually via re-renders or state-lifting. | **Directly (Actions return Signals).** |
| **Can I nest logic?** | Only via component composition. | **Yes (Actions can depend on Actions).** |

---

## 3. Core Philosophy

### I. The Component is an Action

A Component is not a template; it is a **Pure UI Action**.

* It takes **Raw Values** as arguments (delivered via spread).
* It returns a **Stream Instruction** (compiled JSX).
* It is **Environment-Agnostic**: It can run on the server to emit HTML tokens or on the client to emit DOM Patch tokens. **It never runs twice.**

### II. Logic is Data (The Law of Addressability)

We treat executable code exactly like strings or numbers. Logic is a serializable value. By leveraging **Source Phase Imports** (Stage 3), we treat code as a static asset to be delivered only when needed.

**Logic Composition:**
- Actions receive signals as dependencies and can mutate them
- Computed logic receives signals as read-only dependencies and produces output
- Components receive signals as read-only dependencies and produce DOM output
- You can compose complex behaviors by connecting these primitives through signal references
- The server transmits the "plan" (signal definitions and logic references), and the client executes only what's needed
- Result: Complex, nested interactivity with zero hydration cost and full type safety across the wire

### III. Sources vs Dependents (Mutation Control)

Circular dependencies are prevented through an architectural constraint: only **Sources** can mutate state, while **Dependents** can only read.

* **Sources (Mutators):**
  - `createSignal()` - Creates state that can be written to
  - `createAction()` - Receives writable signal references, can mutate via `.value =`
  - Explicitly invoked by user interactions, not automatically triggered

* **Dependents (Observers):**
  - `createComputed()` - Receives read-only signal references, re-executes when dependencies change
  - `createComponent()` - Receives read-only signal references, re-renders when dependencies change
  - Automatically triggered by signal updates, cannot mutate

This architectural separation makes circular dependencies impossible by design. Computed logic and components can never trigger themselves—only actions (which are imperative) can cause mutations.

### IV. Explicit Over Implicit (No Magic)

We reject "Automatic Closure Capture." Logic must be explicitly bound.

* **Bad (Implicit):** `() => count.value++` (Relies on closure magic).
* **Good (Explicit):** `createAction(incSrc, [count])` (Pure function, explicit input).

**No Positional Magic:**
- Because every entity has a unique ID, the framework never "guesses" which state belongs to which variable
- Create signals in global constants or generate actions inside `map()` loops
- Result: Total architectural freedom and elimination of the most common reactive programming bugs

### V. State is Stream Context

State is not a "place" in a database or a global store. State is the **accumulated context** of the stream itself.

* **Registry as Context:** The stream maintains a scope (Registry) that evolves as it processes definitions.
* **Updates as Flow:** A "State Update" is just a message flowing down the stream that modifies this context for future operations.

---

## 4. Architectural Approach

### The "Formula 1" Transport

We stripped out the "Automatic Transmission" of VDOM and Hydration to give architects a high-throughput execution engine.

* **Transport:** Recursive `ReadableStream` (No VDOM)
* **Logic:** Action Files referenced via `import source` (Stage 3 Proposal)
* **State:** Explicit, Serializable Signal IDs
* **The Weaver:** Serializes code URLs and state IDs into a surgical, ~1kb runtime

### Layer 1: Isomorphic Stream Orchestration

The core engine is the **Stream Weaver**. It functions identically on Server and Client, transforming inputs into addressable operations.

* **Server:** Request → Execute Components → Stream HTML + Signal Definitions
* **Client:** DOM Event → Execute Action → Update Signals → Re-execute Dependents

The Client Weaver is the Server Weaver running in the browser, accepting **Events** as input instead of HTTP Requests.

### Layer 2: The Server Weaver (HTML Production)

The server orchestrates the initial render.

1. **Component Delegate:** Executes logic and yields `Binding Markers` and `Registration Scripts`.
2. **HTML Serializer:** Converts the stream into HTML bytes.
   * **Bindings:** Emitted as `<!--^id-->...<!--/id-->` ranges.
   * **Context:** Emitted as `<script>weaver.push(...)</script>` to prime the client's stream context.

### Layer 3: The Client Weaver (Interaction Processing)

The client runtime continues where the server left off, processing user interactions through the same stream architecture.

1. **Event Listening:** Captures DOM events (e.g., `click`) and matches them to Action IDs
2. **Action Execution:** Loads and executes the action logic with its signal dependencies
3. **Signal Updates:** Actions mutate signals, triggering reactive updates
4. **Dependent Re-execution:** Computed signals and components that depend on changed signals re-execute automatically
5. **DOM Updates:** New output is sent to the Binding Sink for surgical DOM replacement

### Layer 4: The Binding Sink

The final consumer is a dumb, lightweight (~1kb) **DOM Patcher**. It is not a runtime; it is a sink.

* **It Tracks:** It maintains a Map of active DOM ranges (Binding Markers) found in the HTML.
* **It Patches:** It consumes the Client Weaver's output stream. When it receives a sync message, it blindly replaces the content of the corresponding bind point range.

---

## 5. Design Goals

### I. Zero-Hydration / Zero-Waste

By isolating logic into **Pure Modules**, we guarantee per-interaction tree shaking. A "Buy Button" loads *only* the code required for that button. The code used to render the page on the server is never downloaded by the client.

### II. Time-Travel Continuity

Because the entire client session is a linear stream of operations derived from events, the application state is deterministic. Replaying the Event Stream guarantees the exact same DOM state, unlocking trivial Time-Travel Debugging.

### III. Isomorphic Purity

Our strict isolation model enforces "Clean Room" development. Functions receive context only via positional arguments (Spread Pattern). The same logic executes on the Server, in a Web Worker, or on the Client without modification.

**Write Once, Run Anywhere:**
- A reducer can execute on the Server, move to the Client, or be offloaded to a Web Worker without changing a single line of code
- Unlike frameworks that serialize JS closures (tying you to the main thread), Weaver serializes **Content-Addressable Module Handles**
- **Portable Compute:** Code is not tethered to where it was authored

### IV. The "Standardized Referencing" Standard

We bet on the Platform:

* **Source Phase Imports:** (Stage 3 ECMAScript) for code addressing.
* **Streams API:** For recursive, sequential delivery.
* **ES Modules:** For native lazy-loading.

---

## 6. Future Vision: A Distributed Compute Protocol

Stream Weaver is not just a UI library; it is a proposal for a **Distributed Compute Protocol**. By standardizing how Logic and State travel over the wire, we unlock a future where the Browser, Edge, and Server are just peer nodes in a continuous mesh.

### Universal Compute (The "Docker for Functions")

Because we treat Logic as addressable assets, code is no longer tethered to where it was authored.

* **Write Once, Run Anywhere:** A reducer can execute on the Server, move to the Client, or be offloaded to a Web Worker without changing a single line of code.
* **Portable Compute:** Unlike frameworks that serialize JS closures (tying you to the main thread), Weaver serializes **Content-Addressable Module Handles**.

### The "ChainExplode" Operation (Structural Parallelism)

We are bringing "Unix Pipes" to the UI layer, allowing applications to expand their work dynamically.

* **Dynamic Expansion:** As an AI agent or a database streams data, the framework calls `createAction` on the fly for every new item.
* **Structural Stability:** The Main Stream emits the "Skeleton" and reserves **Stream Anchors**. Parallel Delegate Streams fill these slots, ensuring a slow-loading header never causes a layout shift by popping in below the footer.
* **Async Efficiency:** Actions arrive in order while being processed out of order, maintaining maximum async throughput without sacrificing predictability.

### Protocol Agnosticism

Since our protocol is just "URL Handles + Signal IDs," we can swap JSON for raw binary speed (Protobuf/WASM). The Signal Sink is ready to act as the shared memory interface for a high-performance WASM mesh.

### The Post-Single-Threaded Web

If Qwik is the "Fastest way to boot a React app," **Stream Weaver is the architecture for the Post-Single-Threaded Web.**

We have moved beyond "Startup Time" into the realm of **Computational Scale**. By admitting that logic and state are just addressed data on a stream, we have built the mesh that lets the Server, the Client, and the Edge work as one unified, recursive engine.

---

## 7. Trade-offs & Evaluation

Stream Weaver is **NOT** a general-purpose tool for every use case.

### When NOT to Use Stream Weaver

**Don't use Weaver if:** You are building a high-fidelity, local-first "App" (like a Video Editor or Figma) where the entire state should live in a complex, non-serializable memory graph.

### When to Use Stream Weaver

**Use Weaver if:** You are building **Distributed Applications** (E-commerce, AI Agents, Streaming Platforms) where you need to "ChainExplode" interactivity from a server to a client with zero hydration and maximum speed.

### The "Golden Rule" Comparison

* **React:** "I will trade Startup Performance for high-fidelity Client State."
* **Qwik:** "I will trade Architectural Simplicity for Developer Convenience."
* **Weaver:** "I will trade Developer Convenience (explicitly passing IDs) for **Total Addressability and Unbounded Scale**."

---

## Summary

Stream Weaver represents a fundamental rethinking of web application architecture. By treating the entire application as a continuous stream of addressable operations, we achieve:

- **Zero Hydration** - No double execution, no wasted downloads
- **Universal Addressability** - State and logic anywhere, no positional constraints
- **Explicit Architecture** - What you see is what crosses the wire
- **Isomorphic Execution** - Same code runs on server, client, workers
- **Future-Ready** - Protocol agnostic, ready for multi-threaded compute

The framework demands explicitness but rewards it with unbounded architectural flexibility and optimal performance characteristics. It's not the easiest path, but it's the most honest one—and for distributed applications operating at scale, honesty in architecture translates directly to performance and maintainability.
