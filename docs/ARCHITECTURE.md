# Stream Weaver: The Canonical Stream Architecture

## 1. Mission Statement

To eliminate the barrier between Server and Client by treating the entire application lifecycle—rendering, state, and logic—as a **single, continuous, serializable stream**.

Stream Weaver rejects the "Hydration" model (React) and the "Magical Closure" model (Qwik) in favor of a **Canonical Stream**: a recursive, type-safe flow of data and logic that executes identically on the server and the browser.

## 2. The Need: Escaping the "Uncanny Valley"

Modern web development is stuck in a compromise between two extremes:

1. **The Hydration Tax (React/Next.js):** To make HTML interactive, the browser must re-download and re-execute the entire component tree. This creates massive bundle bloat and CPU-heavy "waterfalls."
2. **The Resumability Trap (Qwik):** To avoid hydration, frameworks use complex compilers to "capture" closures and serialize state. While performant, this introduces "Magic"—invisible cognitive load, fragile refactoring, and accidental serialization of massive objects.

**The Industry Gap:**
There is no framework that offers **Zero-Hydration performance** while maintaining **Architectural Transparency**. Developers want the raw speed of HTML streaming but are forced to accept "Black Box" compilers to get it.

Stream Weaver fills this gap by demanding **Explicitness**. We believe that if you want a system to be distributed, serializable, and hyper-efficient, you should not hide that reality behind a compiler—you should design for it.

## 3. Core Philosophy

### I. The Network is the Computer

We do not build "Server Components" and "Client Components." We build **Universal Components** that exist on a stream.

* A component is just a function that writes to a `ReadableStream`.
* A "State Update" is just a JSON frame pushed to that same stream.
* The browser is not a "Runtime"; it is a **Sink** that reacts to the stream.

### II. Explicit Over Implicit (No Magic)

We reject "Automatic Closure Capture."
In a distributed system, implicitly capturing variables from a parent scope is dangerous. It leads to "Overserialization" (shipping 50kb of data when you needed 5 bytes) and brittle code that breaks when moved.

**The Weaver Law:** *Logic must be stateless. Dependencies must be explicit.*

* **Bad (Implicit):** `() => count.value++` (Relies on closure magic).
* **Good (Explicit):** `([s]) => s.value++` (Pure function, explicit input).

### III. Logic is Data

We treat executable code (functions) exactly like strings or numbers. Logic is a serializable value that can be referenced, hashed, cached, and streamed.
By leveraging **Source Phase Imports**, we obtain a handle to the *source* of a module without executing it, treating code as a static asset to be delivered only when needed.

### IV. Type Safety as a Contract

We do not sacrifice safety for performance. The boundary between the "Module" (Logic) and the "Signal" (State) is enforced by TypeScript. If the Logic expects a `Number`, the Compiler prevents you from streaming a `String`.

## 4. High-Level Approach

Stream Weaver achieves this vision through three distinct architectural layers.

### Layer 1: The Transport (Recursive Stream)

The backbone of the framework is a parallel, recursive `ReadableStream`.

* **No VDOM Diffing:** The server pushes HTML strings directly.
* **Out-of-Order Streaming:** Signals and Logic references can be streamed *before, during, or after* the HTML they bind to.
* **Isomorphism:** The same stream protocol drives SSR (initial load) and subsequent navigation (client-side routing).

### Layer 2: The Logic (Source Handles)

To solve the "Bundler Problem," we utilize the **Source Phase Import** pattern (`import source`).

* Developers write logic in **Action Files**: `actions/increment.ts`.
* These files are imported as **Source Handles**: `import source increment from './actions/increment'`.
* **Benefit:** This guarantees **Per-Interaction Tree Shaking**. The server never executes the client logic; it simply passes a reference (URL). The code for "Clicking the Buy Button" is only loaded when the user clicks the button.

### Layer 3: The Engine (The Signal Sink)

The client-side runtime is a <1kb **Signal Sink**. It does not "render" components. It acts as a binder.

* **It Listens:** It captures the stream of Signal updates (`s1 = 5`).
* **It Binds:** It maps DOM events to Module URLs.
* **It Executes:** When an event fires, it lazy-loads the module via dynamic import, injects the current Signal values, and executes the logic.

## 6. Design Goals

Stream Weaver is built on the belief that true developer productivity comes from **predictability**, not shortcuts. We optimize for the *maintenance* of code, not just the speed of writing the first line.

### I. Ergonomics without "Magic"

We reject the industry trend of using complex compilers to hide the reality of the platform.

* **The Problem:** Frameworks that rely on "Magic Capture" (like Qwik’s `$`) reduce typing but increase cognitive load. When performance degrades or serialization fails, the developer is forced to debug the compiler's decision-making process.
* **The Weaver Way:** We prioritize **Architectural Transparency**. If data crosses a network boundary (server to client), you must explicitly declare it. This ensures that a developer never accidentally ships a 5MB closure because they referenced a variable they shouldn't have.
* *Result:* Debugging is strictly about your code, never the framework's "guesses."



### II. The "Standardized Referencing" Standard

We eliminate proprietary "Registry Patterns" in favor of platform primitives.

* **The Problem:** High-performance frameworks often force developers to manually register actions in separate files and map function names to string IDs to achieve serializability.
* **The Weaver Way:** We use **Source Phase Imports** (`import source`). The build tool handles the chunk generation and URL stability automatically using standard ECMAScript syntax.
* *Result:* You get the performance of a manual registry with the DX of standard imports.



### III. Type Safety as the First Defense

We believe that the boundary between Server Logic and Client State is the most dangerous part of a web app, and therefore requires the strongest guarantees.

* **The Problem:** Most RPC or Streaming frameworks treat server calls as "Black Boxes," losing type safety or requiring manual casting.
* **The Weaver Way:** We leverage TypeScript generics to bridge the gap. By analyzing the imported Action Module, we infer the exact shape of the data it requires and enforce that the dependency list matches it perfectly.
* *Result:* If your logic expects a Number, the compiler will physically prevent you from streaming a String.



### IV. Surgical Efficiency (The "Zero-Waste" Bundle)

We design for the "Architect," not just the "Prototyper."

* **The Problem:** Implicit imports lead to massive bundles because bundlers must be conservative about what code *might* be used.
* **The Weaver Way:** By isolating logic into **Pure Action Modules**, we guarantee **Per-Interaction Tree Shaking**. A "Buy Button" handler loads *only* the code required to process that purchase, completely decoupled from the rest of the application bundle.

### V. Isomorphic Purity

We ensure that code is portable by default.

* **The Problem:** Writing code that accidentally relies on browser-specific APIs (like `window`) or server-specific APIs (like `fs`) breaks the ability to run logic anywhere.
* **The Weaver Way:** Our strict isolation model enforces "Clean Room" development. Functions are pure and stateless, receiving their context only via arguments.
* *Result:* The same reducer function can execute on the Server (SSR), in a Web Worker, or on the Client Main Thread without modification.



### VI. Standards over Proprietary Systems

We bet on the Platform, not on the Framework.

* **The Problem:** Frameworks often invent proprietary serialization formats (custom JSON dialects) or runtime loaders that lock you into their ecosystem. If the framework dies, your architecture dies.
* **The Weaver Way:** We build on top of **Web Standards**.
* **Transport:** `ReadableStream` (Standard Streams API).
* **Code:** **Source Phase Imports** (Stage 3 ECMAScript Proposal).
* **Loading:** Dynamic `import()` (Standard ES Modules).
* *Result:* Your application is just a collection of standard JavaScript functions and Streams. It is future-proof by definition.
