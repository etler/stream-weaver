# 🚀 PITCH.md: The Vision for Stream Weaver

## What is Stream Weaver?

Stream Weaver is a **resumable web framework** built entirely around **streams and serializable signals**. It treats the entire application lifecycle—rendering, state management, and logic execution—as a single, continuous, and serializable stream that flows from the server to the browser. By rejecting both the "Hydration" model of React (which re-runs code) and the "Implicit Magic" of Qwik (which guesses closures), Stream Weaver creates a unified, type-safe protocol where pure logic modules bind directly to explicit state signals.

This architecture fills the gap between raw performance and developer control. Modern frameworks force a choice: accept the performance penalty of **Hydration** (re-downloading and executing entire component trees) or accept the complexity of **Compiler Magic** (opaque serialization of closures that causes fragile "black box" bugs). Stream Weaver solves this by enforcing **Explicit Dependency Injection**: developers explicitly pass state signals into isolated logic blocks. This ensures that what crosses the network is exactly what you intended—no more, no less.

The result is **surgical efficiency**. Because logic is defined in pure, isolated Action Files (referenced via standard `import source`) and state is managed through serializable signal IDs, the client-side runtime is a tiny (<1kb) "Sink" that simply listens to the stream and binds events. This delivers the fastest possible Time-to-Interactive with **Per-Interaction Tree Shaking**, guaranteeing that users only download the code for the buttons they actually click.

---

## The Core Value Proposition

### 1. Escape the "Uncanny Valley"

Current frameworks create a period where the UI looks ready but is unresponsive (The Hydration Gap). Stream Weaver eliminates this.

* **No Components run in the browser.**
* **No Hydration waterfall.**
* **No "Replay" of server logic.**
* **Result:** The HTML is the interface. The Signal Sink makes it alive instantly.

### 2. Ergonomics without "Magic"

We prioritized **Architectural Transparency** over "Compiler Cleverness."

* **Qwik** uses `$` to magically capture your scope. When it breaks or over-serializes, you are debugging the compiler.
* **Weaver** uses standard **Source Phase Imports** (`import source`). You treat code as data using the platform's native mechanism. Logic lives in standard, testable `.ts` files, not inside opaque closures.

### 3. The "Formula 1" Architecture

We stripped out the "Automatic Transmission" to give architects total control.

* **Transport:** Recursive `ReadableStream` (No VDOM).
* **Logic:** **Action Files** referenced via `import source` (Stage 3 Proposal).
* **State:** Explicit, Serializable Signal IDs.
* **Safety:** Build-time Type Inference guarantees the Client respects the Server's logic requirements.

---

## The Future: A Distributed Compute Protocol

Stream Weaver is not just a UI library; it is a proposal for a **Distributed Compute Protocol**. By standardizing how Logic and State travel over the wire, we unlock a future where the Browser, Edge, and Server are just peer nodes in a continuous mesh.

### 1. Universal Compute (The "Docker for Functions")

Because we treat Logic (Action Files) as addressable assets, code is no longer tethered to where it was authored.

* **Write Once, Run Anywhere:** A reducer function can execute on the Server (SSR), move to the Client (Interaction), or be offloaded to a **Web Worker** (Heavy Math) without changing a single line of code.
* **Differentiation:** Unlike Qwik, which serializes specific JS closures (tying you to the main thread), Weaver serializes **Content-Addressable Module Handles**. This is portable compute.

### 2. The Delegate Stream (Structural Parallelism)

We are bringing "Unix Pipes" to the HTTP layer, solving the hardest problem in parallel computing: **The Join**.

In typical parallel systems, combining results from multiple threads is complex and prone to race conditions (the "Janky UI" problem). Stream Weaver solves this natively through its Transport layer.

* **The Mechanism (Anchors):** The Weaver Main Stream emits the "Skeleton" of the page immediately. Crucially, it writes **Stream Anchors** (e.g., `<div id="slot-1">`) into the HTML in strict document order.
* **The Router (The Sink):** As parallel Delegate Streams (from Edge Nodes or Workers) yield data, they tag their chunks with that ID. The Client Sink acts as a **Spatial Router**, directing the arriving data into the pre-reserved Anchor in the DOM.
* **One Stream to Rule them All** Delegate streams allows all control signals to exist on one stream. There is a single entrypoint into the entire application providing predictability and reproducability. Actions come in order while being processed out of order to maintain async efficiency.
* **The Benefit:** This guarantees **Structural Locking**. A slow-loading Header will never "pop" in below the Footer, because its slot in the DOM was reserved by the Main Stream milliseconds after the request started.
* **Result:** The browser gets the throughput of parallel threading with the visual stability of a single synchronous stream.

### 3. Protocol Agnosticism

JSON is just the placeholder. The architecture is ready for raw binary speed.

* **Binary Mesh:** Since our protocol is just "URL Handles + Signal IDs," we can swap JSON for binary formats (Protobuf/WASM).
* **WASM Ready:** An "Action File" in the future could be a WASM binary streamed directly to a worker, with Signals acting as the shared memory interface.

---

## Summary: The Post-Single-Threaded Web

If Qwik is the "Fastest way to boot a React app" (Linear Optimization), **Stream Weaver is the architecture for the Post-Single-Threaded Web (Mesh Architecture).**

We are not just solving Startup Time; we are solving **Computational Scale**. We are building the mesh that lets the Server, the Client, and the Edge work as one.
