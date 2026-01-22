### 1. Core Architecture

* **Universal Addressability:** Every piece of state (Signal) and code (Logic) is assigned a unique, stable ID, existing independently of component boundaries.
* **Isomorphic Execution:** The same component, action, and computed logic code executes on both the server (SSR) and the client (interactive updates).
* **Zero-Hydration Boot:** The client runtime reconstructs the reactivity registry purely from the HTML stream's inline scripts, requiring no re-execution of render logic or double-mounting on the client.
* **DelegateStream Engine:** A stream-based execution model that allows components to spawn child components as parallel streams while guaranteeing sequential HTML output order.

### 2. Reactivity System (Signals)

* **State Signals:** Writable primitives created via `createSignal<T>` that hold values and trigger updates.
* **Computed Signals:** Derived values created via `createComputed` that automatically re-execute when dependencies change. They receive read-only access to their dependencies.
* **Actions:** Imperative logic created via `createAction` that can mutate State Signals. These are explicitly invoked (not automatic) to prevent circular dependencies.
* **Event Handlers:** Specialized actions created via `createHandler` that receive the DOM `Event` object as their first argument.
* **Signal Serialization:** All addressable entities (signals, logic, actions) are serializable to JSON-compatible formats for transmission over the wire.

### 3. Logic & Module System

* **Addressable Logic:** Code is treated as an immutable, addressable signal (`kind: 'logic'`) referenced by ID.
* **Type-Safe Imports:** APIs accept standard TypeScript dynamic imports (e.g., `import("./logic")`), which are used for compile-time type inference of props and dependencies.
* **Build-Time Transformation:** A bundler plugin intercepts `import()` patterns, assigning stable IDs and generating manifests for public URL resolution.
* **Lazy Loading:** Logic modules are fetched and executed on the client only when needed (e.g., when an interaction occurs or a dependency changes).

### 4. Component Model

* **Component Definitions:** Reusable templates created via `createComponent` that wrap a logic reference.
* **Reactive Nodes:** Component instances created via `createNode` (or JSX). These are reactive entities that re-execute when their prop signals change.
* **Content-Addressable Identity:** Node IDs are deterministically generated based on the component logic ID and its props, enabling automatic deduplication and stable identity without explicit keys.
* **JSX Integration:** A custom JSX factory (`jsx()`) that automatically handles signal binding and component instantiation.
* **Recursive Parallel Rendering:** Components can spawn child components to arbitrary depth, all executing in parallel.

### 5. Rendering & The Sink

* **Bind Points:** Reactive regions in the DOM marked by HTML comments (e.g., `...`). Updates replace the content between markers wholesale.
* **Attribute Binding:** Support for binding signals to HTML attributes using `data-w-{attr}` markers.
* **The Sink (Client Reducer):** A lightweight (~1KB) client-side agent that maps signal IDs to DOM ranges and applies updates received via Sync Messages.
* **Event Delegation:** Global event listeners that route DOM events to the appropriate Weaver handlers based on `data-w-onclick` (and similar) attributes.

### 6. Advanced Execution Capabilities

* **Async Logic:** Support for logic functions that return Promises; the framework awaits resolution before propagating values.
* **Deferred Logic:** A mechanism (`timeout` option) to defer long-running operations. If a timeout threshold is exceeded, the stream emits a `PENDING` sentinel or initial value to avoid blocking, delivering the result later via a swap script.
* **Server-Side Logic:** Logic signals marked with `context: 'server'` (via `createServerLogic`) that never run in the browser. Client invocations automatically proxy the request to a `/weaver/execute` endpoint.
* **Client-Side Logic:** Logic marked with `context: 'client'` (via `createClientLogic`) that executes only in the browser (useful for accessing `window` or `localStorage`).
* **Worker Logic:** Logic signals marked with `context: 'worker'` (via `createWorkerLogic`) that execute in a background Worker thread. This allows heavy CPU-bound tasks to run without blocking the main UI thread.
* **Suspense:** A built-in component that renders fallback content while its child nodes are in a `PENDING` state.
* **Stream Signals:** The `createStream` primitive for reducing `ReadableStream` sources (like WebSockets) into reactive signal values.
