# 🚀 PITCH.md: The Vision for Stream Weaver

## What is Stream Weaver?

Stream Weaver is a **distributed execution bus** built entirely around **Universal Addressability**. It treats the entire application lifecycle—rendering, state management, and logic execution—as a single, continuous, and serializable stream of pointers that flows from the server to the browser. By rejecting both the "Hydration" model of React and the "Compiler Magic" of Qwik, Stream Weaver creates a unified, type-safe protocol where logic and state are treated as identical, addressable data.

This architecture fills the gap between raw performance and developer control. Modern frameworks force a choice: accept the performance penalty of **Hydration** or accept the complexity of **Compiler Magic**. Stream Weaver solves this by enforcing **Explicit Addressability**: every signal and action is a stable, unique ID. This ensures that what crosses the network is exactly what you intended—an explicit "plan" for interactivity that requires zero runtime guessing.

The result is **unbounded flexibility**. Because we use a **Universal Factory** model (`createSignal`, `createAction`), state and logic are freed from the "Component Prison." They can exist anywhere—in global constants, inside dynamic loops, or within utility files—enabling a "ChainExplode" pattern where the application literally weaves its own interactive capabilities in real-time as the stream arrives.

---

## The Core Value Proposition

### 1. Beyond the "Rules of Hooks"

Traditional frameworks rely on positional memory, forcing developers to follow strict rules about where and when they can create state. Stream Weaver uses **Addressable Pointers**.

* **Create Anywhere:** Define signals in global constants or generate actions inside `map()` loops.
* **No Positional Magic:** Because every entity has a unique ID, the framework never "guesses" which state belongs to which variable.
* **Result:** Total architectural freedom and the elimination of the most common reactive programming bugs.

### 2. Logic as Data (The "Holy Grail" Architecture)

We treat executable code handles exactly like strings or numbers.

* **Action Chains:** An action can return a signal. An action can receive another action as a dependency.
* **The Mesh:** You can pass a "Validation Action" into a "Submit Action" as a serialized pointer. The server flushes a "Plan," and the client executes the "Logic Lego" bricks as needed.
* **Result:** Complex, nested interactivity with zero hydration cost and full type safety across the wire.

### 3. The "Formula 1" Transport

We stripped out the "Automatic Transmission" of VDOM and Hydration to give architects a high-throughput execution engine.

* **Transport:** Recursive `ReadableStream` (No VDOM).
* **Logic:** **Action Files** referenced via `import source` (Stage 3 Proposal).
* **State:** Explicit, Serializable Signal IDs.
* **The Loom:** The `html` tag acts as a weaver, serializing code URLs and state IDs into a surgical, 1kb runtime.

---

## The Future: A Distributed Compute Protocol

Stream Weaver is not just a UI library; it is a proposal for a **Distributed Compute Protocol**. By standardizing how Logic and State travel over the wire, we unlock a future where the Browser, Edge, and Server are just peer nodes in a continuous mesh.

### 1. Universal Compute (The "Docker for Functions")

Because we treat Logic as addressable assets, code is no longer tethered to where it was authored.

* **Write Once, Run Anywhere:** A reducer can execute on the Server, move to the Client, or be offloaded to a Web Worker without changing a single line of code.
* **Portable Compute:** Unlike frameworks that serialize JS closures (tying you to the main thread), Weaver serializes **Content-Addressable Module Handles**.

### 2. The "ChainExplode" Operation (Structural Parallelism)

We are bringing "Unix Pipes" to the UI layer, allowing applications to expand their work dynamically.

* **Dynamic Expansion:** As an AI agent or a database streams data, the framework calls `createAction` on the fly for every new item.
* **Structural Stability:** The Main Stream emits the "Skeleton" and reserves **Stream Anchors**. Parallel Delegate Streams fill these slots, ensuring a slow-loading header never causes a layout shift by popping in below the footer.
* **Async Efficiency:** Actions arrive in order while being processed out of order, maintaining maximum async throughput without sacrificing predictability.

### 3. Protocol Agnosticism

Since our protocol is just "URL Handles + Signal IDs," we can swap JSON for raw binary speed (Protobuf/WASM). The Signal Sink is ready to act as the shared memory interface for a high-performance WASM mesh.

---

## Summary: The Post-Single-Threaded Web

If Qwik is the "Fastest way to boot a React app," **Stream Weaver is the architecture for the Post-Single-Threaded Web.**

We have moved beyond "Startup Time" into the realm of **Computational Scale**. By admitting that logic and state are just addressed data on a stream, we have built the mesh that lets the Server, the Client, and the Edge work as one unified, recursive engine.
