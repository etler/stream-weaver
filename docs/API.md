# Stream Weaver API Documentation

## 1. Introduction

Stream Weaver is an experimental web framework that treats the entire application lifecycle—rendering, state management, and logic execution—as a unified, recursive stream of operations. It combines reactive programming principles with procedural execution patterns, enabling parallel component rendering while maintaining sequential output order.

### Core Philosophy

**Universal Addressability**: Every piece of state and logic has a unique, stable ID. Signals (state) and Logic (code references) are first-class addressable primitives that exist independently of components. This eliminates the "component prison" found in traditional frameworks where state must live inside component boundaries.

**Isomorphic Execution**: The same code runs on server and client. Components, actions, and computed values are authored once and execute in any context—server-side rendering, client-side updates, or even web workers. The framework serializes references to code, not the code itself.

**Reactive + Procedural**: Stream Weaver merges reactive programming (signals that automatically propagate updates) with procedural streaming (explicit control flow via DelegateStream). Developers write synchronous-looking code that coordinates asynchronous parallel execution transparently.

### Key Innovations

**DelegateStream as flatMap Engine**: Built on the DelegateStream primitive from the ChainExplode pattern, Stream Weaver enables recursive stream injection. Components can spawn child components, each running in parallel as independent streams, while the async iterable sequencer maintains sequential output order.

**Zero Hydration**: The server sends HTML plus serialized signal/logic definitions. The client reconstructs the minimal registry needed for interactivity—no re-execution of render logic, no double-mounting components. Interactive elements resolve lazily when users interact with them.

**Bind Points as Reduction Target**: The DOM is treated as a simple sink with bind points (comment markers) serving as anchors. Updates replace entire bind point contents wholesale—no virtual DOM diffing, no reconciliation. The reducer is a ~1KB bind point replacer.

## 2. Core Concepts

### 2.1 Signals

Signals are reactive state containers with universal addressability. Unlike hooks in React, signals are not tied to component execution order or component boundaries. They can be created anywhere—at module level, inside loops, in utility functions, or within components.

**Key Properties**:
- **Unique ID**: Each signal has a globally unique identifier assigned at creation time
- **Reactive**: Updates to a signal automatically propagate to dependent computations
- **Lazy Registration**: Signals register with the Weaver only when bound to the DOM, not at creation time
- **Serializable**: Signal definitions can be serialized and reconstructed across execution contexts

**Signal Objects vs Registry State**:
The type definitions below describe **signal definition objects**—lightweight handles that reference reactive entities. These objects contain metadata (ID, logic references, dependencies) but do not store live state. Actual signal values, computed results, and cached component output live in the **Weaver's registry**. When you read or write a signal (e.g., `count.value`), you're accessing the registry through a getter/setter on the definition object.

**Type Definition**:
```typescript
interface Signal {
  id: string;           // Globally unique identifier (e.g., 's1', 's2')
  kind: string;         // Discriminator for signal type
}

interface StateSignal<T = unknown> extends Signal {
  init: T;              // Initial value
  kind: 'state';
}

interface LogicSignal extends Signal {
  src: string;          // Module URL for runtime import
  kind: 'logic';
  _importPromise?: Promise<any>;  // Non-serializable, TypeScript type anchor only
}

interface ComputedSignal extends Signal {
  logic: string;        // LogicSignal ID reference
  deps: string[];
  kind: 'computed';
}

interface ActionSignal extends Signal {
  logic: string;        // LogicSignal ID reference
  deps: string[];
  kind: 'action';
}

interface HandlerSignal extends ActionSignal {
  kind: 'handler';
}

interface ComponentSignal<T = any> extends Signal {
  id: string;
  kind: 'component';
  logic: string;        // LogicSignal ID reference
  _type?: T;  // Phantom type for TypeScript inference
}

interface NodeSignal extends Signal {
  id: string;
  kind: 'node';
  logic: string;        // LogicSignal ID reference
  props: Record<string, Signal | string | number | boolean | null>;
}

// ReadOnly wrapper for signal mutation control
type ReadOnly<T> = { readonly [K in keyof T]: T[K] };
```

**Signal Mutation Model**:
Stream Weaver prevents circular dependencies through a **Sources vs Dependents** architecture:

- **Sources** (can mutate signals or define immutable references):
  - `createSignal()` - Creates writable signals
  - `createAction()` - Receives `StateSignal<T>` objects with writable `.value`
  - `createLogic()` - Creates immutable logic references (const signal)

- **Dependents** (read-only access):
  - `createComputed()` - Receives `ReadOnly<StateSignal<T>>` objects, cannot mutate
  - `createNode()` - Receive `ReadOnly<StateSignal<T>>` in props, cannot mutate (`createNode` gets automatically called within `jsx()`)

This design prevents loops by ensuring computed signals and component nodes can never mutate the signals they depend on. Only actions (which are explicitly invoked, not automatically triggered) can cause mutations. The readonly constraint is enforced at compile-time via TypeScript - at runtime, signal objects are identical, but TypeScript prevents writes in computed/node contexts.

**Addressable Entities**:
All reactive entities (signals, computed values, actions, logic references, component definitions, nodes) are addressable definitions that get registered with the Weaver. The complete set of addressable types forms a union:

```typescript
type AnySignal =
  | StateSignal
  | LogicSignal
  | ComputedSignal
  | ActionSignal
  | HandlerSignal
  | ComponentSignal
  | NodeSignal;
```

**Creation**:
Signals are created independently of the Weaver or any component context. The `createSignal` function manages global ID allocation to ensure uniqueness across the entire application.

**Registration Timing**:
When a signal appears in a binding position (e.g., `<div>{countSignal}</div>`), the framework:
1. Registers the signal definition with the Weaver
2. Creates bind point markers in the output
3. Records the dependency relationship for reactivity

If a signal is created but never bound, it never enters the stream and remains a simple JavaScript object.

For computed signals, registration is also when initial execution occurs - the computed function runs at registration time to populate its initial value in the registry.

### 2.2 Logic

Logic represents addressable, immutable references to executable code. Logic signals are const signals—they don't change once created, but they're addressable entities that other signals can reference by ID.

**Key Properties**:
- **Signal Type**: Logic is a signal (kind: 'logic') like other addressable entities
- **Immutable**: Once created, logic signals never change (const signal)
- **Reusable**: Created once, referenced by ID from many dependent signals
- **Type-Safe**: Uses `import("...")` as a type anchor for compile-time validation
- **Serializable**: Logic signals register once; dependents reference by ID
- **Isomorphic**: The same module reference resolves to executable code on server and client
- **Lazy**: Code is loaded only when needed via dynamic imports

**Type Definition**:
```typescript
interface LogicSignal extends Signal {
  id: string;               // Stable identifier (build-time assigned)
  src: string;              // Module URL for runtime import
  kind: 'logic';
  _importPromise?: Promise<any>;  // Non-serializable, TypeScript type anchor only
}
```

**Authoring Model**:
Developers use standard TypeScript dynamic imports directly in graph APIs:
```typescript
const doubled = createComputed(import("./double"), [count]);
```

The `import("...")` expression serves as a **type anchor** - TypeScript infers the module's export signature and validates that dependencies match the function parameters at compile time.

**Build-Time Transformation**:
A bundler plugin recognizes these patterns and transforms them to use logic signal IDs:
```typescript
// Before (authored code)
const doubled = createComputed(import("./double"), [count]);

// After (transformed by build plugin)
const doubleLogic = createLogic({ id: "logic1", src: "/assets/double-abc.js" });
const doubled = createComputed(doubleLogic, [count]);
// Or more efficiently, passing the logic signal ID directly:
// const doubled = createComputed("logic1", [count]);
```

The plugin:
- Recognizes `import("...")` patterns
- Creates or references logic signals for each unique module
- Replaces import expressions with logic signal references (by ID)
- Ensures modules are included in the build

**Runtime Execution**:
At runtime, logic is executed by dynamically importing the module:
```typescript
const module = await import(logic.src);  // Fetch and execute module
const result = module.default(count);     // Call exported function
```

**Execution Context**:
Logic modules are pure functions that receive explicit arguments. They have no access to framework internals, global state, or closure variables. This purity enables:
- Execution in any JavaScript context (server, client, worker)
- Predictable behavior independent of execution location
- Optimal tree-shaking and code splitting

### 2.3 Bind Points

Bind points are DOM anchors that mark reactive regions in the rendered output. They serve as targets for updates when signals change, enabling surgical DOM replacements without virtual DOM diffing.

**Implementation**:
Bind points are implemented as HTML comment markers because comments:
- Don't affect DOM structure or layout
- Can wrap arbitrary content (text nodes, elements, or mixed)
- Are lightweight and don't add rendering overhead

**Structure**:
```html
<!--^s1--><div>Content</div><!--/s1-->
```
- Opening marker: `<!--^{signalId}-->`
- Closing marker: `<!--/{signalId}-->`
- Content between markers is controlled by the signal
- The marker ID is the signal ID directly

**Multiple Bindings**:
One signal can have multiple bind points in the DOM:
```html
<div><!--^s1-->5<!--/s1--></div>
<span><!--^s1-->5<!--/s1--></span>
```

The Sink maintains a mapping of signal ID to DOM Ranges:
```typescript
bindPoints: Map<string, Range[]>
// 's1' -> [Range(div content), Range(span content)]
```

When signal `s1` updates, the Sink replaces content in **all** ranges mapped to that signal ID.

**Attribute Bindings**:
Attributes bound to signals use `data-w-{attrname}` to track the binding:
```html
<div class="dark" data-w-classname="s1">Content</div>
```
- Static attributes have no data attribute
- Bound attributes get `data-w-{attrname}` with the signal ID
- When the signal updates, the Sink updates the attribute directly (no comment markers)

Event handlers follow the same pattern:
```html
<button data-w-onclick="a1">Click</button>
```
- JSX prop names map to data attributes (e.g., `onClick` → `data-w-onclick`)
- Event delegation uses these attributes to route events to handlers

**Components as Bind Points**:
Since components are signals, each component instance has its own signal ID:
```html
<!--^c1--><div>Component 1</div><!--/c1-->
<!--^c2--><div>Component 2</div><!--/c2-->
```

**Lifecycle**:
1. **Server Render**: Bind markers stream out as HTML comments with signal IDs
2. **Client Scan**: Sink discovers markers and creates signal ID → Range[] mappings
3. **Updates**: Sink receives sync messages with signal IDs and replaces all associated ranges
4. **Rescan**: After replacement, Sink scans new HTML for nested bind markers

### 2.4 The Weaver

The Weaver is the central orchestrator that manages signal reactivity, logic execution, and stream coordination. It maintains a registry of signals and logic definitions, tracks dependencies, and emits update messages when signals change.

**Core Responsibilities**:
- **Registry Management**: Stores signal and logic definitions indexed by ID
- **Dependency Tracking**: Maintains relationships between signals and dependent computations
- **Reactivity Coordination**: Triggers re-execution of computed values and components when dependencies update
- **Stream Orchestration**: Uses DelegateStream to coordinate parallel component execution with sequential output

**Isomorphic Architecture**:
The Weaver implementation is identical on server and client, but operates in different modes:

**Server Mode**:
- Input: Root component
- Process: Execute components, track bindings, build registry
- Output: HTML stream with inline registration scripts

**Client Mode**:
- Input: User events (clicks, form submissions)
- Process: Execute actions, update signals, re-execute dependents
- Output: Sync messages to the Sink for DOM updates

**Registry Structure**:
```typescript
interface WeaverRegistry {
  definitions: Map<string, AnySignal>;    // All defined entities by ID
  dependencies: Map<string, Set<string>>; // signal ID → dependent IDs
}
```

The registry stores all addressable entities in a single map, indexed by ID. The `kind` discriminator distinguishes between signal types.

**DelegateStream Integration**:
The Weaver uses DelegateStream as its execution engine:
- Components spawn as independent DelegateStreams
- Child streams chain into parent via async iterable sequencer
- Parallel execution maintained while output remains sequential
- Recursive component spawning enabled at arbitrary depth

## 3. Primitive API

### 3.1 createSignal()

Creates a new reactive signal with a globally unique ID and initial value.

**Type Signature**:
```typescript
function createSignal<T>(initialValue: T): StateSignal<T>
```

**Returns**:
A signal object containing:
- `id`: Globally unique identifier
- `value`: Current value (can be read/written)
- `kind`: Type discriminator (`'state'`)

**ID Allocation**:
Stream Weaver uses two ID allocation strategies depending on signal type:

**State Signals (Counter-Based)**:
`createSignal` uses sequential counter-based IDs (`s1`, `s2`, `s3`, ...). Each call allocates a new unique ID:
- Always unique (never reused)
- Globally sequential
- Allocated at creation time

**Computed/Component/Action/Handler Signals (Content-Addressable)**:
These use content-addressable IDs based on hashing their definition signature:
```
ID = hash(logic.src + deps.map(d => d.id).join(','))
```

Since logic is an immutable module reference and deps are immutable signal IDs, the same signature always produces the same ID. This enables automatic deduplication:

```typescript
// First call: allocates c1 = hash("Card" + "s5")
const card1 = createComponent(CardSrc, { data: item1Signal });

// Later, same signature: reuses c1
const card2 = createComponent(CardSrc, { data: item1Signal });
// card1.id === card2.id
```

**Benefits**:
- **Automatic identity stability**: Same logic + deps = same component ID
- **No explicit keys needed**: Solves the "list rendering" problem without key props
- **Definition deduplication**: Prevents redundant registrations and re-execution

**Usage Examples**:

**Module-level signal:**
```typescript
// state/counter.ts
export const count = createSignal(0);
export const theme = createSignal('dark');
```

**Component-local signal:**
```typescript
const MyComponent = () => {
  const localState = createSignal('initial');
  return <div>{localState}</div>;
};
```

**Loop-generated signals:**
```typescript
const items = data.map(item => ({
  id: item.id,
  count: createSignal(0)  // Each item gets its own signal
}));
```

**Not hooks**: Signals can be created conditionally, in loops, or outside components—they are not bound by React's "rules of hooks."

### 3.2 Addressable Logic

Logic signals are immutable, addressable references to executable code modules. They are created once, registered in the weaver, and referenced by ID from dependent signals. This provides efficient serialization and enables logic reuse across multiple dependents.

**Core Concept**:
Logic signals (kind: 'logic') are const signals—they never change after creation. They reference pure function modules that can be loaded and executed in any JavaScript context. The framework provides a type-safe authoring model using standard TypeScript dynamic imports.

**Authoring with Type Safety**:
Use `import("...")` directly in graph APIs to create addressable logic:

```typescript
// Computed signal
const count = createSignal(5);
const doubled = createComputed(import("./double"), [count]);
```

```typescript
// double.ts - The logic module
export default (count: Signal<number>) => count.value * 2;
```

TypeScript automatically infers the function signature from the import and validates that the dependencies match at compile time. If the dependency array doesn't match the function's parameters, TypeScript will error.

**Build-Time Transformation**:
A bundler plugin recognizes `import("...")` expressions in addressable logic positions and transforms them:

```typescript
// What you write (authoring)
const doubled = createComputed(import("./double"), [count]);

// What the build generates (runtime)
const doubled = createComputed(
  { id: "double_a1b2c3", src: "/assets/double-a1b2c3.js" },
  [count]
);
```

The plugin:
1. Assigns a stable, deterministic ID for the module
2. Resolves the public URL for client-side imports
3. Ensures the module is included in the build output
4. Replaces the import expression with a serializable object

**Runtime Execution**:
At runtime, the framework loads and executes logic modules on demand:

```typescript
// When a computed signal needs to execute
const module = await import(logic.src);
const fn = module.default;
const result = fn(...deps);
```

Logic is loaded lazily - only when needed for execution.

**The createLogic() Primitive**:
`createLogic()` creates a logic signal that can be reused across multiple dependents:

```typescript
function createLogic<M>(mod: Promise<M>): LogicSignal & { _type?: M }
```

**Usage:**
```typescript
// Create logic signal once (registered in weaver)
const doubleLogic = createLogic(import("./double"));

// Reuse across multiple computeds
const doubled1 = createComputed(doubleLogic, [count1]);
const doubled2 = createComputed(doubleLogic, [count2]);
const doubled3 = createComputed(doubleLogic, [count3]);

// Or inline (common pattern - createLogic called internally)
const doubled = createComputed(import("./double"), [count]);
```

**Reusability Benefits**:
When you reuse a logic signal:
- Logic is registered once in the weaver
- Dependent signals reference it by ID (string)
- Serialization is more efficient (logic definition sent once, references are just IDs)
- Module is loaded once and cached by the browser

```html
<!-- Logic registered once -->
<script>weaver.push({kind:'signal-definition',signal:{id:'logic1',kind:'logic',src:'/assets/double.js'}})</script>

<!-- Multiple computeds reference by ID -->
<script>weaver.push({kind:'signal-definition',signal:{id:'c1',kind:'computed',logic:'logic1',deps:['s1']}})</script>
<script>weaver.push({kind:'signal-definition',signal:{id:'c2',kind:'computed',logic:'logic1',deps:['s2']}})</script>
<script>weaver.push({kind:'signal-definition',signal:{id:'c3',kind:'computed',logic:'logic1',deps:['s3']}})</script>
```

**Type Inference**:
The `_type` phantom property preserves TypeScript's inference of the module exports:

```typescript
// TypeScript knows the signature
const incrementLogic = createLogic(import("./increment"));
// incrementLogic has type info about the default export

// When used in createAction, deps are validated
const incrementAction = createAction(incrementLogic, [count]);
// TypeScript ensures [count] matches the function signature
```

**Convenience Pattern**:
Most addressable APIs accept either a `LogicSignal` or a `Promise<M>` for flexibility:

```typescript
type LogicInput<M> = LogicSignal | Promise<M>;

// Both of these work:
createComputed(import("./double"), [count]);           // Promise<M>
createComputed(doubleLogic, [count]);                  // LogicSignal
```

If a `Promise<M>` is provided, `createLogic()` is called automatically under the hood.

**Serialization**:
When logic references are serialized (server → client), only the ID and source URL are transmitted:

```json
{
  "id": "double_a1b2c3",
  "src": "/assets/double-a1b2c3.js"
}
```

The `_importPromise` property is never serialized - it exists only for TypeScript type inference at compile time.

**Module Requirements**:
Logic modules must:
- Export a default function (or named export specified by `key`)
- Be pure (no side effects in the module scope)
- Accept all inputs as explicit parameters
- Return serializable values (for computed signals)

**Example Flow**:
```typescript
// 1. Author with type safety
const doubled = createComputed(import("./double"), [count]);

// 2. Build transforms
// → { id: "double_abc", src: "/assets/double-abc.js" }

// 3. Server renders and serializes
// → <script>weaver.push({ signal: { logic: { id: "double_abc", src: "/assets/double-abc.js" } } })</script>

// 4. Client receives and registers
// → Registry stores logic reference

// 5. When count changes, client executes
// → const module = await import("/assets/double-abc.js")
// → const result = module.default(count)
```

This system provides type safety at authoring time, efficient serialization, and lazy execution at runtime.

### 3.3 Signals as Values

Signals are plain JavaScript objects that can be read and written directly.

**Reading**:
```typescript
const count = createSignal(5);
console.log(count.value);  // 5
```

**Writing**:
```typescript
count.value = 10;  // Updates the signal, triggers reactivity
```

**Reactivity**:
When a signal's value is updated, the update flows through the Weaver's stream:

1. **Signal setter** pushes a `signal-update` event to the Weaver stream
2. **Weaver processes** the update event and updates its internal registry
3. **Dependency lookup** finds all dependents (computed signals, components)
4. **ChainExplode**: For each dependent, spawns a new DelegateStream to re-execute
5. **Delegates emit** new computed values or component output back into the stream
6. **Stream flows to Sink** which receives `sync` messages for DOM updates

This stream-based architecture maintains the continuous flow principle - everything is a stream event, including signal mutations. The signal setter mechanism uses ES5 getter/setter to intercept writes:

```typescript
// createSignal implementation concept
function createSignal<T>(initialValue: T): StateSignal<T> {
  const id = allocateId();
  let _value = initialValue;

  return {
    id,
    kind: 'state' as const,
    get value() { return _value; },
    set value(newValue: T) {
      _value = newValue;
      // Push update to Weaver stream (not imperative callback)
      globalWeaver.push({ kind: 'signal-update', id, value: newValue });
    }
  };
}
```

**Serialization**:
Signal definitions must be JSON-serializable for transmission between server and client. Complex objects are only allowed through computed signal values in the registry.

## 4. Composition API

### 4.1 createComputed()

Creates a computed signal that derives its value from other signals through executable logic. Computed signals automatically re-execute when their dependencies change.

**Type Signature**:
```typescript
function createComputed<M, F = DefaultExport<M>>(
  logic: LogicSignal | Promise<M>,
  deps: ArgsOf<F>
): ComputedSignal

type DefaultExport<M> = M extends { default: infer D } ? D : never;
type ArgsOf<F> = F extends (...args: infer A) => any ? A : never;
```

**Parameters**:
- `logic`: Either a `LogicSignal` or a dynamic import promise `import("...")`
  - If `LogicSignal` is provided, its ID is stored as the logic reference
  - If `Promise<M>` is provided, `createLogic()` is called internally to create a LogicSignal, and the ID is stored
  - TypeScript infers the function signature from the module
- `deps`: Array of signal dependencies, validated against function parameters at compile time

**Returns**:
A computed signal definition. The `logic` field contains the LogicSignal ID (string reference). Access computed values via the registry (e.g., `doubled.value` uses a getter).

**Execution Model**:
The logic function receives **ReadOnly signal objects** as positional arguments via spread. The readonly constraint prevents mutation and eliminates circular dependency issues:

```typescript
// logic/double.ts
export default (count: ReadOnly<StateSignal<number>>) => {
  return count.value * 2;  // Can read, cannot mutate
};

// Usage - inline import (common pattern)
const count = createSignal(5);
const doubled = createComputed(import("./double"), [count]);
// TypeScript validates [count] matches function signature
// doubled.value === 10

// Alternative - explicit logic reference
const doubleLogic = createLogic(import("./double"));
const doubled = createComputed(doubleLogic, [count]);
```

**Type Safety**:
TypeScript validates dependencies at the call site:

```typescript
// double.ts expects (count: Signal<number>)
export default (count: ReadOnly<StateSignal<number>>) => count.value * 2;

const count = createSignal(5);
const name = createSignal("Alice");

// ✓ Correct
const doubled = createComputed(import("./double"), [count]);

// ✗ TypeScript error - wrong type
const doubled = createComputed(import("./double"), [name]);

// ✗ TypeScript error - wrong arity
const doubled = createComputed(import("./double"), [count, name]);
```

**Advanced Pattern - Signal Pass-Through**:
Computed functions can return objects containing signal references, enabling composition:

```typescript
// logic/viewModel.ts
export default (
  user: ReadOnly<StateSignal<User>>,
  settings: ReadOnly<StateSignal<Settings>>
) => {
  return {
    user: user,              // Pass signal reference through
    settings: settings,      // Pass another signal through
    displayName: user.value.name.toUpperCase()  // Plus derived values
  };
};

// The returned object contains ReadOnly signals that can be passed to components
const vm = createComputed(import("./viewModel"), [userSignal, settingsSignal]);
```

**Reactivity**:
When any dependency signal updates:
1. Weaver detects the change
2. Re-executes the logic function with new values
3. Updates the registry with the new result
4. Triggers downstream dependents (other computeds, components)

**Lazy Execution**:
On the server, computed logic may execute during initial render. On the client, the logic module is only loaded and executed when:
- A dependency changes
- The computed signal is bound to the DOM

**Isomorphic Behavior**:
The same logic module runs on server and client. The logic function must be pure (no side effects) and receive all inputs as explicit arguments.

### 4.2 createAction()

Creates an action that can execute logic with access to signals for mutation. Unlike computed signals which are reactive, actions are imperative—they execute only when explicitly invoked.

**Type Signature**:
```typescript
function createAction<M, F = DefaultExport<M>>(
  logic: LogicSignal | Promise<M>,
  deps: WritableArgsOf<F>
): ActionSignal

type WritableArgsOf<F> = F extends (...args: infer A) => any ? A : never;
```

**Parameters**:
- `logic`: Either a `LogicSignal` or a dynamic import promise `import("...")`
  - If `LogicSignal` is provided, its ID is stored as the logic reference
  - If `Promise<M>` is provided, `createLogic()` is called internally to create a LogicSignal, and the ID is stored
  - TypeScript infers the function signature from the module
- `deps`: Array of signal dependencies, validated against function parameters at compile time

**Returns**:
An action signal. The `logic` field contains the LogicSignal ID (string reference). Actions can be invoked by user interactions or other imperative code.

**Execution Model**:
Unlike computed signals which receive readonly signals, action functions receive **writable signal objects** (`StateSignal<T>`) and can mutate them:

```typescript
// actions/increment.ts
export default (count: StateSignal<number>) => {
  count.value++;  // Mutates the signal, triggers reactivity
};

// Usage - inline import (common pattern)
const count = createSignal(0);
const increment = createAction(import("./increment"), [count]);
// TypeScript validates [count] matches function signature

// Alternative - explicit logic reference
const incrementLogic = createLogic(import("./increment"));
const increment = createAction(incrementLogic, [count]);
```

Actions are the **only** addressable entities that can mutate signals. This design prevents circular dependencies because:
- Actions are imperative (must be explicitly invoked)
- Computed signals and components cannot mutate (receive ReadOnly signals)
- Therefore, no automatic reactivity loop can form

**Invocation**:
Actions can be invoked programmatically or through the DOM. For DOM events that need access to event data, use `createHandler` instead (see Section 4.2.1).

**Side Effects**:
Actions are the appropriate place for side effects (network requests, localStorage, etc.) since they are explicitly invoked rather than automatically executed.

### 4.2.1 createHandler()

Creates an event handler, which is an action that receives DOM events as its first parameter.

**Type Signature**:
```typescript
function createHandler<M, F = DefaultExport<M>>(
  logic: LogicSignal | Promise<M>,
  deps: WritableArgsOf<F>
): HandlerSignal

// Handler functions receive (event, ...signals)
type HandlerFn = (event: Event, ...signals: StateSignal[]) => void | Promise<void>;
```

**Parameters**:
- `logic`: Either a `LogicSignal` or a dynamic import promise `import("...")`
  - If `LogicSignal` is provided, its ID is stored as the logic reference
  - If `Promise<M>` is provided, `createLogic()` is called internally to create a LogicSignal, and the ID is stored
  - TypeScript infers the function signature from the module
- `deps`: Array of signal dependencies, validated against function parameters at compile time

**Returns**:
A handler signal. The `logic` field contains the LogicSignal ID (string reference). Handlers can be attached to DOM event attributes (onClick, onSubmit, etc.).

**Handler Function Signature**:
Handler functions receive the DOM event as the first parameter, followed by signal dependencies:

```typescript
// actions/handleClick.ts
export default (
  event: MouseEvent,
  count: StateSignal<number>
) => {
  console.log('Clicked at', event.clientX, event.clientY);
  count.value++;
}
```

**Usage**:
```typescript
// Inline import (common pattern)
const count = createSignal(0);
const handleClick = createHandler(import("./handleClick"), [count]);

<button onClick={handleClick}>Click</button>

// Alternative - explicit logic reference
const clickLogic = createLogic(import("./handleClick"));
const handleClick = createHandler(clickLogic, [count]);
```

Handlers extend actions with event-specific behavior. Use `createAction` for pure state mutations, and `createHandler` when you need access to DOM event data.

### 4.3 createComponent()

Creates a component definition - a reusable template that can be instantiated with different props. Component definitions are addressable logic references that can be bound to props multiple times.

**Type Signature**:
```typescript
function createComponent<M>(
  logic: LogicSignal | Promise<M>
): ComponentSignal<M>

interface ComponentSignal<T = any> extends Signal {
  id: string;
  kind: 'component';
  logic: string;        // LogicSignal ID reference
  _type?: T;  // Phantom type for TypeScript inference
}
```

**Parameters**:
- `logic`: Either a `LogicSignal` or a dynamic import promise `import("...")`
  - If `LogicSignal` is provided, its ID is stored as the logic reference
  - If `Promise<M>` is provided, `createLogic()` is called internally to create a LogicSignal, and the ID is stored
  - TypeScript infers the component's prop types from the module export

**Returns**:
A component signal. The `logic` field contains the LogicSignal ID (string reference). This is a template that can be used in JSX.

**Concept**:
`createComponent()` creates an addressable component template without binding it to specific props. It's similar to how `createLogic()` creates an addressable logic reference. The actual instantiation (binding to props) happens via `createNode()` (see Section 4.4).

**Usage Pattern**:
```typescript
// 1. Create component definition (once)
const UserCard = createComponent(import("./UserCard"));

// 2. Use in JSX with different props (many times)
<UserCard name={aliceSignal} age={25} />
<UserCard name={bobSignal} age={30} />
```

**Type Inference**:
TypeScript infers prop types from the component module:

```typescript
// components/UserCard.tsx
interface Props {
  name: ReadOnly<StateSignal<string>>;
  age: number;
}

export default (props: Props) => {
  return (
    <div>
      <h1>{props.name.value}</h1>
      <p>Age: {props.age}</p>
    </div>
  );
};

// Usage - TypeScript validates props
const UserCard = createComponent(import("./UserCard"));

// ✓ Correct
<UserCard name={nameSignal} age={25} />

// ✗ TypeScript error - missing age
<UserCard name={nameSignal} />

// ✗ TypeScript error - wrong type for name
<UserCard name="Alice" age={25} />
```

**Component Functions**:
Component functions receive props containing **ReadOnly signal objects** for reactive props and primitive values for static props:

```typescript
// components/UserCard.tsx
interface Props {
  name: ReadOnly<StateSignal<string>>;
  count: ReadOnly<StateSignal<number>>;
  role: string;  // Static prop
}

export default (props: Props) => {
  // Can read signal values
  const displayName = props.name.value.toUpperCase();

  // Can pass signals to child components
  const increment = createHandler(import("./increment"), [props.count]);

  return (
    <div>
      <h1>{displayName}</h1>
      <p>Role: {props.role}</p>
      <p>Count: {props.count.value}</p>
      <button onClick={increment}>Increment</button>
    </div>
  );
};
```

**Reusability**:
Component definitions are templates that can be reused:

```typescript
const Card = createComponent(import("./Card"));

// Same definition, different instances
const cards = items.map(item =>
  <Card title={item.title} data={item.signal} />
);
```

Each JSX instantiation creates a separate node (via `createNode()`) with its own ID and dependencies.

**Definition vs Node**:
- **Component Definition** (created by `createComponent`):
  - Kind: `'component'`
  - Contains: logic reference only
  - Purpose: Reusable template
  - Created: Once, typically at module level

- **Node** (created by `createNode` via JSX):
  - Kind: `'node'`
  - Contains: logic reference + props + dependencies
  - Purpose: Specific instance bound to props
  - Created: Every time component is used in JSX

See Section 4.4 for details on `createNode()`.

### 4.4 createNode()

Creates a node - a component instance bound to specific props. Nodes are the reactive entities that re-render when their prop signals change.

**Type Signature**:
```typescript
function createNode<Props>(
  component: ComponentSignal,
  props: Props
): NodeSignal

interface NodeSignal extends Signal {
  id: string;
  kind: 'node';
  logic: string;        // LogicSignal ID reference (copied from component.logic)
  props: Record<string, Signal | Primitive>;
}

type Primitive = string | number | boolean | null | undefined;
```

**Parameters**:
- `component`: A component signal created by `createComponent()`
- `props`: Object containing props
  - **Signals**: Passed as references (creates reactive dependencies)
  - **Primitives**: Passed as values (static, no reactivity)
  - **Objects/Arrays**: Must be wrapped in signals

**Returns**:
A node signal representing a specific component instance bound to the provided props. The `logic` field contains the LogicSignal ID reference (copied from the component).

**Content-Addressable IDs**:
Node IDs are deterministic, based on the component logic and props:

```typescript
// Hash includes:
// - Component logic ID
// - Prop keys and signal IDs (or values for primitives)
id = hash(component.logic.id + stringifyProps(props))
```

This creates automatic identity stability:

```typescript
const Card = createComponent(import("./Card"));
const nameSignal = createSignal("Alice");

// Same component + same props = same ID
const node1 = createNode(Card, { name: nameSignal, age: 25 });
const node2 = createNode(Card, { name: nameSignal, age: 25 });
// node1.id === node2.id

// Different props = different ID
const node3 = createNode(Card, { name: nameSignal, age: 30 });
// node3.id !== node1.id
```

**Dependency Tracking**:
When props contain signals, the node becomes dependent on those signals:

```typescript
const nameSignal = createSignal("Alice");
const ageSignal = createSignal(25);

const node = createNode(Card, {
  name: nameSignal,  // Node depends on nameSignal
  age: ageSignal,    // Node depends on ageSignal
  role: "Admin"      // Static prop, no dependency
});

// When nameSignal or ageSignal changes, node re-renders
```

**Props Handling**:

**Primitives (static):**
```typescript
<Card title="Welcome" count={5} enabled={true} />
// Props: { title: "Welcome", count: 5, enabled: true }
// No reactive dependencies
```

**Signals (reactive):**
```typescript
const name = createSignal("Alice");
<Card name={name} />
// Props: { name: <signal reference> }
// Node depends on name signal
```

**Mixed:**
```typescript
const name = createSignal("Alice");
<Card name={name} role="Admin" age={25} />
// Props: { name: <signal>, role: "Admin", age: 25 }
// Node depends only on name signal
```

**Complex Values (must be signals):**
```typescript
// ❌ Wrong - arrays/objects must be wrapped
<DataTable rows={[{id: 1}, {id: 2}]} />

// ✅ Correct - wrap in signal
const rows = createSignal([{id: 1}, {id: 2}]);
<DataTable rows={rows} />
```

**JSX Integration**:
Typically, `createNode()` is not called directly. The JSX factory detects component definitions and calls `createNode()` automatically:

```typescript
// You write:
const Card = createComponent(import("./Card"));
<Card name={nameSignal} age={25} />

// JSX compiles to:
jsx(Card, { name: nameSignal, age: 25 })

// jsx() function detects ComponentSignal and calls:
createNode(Card, { name: nameSignal, age: 25 })
```

**Reactivity**:
Nodes are reactive entities that re-execute when their prop signals change:

1. User updates a signal: `nameSignal.value = "Bob"`
2. Weaver detects the node depends on `nameSignal`
3. Weaver re-executes the component function with new props
4. Component returns new JSX tree
5. Output is serialized to HTML
6. Sync message sent to Sink with node ID
7. Sink replaces all bind point regions for that node

**As Streams**:
Nodes act as DelegateStreams during rendering:
- They spawn as independent streams
- They can emit tokens, bind markers, and registration events
- They chain into parent streams maintaining sequential output
- They enable recursive parallel component spawning

**Lifecycle**:
1. **Creation**: JSX instantiation calls `createNode()`
2. **Registration**: Node registered with Weaver, dependencies tracked
3. **Execution**: Component function runs with props, returns JSX
4. **Stream Spawning**: ComponentDelegate processes returned tree
5. **Output**: Bind markers and HTML streamed to output
6. **Updates**: When prop signals change, node re-executes (steps 3-5 repeat)

**Example**:
```typescript
// Define component once
const UserCard = createComponent(import("./UserCard"));

// Use with different props - each creates a unique node
const alice = createSignal({ name: "Alice", age: 30 });
const bob = createSignal({ name: "Bob", age: 25 });

const App = () => (
  <div>
    <UserCard user={alice} role="Admin" />  {/* Node 1 */}
    <UserCard user={bob} role="User" />     {/* Node 2 */}
  </div>
);

// When alice signal changes, only Node 1 re-renders
// When bob signal changes, only Node 2 re-renders
```

## 5. Component Model

### 5.1 Components as Signals

The component system in Stream Weaver uses two distinct signal types:

**Component Definitions** (`kind: 'component'`):
- Templates created by `createComponent()`
- Contain only a logic reference
- Reusable across multiple instantiations
- Not reactive (no dependencies)

**Nodes** (`kind: 'node'`):
- Instances created by `createNode()` (typically via JSX)
- Contain logic reference + props
- Reactive entities with dependencies
- Re-execute when prop signals change

**Nodes as Reactive Entities**:
Nodes are reactive like computed signals. They have dependencies (prop signals), execute logic when those dependencies change, and produce rendered output to the stream.

**Value Semantics**:
Unlike regular signals (which hold data) or computed signals (which cache results), nodes are execution records. They mark locations where components render and track dependencies, but don't store the rendered output as a "value." The component's output streams as events/tokens during rendering.

On the client, when a node re-renders due to prop changes, the new output is generated and streamed to the Sink as a sync message, but this is not stored as a persistent value on the node signal itself.

**Dependency Tracking**:
When props contain signals, the node becomes dependent on those signals:

```tsx
const Card = createComponent(import("./UserCard"));
const nameSignal = createSignal('Alice');
const countSignal = createSignal(0);

<Card name={nameSignal} count={countSignal} />
// Node n1 depends on signals: [nameSignal.id, countSignal.id]
```

**Reactive Updates**:
When a prop signal updates:
1. Weaver detects `nameSignal` changed
2. Finds dependent node `n1`
3. Re-executes component function with new prop values
4. Generates new rendered output
5. Emits sync message: `{ id: 'n1', html: '...' }`
6. Sink replaces all `<!--^n1-->...<!--/n1-->` regions with new HTML

**Node Instance Identity**:
Each JSX instantiation creates a stable node based on content-addressable hashing:

```tsx
const Card = createComponent(import("./Card"));

<Card name={alice} />  // Creates node n1 (hash of Card logic + alice.id)
<Card name={bob} />    // Creates node n2 (hash of Card logic + bob.id)
```

Both are independent nodes that update independently when their respective props change. If you use the same component definition with the same signal props multiple times, you get the same node ID (automatic deduplication).

### 5.2 Components as Streams

Components are also DelegateStreams, enabling recursive parallel rendering while maintaining sequential output order.

**Stream Spawning**:
When a component executes and returns JSX containing child components:

```tsx
const Parent = () => {
  return (
    <div>
      <ChildA />
      <ChildB />
    </div>
  );
};
```

The rendering process:
1. `Parent` component delegate starts
2. Encounters `<ChildA />` - spawns new ComponentDelegate
3. Chains `ChildA.readable` stream into parent sequence
4. `Parent` continues processing (doesn't block)
5. Encounters `<ChildB />` - spawns another ComponentDelegate
6. Chains `ChildB.readable` stream into parent sequence
7. Both children execute in parallel
8. Output streams sequentially: Parent tokens → ChildA output → ChildB output → Parent close tokens

**Recursive Depth**:
Components can spawn components to arbitrary depth:

```tsx
const App = () => <Layout />
const Layout = () => <Page />
const Page = () => <Section />
const Section = () => <Card />
```

Each level spawns a new DelegateStream, all executing in parallel, with output chained through the async iterable sequencer maintaining document order.

**Async Components**:
Component functions can be async and await external data:

```tsx
const UserCard = async ({ userId }) => {
  const user = await fetchUser(userId);
  return <div>{user.name}</div>;
};
```

The component delegate awaits the promise before chaining its output, but doesn't block other components from executing in parallel.

### 5.3 JSX Integration

Stream Weaver uses standard JSX syntax with custom factory functions to integrate signals and components.

**JSX Factory Configuration**:
```json
// tsconfig.json
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "stream-weaver"
  }
}
```

**Factory Function**:
The `jsx()` function detects and handles different node types:

```typescript
function jsx(type, props): Element {
  // Intrinsic element (HTML tag)
  if (typeof type === 'string') {
    return { type, props, children: [...] };
  }

  // Component definition - create node
  if (type?.kind === 'component') {
    return createNode(type, props);
  }

  // Fragment
  if (type === Fragment) {
    return { type: Fragment, props: undefined, children: [...] };
  }

  throw new Error('Invalid JSX type');
}
```

**Signal Binding Syntax**:
Signals can be embedded directly in JSX:

```tsx
const count = createSignal(5);

// Inline signal binding
<div>Count: {count}</div>

// Attribute binding
<div className={themeSignal}>Content</div>

// Multiple signals
<div>{prefix} {count} {suffix}</div>
```

When the tokenizer encounters a signal object in the JSX tree, it:
1. Emits registration event for the signal
2. Emits bind marker open event with signal ID
3. Emits text token with current signal value
4. Emits bind marker close event

**Component Instantiation**:
JSX component syntax automatically creates nodes from component definitions:

```tsx
// 1. Define component
const UserCard = createComponent(import("./UserCard"));

// 2. Use in JSX
<UserCard name={nameSignal} role="Admin" />

// Compiles to:
jsx(UserCard, { name: nameSignal, role: "Admin" })

// jsx() detects UserCard.kind === 'component' and calls:
createNode(UserCard, { name: nameSignal, role: "Admin" })

// Creates NodeSignal n1 with:
// - logic reference from UserCard
// - props containing signal reference and literal
// - dependencies extracted from props
```

**Nodes as Bindings**:
Since nodes are signals, component instantiation creates a binding in the output:

```tsx
const UserCard = createComponent(import("./UserCard"));
const nameSignal = createSignal("Alice");

<div>
  <UserCard name={nameSignal} />
</div>
```

Server output:
```html
<script>weaver.push({kind:'signal-definition',signal:{id:'logic1',kind:'logic',src:'/assets/UserCard.js'}})</script>
<script>weaver.push({kind:'signal-definition',signal:{id:'s1',kind:'state',init:'Alice'}})</script>
<script>weaver.push({kind:'signal-definition',signal:{id:'comp1',kind:'component',logic:'logic1'}})</script>
<script>weaver.push({kind:'signal-definition',signal:{id:'n1',kind:'node',logic:'logic1',props:{name:'s1'}}})</script>
<div>
  <!--^n1-->
    <div class="user-card">
      <h2>Alice</h2>
    </div>
  <!--/n1-->
</div>
```

When the node's prop signals update, the entire region between `<!--^n1-->` and `<!--/n1-->` is replaced with the component's new output.

**Props Handling**:
Props can contain a mix of literal values and signal references:

```typescript
const Card = createComponent(import("./Card"));

// Literal values are passed directly
<Card title="Hello" />

// Signals are passed as objects (not unwrapped)
<Card count={countSignal} />

// Mixed
<Card title="Hello" count={countSignal} enabled={true} />

// Inside component module (Card.tsx):
interface Props {
  title: string;
  count: ReadOnly<StateSignal<number>>;
  enabled: boolean;
}

export default (props: Props) => {
  // props.title === "Hello" (literal)
  // props.count === Signal object (can be bound or read via .value)
  // props.enabled === true (literal)
  return <div>{props.count}</div>;
};
```

## 6. Stream Architecture

### 6.1 Server Weaver Pipeline

The server weaver executes components and transforms them into a stream of events that flow through multiple stages.

**Pipeline Stages**:
```
Root Component → ComponentDelegate → Events → Serializer → HTML Stream
```

**Stream Event Types**:

The ComponentDelegate emits several types of events during rendering:

```typescript
// Server-side rendering events
type StreamEvent =
  | { kind: 'signal-definition', signal: AnySignal }
  | { kind: 'signal-update', id: string, value: unknown }
  | { kind: 'bind-open', signalId: string }
  | { kind: 'bind-close', signalId: string }
  | { kind: 'token-open', tag: string, attributes: Record<string, string>, bindings?: Record<string, string> }
  | { kind: 'token-text', content: string }
  | { kind: 'token-close', tag: string }
```

The `signal-update` event is emitted by signal setters on the client to trigger reactivity through the Weaver stream. This enables ChainExplode operations where signal updates spawn new DelegateStreams for dependent computations.

**Registration Events**:
When any addressable entity (signal, computed, action, or component) is first encountered in a binding position:
- `signal-definition`: Emits the addressable definition with its complete metadata
- The `kind` discriminator in the definition determines the type (signal, computed, action, component)
- Downstream de-duplication ensures each addressable registers only once per render

**Bind Marker Events**:
When signals appear in binding positions:
- `bind-open`: Marks the start of a reactive region (signal ID)
- `bind-close`: Marks the end of a reactive region

**VDOM Token Events**:
Standard HTML structure:
- `token-open`: Opening tag with attributes and optional bindings for signal-bound attributes/events
- `token-text`: Text content
- `token-close`: Closing tag

**Component Processing**:
When a ComponentDelegate encounters a component element (from JSX):
1. Creates a ComponentSignal with unique ID (e.g., `c1`)
2. Emits `signal-definition` event with the component definition
3. Emits `bind-open` event with component signal ID
4. Creates a new ComponentDelegate for the child
5. Executes component function asynchronously → returns Node
6. Writes Node to child delegate, which processes and emits tokens
7. Chains child's readable stream into parent's sequence
8. When child completes, emits `bind-close` event
9. Parent continues processing without blocking

The component's JSX output is transformed into a stream of tokens.

### 6.2 Event Flow

The DelegateStream architecture enables recursive parallel execution with sequential output.

**Execution Model**:

```tsx
const App = () => (
  <div>
    <Header />
    <AsyncContent />
    <Footer />
  </div>
);
```

**Flow Timeline**:

1. **T0**: App ComponentDelegate starts
   - Emits: `token-open` for `<div>`

2. **T1**: Encounters `<Header />`
   - Creates Header ComponentDelegate
   - Spawns async execution of Header
   - Chains Header.readable into sequence
   - App continues without waiting

3. **T2**: Encounters `<AsyncContent />`
   - Creates AsyncContent ComponentDelegate
   - Spawns async execution (may await data)
   - Chains AsyncContent.readable into sequence
   - App continues

4. **T3**: Encounters `<Footer />`
   - Creates Footer ComponentDelegate
   - Spawns async execution
   - Chains Footer.readable
   - App completes, emits `token-close` for `</div>`

**Parallel Execution**: Header, AsyncContent, and Footer all execute simultaneously.

**Sequential Output**: The async iterable sequencer ensures output order:
- App's opening div token
- Header's complete output (when Header completes)
- AsyncContent's output (when it completes, even if slower)
- Footer's output (when Footer completes)
- App's closing div token

**Ordering Guarantees**:
- Parent tokens before children
- Children output in source order
- Sibling components execute in parallel but stream sequentially
- No component's output can "jump ahead" in the stream

**Recursive Chaining**:
Each child component that spawns its own children creates nested DelegateStreams. The async generator delegation (`yield*`) flattens the output:

```
App Stream → [
  div open,
  Header Stream → [h1, text, /h1],
  Content Stream → [
    section open,
    Card Stream → [div, text, /div],
    /section
  ],
  /div
]
```

All streams execute in parallel, all output flattens sequentially.

### 6.3 Registry Management

The Weaver maintains a registry of all signals and logic encountered during rendering.

**Registry Structure**:
```typescript
interface WeaverRegistry {
  signals: Map<string, StateSignal>;
  logic: Map<string, LogicDefinition>;
  dependencies: Map<string, Set<string>>;
}
```

**Addressable Registration**:
When `signal-definition` event flows through, it contains any addressable definition:

**Plain Signal**:
```typescript
{
  kind: 'signal-definition',
  signal: {
    id: 's1',
    kind: 'state',
    init: 0
  }
}
```

**Logic Signal**:
```typescript
{
  kind: 'signal-definition',
  signal: {
    id: 'logic1',
    kind: 'logic',
    src: '/assets/double-abc.js'
  }
}
```

**Computed Signal**:
```typescript
{
  kind: 'signal-definition',
  signal: {
    id: 'c1',
    kind: 'computed',
    logic: 'logic1',    // LogicSignal ID reference
    deps: ['s1']
  }
}
```

**Action**:
```typescript
{
  kind: 'signal-definition',
  signal: {
    id: 'a1',
    kind: 'action',
    logic: 'logic2',    // LogicSignal ID reference
    deps: ['s1']
  }
}
```

**Component Signal**:
```typescript
{
  kind: 'signal-definition',
  signal: {
    id: 'comp1',
    kind: 'component',
    logic: 'logic3'     // LogicSignal ID reference
  }
}
```

**Node (Component Instance)**:
```typescript
{
  kind: 'signal-definition',
  signal: {
    id: 'n1',
    kind: 'node',
    logic: 'logic3',    // LogicSignal ID reference (same as component)
    props: { name: 's1', role: 'Admin', count: 's2' }
  }
}
```

Weaver adds all addressables to registry (idempotent - duplicate registrations are no-ops).

**Dependency Tracking**:
For addressables with `deps` (computed, action, component), the registry builds a dependency graph:
- If computed `c2` has `deps: ['s1']` → add to `dependencies['s1']` → `'c2'`
- When `s1` updates → lookup `dependencies['s1']` → trigger re-execution of `c2`

The dependency graph enables reactive propagation: changing a signal triggers all dependents recursively.

**De-duplication**:
Multiple registration events for the same ID are handled gracefully (Map.set is idempotent). Whether de-duplication happens during event emission or during registry insertion is an implementation detail - both approaches work correctly.

## 7. Serialization

### 7.1 Server HTML Output

The serializer transforms stream events into HTML that can be sent to the browser.

**Event to HTML Mapping**:

**Registration Events**:
All addressables serialize to `signal-definition` with the complete definition:

```typescript
{ kind: 'signal-definition', signal: { id: 's1', kind: 'state', init: 0 } }
↓
<script>weaver.push({kind:'signal-definition',signal:{id:'s1',kind:'state',init:0}})</script>
```

```typescript
{ kind: 'signal-definition', signal: { id: 'c1', kind: 'component', logic: {...}, props: {...} } }
↓
<script>weaver.push({kind:'signal-definition',signal:{id:'c1',kind:'component',logic:{src:'/assets/Card.js'},props:{count:'s1'}}})</script>
```

**Bind Marker Events**:
```typescript
{ kind: 'bind-open', signalId: 's1' }
↓
<!--^s1-->

{ kind: 'bind-close', signalId: 's1' }
↓
<!--/s1-->
```

**Token Events**:
```typescript
{ kind: 'token-open', tag: 'div', attributes: { class: 'card' } }
↓
<div class="card">

{ kind: 'token-text', content: 'Hello' }
↓
Hello

{ kind: 'token-close', tag: 'div' }
↓
</div>

{ kind: 'token-open', tag: 'button', attributes: { }, bindings: { onclick: 'a1' } }
↓
<button data-w-onclick="a1">
```

**Complete Example**:

Given this component:
```tsx
const count = createSignal(5);
const doubled = createComputed(import("./double"), [count]);

const App = () => (
  <div>
    <p>Count: {count}</p>
    <p>Doubled: {doubled}</p>
  </div>
);
```

Server output:
```html
<script>weaver.push({kind:'signal-definition',signal:{id:'logic1',kind:'logic',src:'/assets/double-abc.js'}})</script>
<script>weaver.push({kind:'signal-definition',signal:{id:'s1',kind:'state',init:5}})</script>
<script>weaver.push({kind:'signal-definition',signal:{id:'c1',kind:'computed',logic:'logic1',deps:['s1']}})</script>
<div>
  <p>Count: <!--^s1-->5<!--/s1--></p>
  <p>Doubled: <!--^c1-->10<!--/c1--></p>
</div>
```

**Stream Ordering**:
- Registration scripts appear before their first use
- Bind markers wrap the signal's serialized value
- HTML structure maintains document order
- Inline scripts execute synchronously as browser parses

**Script Execution Model**:
Inline scripts (without `async` or `defer`) execute immediately during HTML parsing. This ensures the client Weaver registry is populated before bind markers are encountered.

### 7.2 Wire Protocol

The wire protocol defines the structure of messages sent from server to client (and later, for client updates). All addressable entities use a unified registration format.

**Registration Message Format**:

All addressable entities use a single registration message type:

```typescript
interface RegisterSignalMessage {
  kind: 'signal-definition';
  signal: AnySignal;
}

type AnySignal =
  | StateSignal
  | ComputedSignal
  | ActionSignal
  | HandlerSignal
  | ComponentSignal;
```

The `signal.kind` discriminator determines which type of addressable is being registered:
- `'state'` - plain reactive state
- `'computed'` - derived reactive value with logic
- `'action'` - imperative logic with signal dependencies
- `'component'` - UI component with props

**Bind Marker Format**:
Markers are HTML comments with a specific format:
- Opening: `<!--^{signalId}-->`
- Closing: `<!--/{signalId}-->`

The `^` prefix distinguishes opening markers, `/` prefix for closing. Signal ID can be any valid string without `-->` sequence.

**Sync Message Format** (Client Updates):
When addressables update on the client, sync messages flow from Weaver to Sink:

```typescript
interface SyncMessage {
  kind: 'sync';
  id: string;        // Addressable ID
  html: string;      // New serialized HTML content
}
```

Example:
```typescript
{
  kind: 'sync',
  id: 's1',
  html: '6'
}
```

The Sink replaces all bind markers for `s1` with the new HTML.

**Value Serialization**:
All addressable values must be JSON-serializable:
- Primitives: string, number, boolean, null
- Objects and arrays (plain data)
- Not allowed: functions, symbols, circular references, DOM nodes

For components, the serialized output is the HTML string of the rendered result.

### 7.3 Client Deserialization

The client reconstructs the Weaver state from the inline scripts in the HTML stream.

**Inline Script Execution**:
As the browser parses HTML, it encounters and executes inline scripts:

```html
<script>weaver.push({kind:'signal-definition',signal:{id:'s1',init:0,kind:'state'}})</script>
```

This immediately calls `window.weaver.push()` with the registration message.

**Registry Rebuilding**:
The client Weaver's `push()` method handles registration messages:

**For `signal-definition` messages**:
- Extract the addressable definition from `message.signal`
- Check the `kind` discriminator to determine the type
- Store in registry's addressables map by ID
- If the definition has `deps` (computed, action, component):
  - For each dependency ID:
    - Add this addressable's ID to that dependency's dependents set
    - This builds the reactivity graph for change propagation
- The addressable is now available for execution and dependency resolution

**Initialization Order**:
1. Browser receives HTML stream
2. Parses opening tags, executes inline scripts
3. Registry populates as scripts execute
4. Bind markers appear in DOM
5. After page load, Sink scans for bind markers
6. Sink maps signal IDs to DOM ranges
7. Client Weaver is ready to handle interactions

**State Synchronization**:
By the time the HTML finishes loading, the client Weaver registry is a complete replica of the server's registry state at render time. The client can now handle interactions without any additional data fetching.

## 8. Client Runtime

### 8.1 Client Weaver Initialization

The client Weaver initializes after the HTML document finishes loading.

**Initialization Steps**:

1. **Global Weaver Object**:
```typescript
window.weaver = new ClientWeaver();
```

The global `weaver` object is created early (in a `<script>` in the `<head>`) so inline `weaver.push()` calls can execute as the HTML streams in.

2. **Registry Restoration**:
The registry builds up incrementally as inline scripts execute:
```html
<script>weaver.push({kind:'signal-definition',signal:{...}})</script>
<!-- Registry now contains s1 -->
```

By page load, the registry is fully populated.

3. **Event Delegation Setup**:
After DOM content loads:
- Attach global event listeners for common events (click, submit, input, etc.)
- Events bubble up and are handled by the delegation system
- The Weaver's event handler checks for action attributes and executes accordingly

4. **Sink Initialization**:
- The Sink scans the entire document for bind markers
- Builds the signal ID → DOM Range[] mapping
- Client is now ready to receive sync messages and perform updates (see 8.4)

### 8.2 Reactivity

The client Weaver tracks signal dependencies and triggers re-execution when signals update.

**Signal Update Flow**:

1. **Signal Mutation**:
```typescript
countSignal.value = 6;  // Direct property assignment
```

2. **Change Detection**:
When a signal's `.value` property is assigned, the framework detects the change and notifies the Weaver with the signal ID and new value.

3. **Dependency Resolution**:
The Weaver looks up all dependents of the changed signal in its dependency graph. For each dependent (computed signal, component, or other computed value), the Weaver schedules re-execution.

4. **Dependent Re-execution**:

**For Computed Signals**:
- Load the logic module from the registered `src` URL
- Gather current values of all dependency signals
- Execute the logic function with dependency values as spread arguments
- Update the registry with the new result
- Emit sync message to Sink with computed signal ID and serialized value
- Any dependents of this computed signal are then triggered

**For Component Signals**:
- Load the component logic module
- Resolve props (signal references become current signal values)
- Execute component function with resolved props
- Component returns JSX Node
- Process Node through tokenization and serialization to HTML
- Emit sync message to Sink with component ID and HTML
- Sink replaces all bind point regions for that component

**Note**: Components generate fresh output on each execution rather than storing a cached value. The output is immediately serialized and sent to the Sink for DOM replacement.

**Cascade Updates**:
If a computed signal updates and has its own dependents, the updates cascade recursively.

### 8.3 Sync Messages

Sync messages flow from the Weaver to the Sink, instructing DOM updates.

**Message Structure**:
```typescript
interface SyncMessage {
  kind: 'sync';
  id: string;        // Signal ID (e.g., 's1', 'c1')
  html: string;      // New HTML content
}
```

**Emission**:
When a signal value changes:
```typescript
weaver.sink.sync('s1', '6');
```

When a component re-renders:
```typescript
weaver.sink.sync('c1', '<div class="card">...</div>');
```

**Sink Processing**:
The Sink receives the sync message and:
1. Looks up all DOM ranges for the signal ID
2. Replaces each range's content with the new HTML
3. Rescans new HTML for nested bind markers

**Batching** (implementation detail):
Multiple sync messages in a single tick could be batched for performance, but the architecture doesn't require it.

### 8.4 The Sink

The Sink is a simple, ~1KB reducer that maps signal IDs to DOM ranges and performs wholesale HTML replacements.

**Data Structure**:
```typescript
class Sink {
  bindPoints: Map<string, Range[]>;

  // Map signal ID → array of DOM Ranges
  // Example: 's1' → [Range(div text), Range(span text)]
}
```

**Initial Scanning**:
After page load, the Sink scans the document for bind markers:
- Walks the DOM tree looking for comment nodes
- Opening markers (`<!--^signalId-->`) mark the start of a reactive region
- Closing markers (`<!--/signalId-->`) mark the end
- Creates DOM Ranges between matching pairs
- Stores in mapping: `signalId → Range[]`

A stack-based approach handles nesting correctly, matching closing markers to their corresponding opening markers.

**Sync (Update) Operation**:
When the Sink receives a sync message with a signal ID and HTML string:
- Looks up all DOM Ranges mapped to that signal ID
- For each range:
  - Parses the HTML string into a DocumentFragment
  - Deletes the current range contents
  - Inserts the new fragment
  - Rescans the newly inserted content for nested bind markers
- Updates the `bindPoints` mapping with any newly discovered markers

**No Diffing**:
The Sink performs wholesale replacement - no virtual DOM, no node-by-node diffing. This simplicity makes the Sink extremely small and predictable.

**Nested Bind Markers**:
When new HTML is inserted, it may contain nested bind markers:
```html
<!--^c1-->
  <div>
    Count: <!--^s1-->5<!--/s1-->
  </div>
<!--/c1-->
```

After replacing `c1`, the Sink rescans and discovers the `s1` markers, adding them to the `bindPoints` map.

### 8.5 Event Handling

User interactions trigger handlers that can mutate signals.

**Event Delegation**:
Global event listeners are attached to the document for common events (click, submit, input). When an event fires:
- Check if the event target or any ancestor has a `data-w-{eventname}` attribute (e.g., `data-w-onclick`)
- If found, extract the handler ID
- Pass the handler ID and event to the Weaver for execution

**Handler Execution**:
When the Weaver executes a handler:
- Looks up the handler definition in the registry's addressables map by ID
- Loads the handler logic module from the `logic.src` URL
- Retrieves the signal objects (not values) for all dependencies from the addressables map
- Executes the handler function with event first, then signal objects as spread arguments
- The handler function mutates signal `.value` properties directly
- Signal mutations trigger reactivity automatically through the signal change detection mechanism

**Example Flow**:

Server renders:
```tsx
const count = createSignal(0);
const increment = createHandler(incrementSrc, [count]);

<button onClick={increment}>+1</button>
```

HTML output:
```html
<script>weaver.push({kind:'signal-definition',signal:{id:'s1',kind:'state',init:0}})</script>
<script>weaver.push({kind:'signal-definition',signal:{id:'a1',kind:'handler',logic:{src:'/assets/increment.js'},deps:['s1']}})</script>
<button data-w-onclick="a1">+1</button>
```

Handler module (`increment.js`):
```typescript
export default (event: MouseEvent, count: StateSignal<number>) => {
  count.value++;  // Triggers reactivity
};
```

User clicks:
1. Global click listener catches event
2. Finds `data-w-onclick="a1"`
3. Loads handler logic from registry
4. Imports `/assets/increment.js`
5. Executes with `event` and `countSignal` object
6. `count.value++` triggers setter
7. Weaver detects update, triggers dependents
8. Sync messages emitted
9. Sink updates DOM

## 9. Build Integration

### 9.1 Addressable Logic System

Stream Weaver uses a build-time transformation system to convert standard TypeScript dynamic imports into addressable logic references. This provides type safety at authoring time, efficient serialization, and lazy execution at runtime.

**Core Concept**:
Developers write standard TypeScript code using `import("...")` expressions. A bundler plugin recognizes these patterns, assigns stable IDs, and transforms them into serializable references.

**Developer Experience**:
```typescript
// What you write (standard TypeScript)
const doubled = createComputed(import("./double"), [count]);

// TypeScript infers types from the import
// Build plugin transforms to:
const doubled = createComputed(
  { id: "double_abc123", src: "/assets/double-abc123.js" },
  [count]
);

// At runtime, only the ID and src are present
// The import promise is not serialized
```

**Type Safety**:
The `import("...")` expression provides full TypeScript inference:

```typescript
// double.ts
export default (count: Signal<number>) => count.value * 2;

// Usage
const count = createSignal(5);
const doubled = createComputed(import("./double"), [count]);

// ✓ TypeScript validates [count] matches function signature
// ✗ TypeScript errors if deps don't match
```

**Build-Time Transformation**:
The bundler plugin recognizes addressable logic patterns and performs transformations:

**Recognized Patterns**:
- `createComputed(import("..."), deps)`
- `createAction(import("..."), deps)`
- `createHandler(import("..."), deps)`
- `createComponent(import("..."))`
- `createLogic(import("..."))`

**Transformation Strategy**:
1. **Primary (Inline Rewrite)**: Replace import expression with LogicSignal object
   ```typescript
   // Before
   createComputed(import("./double"), [count])

   // After
   createComputed({ id: "double_abc", src: "/assets/double-abc.js" }, [count])
   ```

2. **Fallback (Metadata Attachment)**: For code that stores imports in variables
   ```typescript
   // Before
   const doubleFn = import("./double");
   const doubled = createComputed(doubleFn, [count]);

   // After
   const doubleFn = Object.assign(import("./double"), { __logicId: "double_abc" });
   const doubled = createComputed(doubleFn, [count]);
   ```

   The serializer checks for `__logicId` and extracts it if present.

### 9.2 Build Plugin Responsibilities

A bundler plugin (typically for Vite, Webpack, or Rollup) must implement the following:

**1. Pattern Recognition**:
Identify `import("...")` expressions in addressable logic positions:
- Look for string literal specifiers (e.g., `"./double"`)
- Track call sites of createComputed, createAction, createHandler, createComponent, createLogic
- Use AST traversal to find these patterns

**2. ID Assignment**:
Generate stable, deterministic identifiers for each module:
```typescript
// Options:
// - Hash the resolved module path
// - Use normalized relative path
// - Combine module path with export name

id = hash(resolvedPath) // e.g., "double_a1b2c3"
```

The ID must be:
- Stable across builds (same input → same ID)
- Unique per module
- Serializable (string, no special characters)

**3. Call Site Rewriting**:
Transform recognized patterns by replacing import expressions:
```typescript
// AST transformation
CallExpression {
  callee: Identifier("createComputed"),
  arguments: [
    ImportExpression("./double"),  // ← Replace this
    ArrayExpression([...])
  ]
}

// Becomes
CallExpression {
  callee: Identifier("createComputed"),
  arguments: [
    ObjectExpression({
      id: "double_abc",
      src: "/assets/double-abc.js"
    }),
    ArrayExpression([...])
  ]
}
```

**4. Module Emission**:
Ensure referenced modules are included in the build:
- Add modules to the bundle graph as dynamic imports
- Generate separate chunks for code splitting
- Apply normal tree-shaking and optimization

**5. Manifest Generation**:
Create a mapping of logic IDs to public URLs:
```json
{
  "double_abc": {
    "id": "double_abc",
    "src": "/assets/double-abc123.js",
    "imports": []
  },
  "increment_def": {
    "id": "increment_def",
    "src": "/assets/increment-def456.js",
    "imports": ["double_abc"]
  }
}
```

The manifest enables:
- Server-side URL resolution during SSR
- Client-side module loading
- Preloading and optimization

### 9.3 Module Mapping

The build system generates a mapping between source file paths and public bundle URLs.

**Build Process**:

1. **Development Mode**:
   - Plugin detects `import("...")` patterns during transform
   - Generates stable IDs from source paths
   - Keeps source paths for development URLs
   - No bundling, instant module loading

2. **Production Build**:
   - Plugin runs during bundle phase
   - Generates hashed output filenames
   - Creates manifest mapping IDs → public URLs
   - Optimizes and code-splits as normal

**Manifest Structure**:
```json
{
  "double_abc": {
    "id": "double_abc",
    "src": "/assets/double-abc123.js",
    "original": "src/logic/double.ts"
  },
  "UserCard_xyz": {
    "id": "UserCard_xyz",
    "src": "/assets/UserCard-xyz789.js",
    "original": "src/components/UserCard.tsx",
    "imports": ["jsx-runtime"]
  }
}
```

**Server-Side URL Resolution**:
During SSR, the server uses the manifest to resolve public URLs:

```typescript
// Server has module path from build-time transform
const logic = { id: "double_abc", src: "/src/logic/double.ts" };

// Look up in manifest
const manifestEntry = manifest["double_abc"];
const publicUrl = manifestEntry.src; // "/assets/double-abc123.js"

// Serialize with public URL
<script>weaver.push({
  kind: 'signal-definition',
  signal: {
    id: 'c1',
    kind: 'computed',
    logic: { id: 'double_abc', src: '/assets/double-abc123.js' },
    deps: ['s1']
  }
})</script>
```

**Client-Side Import**:
When the client needs to execute logic:
```typescript
const signal = registry.getSignal('c1');
const logic = signal.logic;  // { id: 'double_abc', src: '/assets/double-abc123.js' }

// Dynamic import using public URL
const module = await import(logic.src);
const fn = module.default;
const result = fn(...deps);
```

**Code Splitting Benefits**:
Each logic module is a separate bundle, enabling:
- **Lazy loading**: Only fetch modules when needed for execution
- **Parallel downloads**: Multiple modules can load simultaneously
- **Optimal caching**: Hash-based URLs cache forever
- **Fine-grained updates**: Only changed modules invalidate cache

**Complete Flow Example**:
```typescript
// 1. Authoring (developer writes)
const doubled = createComputed(import("./double"), [count]);

// 2. Build transforms (plugin creates logic signal)
const doubleLogic = createLogic({ id: "logic1", src: "/assets/double-abc.js" });
const doubled = createComputed(doubleLogic, [count]);
// Or more efficiently: const doubled = createComputed("logic1", [count]);

// 3. Server renders (SSR) - logic registered once
<script>weaver.push({
  kind: 'signal-definition',
  signal: {
    id: 'logic1',
    kind: 'logic',
    src: '/assets/double-abc123.js'
  }
})</script>
<script>weaver.push({
  kind: 'signal-definition',
  signal: {
    id: 'c1',
    kind: 'computed',
    logic: 'logic1',    // References logic signal by ID
    deps: ['s1']
  }
})</script>

// 4. Client receives and registers both signals
window.weaver.push(...); // Stores logic signal in registry
window.weaver.push(...); // Stores computed signal in registry

// 5. Client executes when needed
const logicSignal = registry.get('logic1');
const module = await import(logicSignal.src);  // Load from logic signal
const result = module.default(count);
```

**No Manual Configuration**:
Developers don't manage the mapping manually. The build system:
- Detects `import("...")` patterns automatically
- Assigns stable IDs
- Bundles referenced modules
- Generates manifest automatically
- Server loads manifest at startup

This provides a seamless developer experience with standard TypeScript syntax while enabling efficient, type-safe addressable logic.

## 10. Patterns & Examples

### 10.1 Global State

Stream Weaver's addressable signals eliminate the need for context providers or prop drilling.

**Pattern: Module-Level Signals**

Define signals in a shared module:
```typescript
// state/auth.ts
export const isLoggedIn = createSignal(false);
export const currentUser = createSignal(null);
export const theme = createSignal('dark');
```

Use them anywhere in your component tree:
```tsx
// components/Header.tsx
import { isLoggedIn, theme } from '../state/auth';

export default () => (
  <header className={theme}>
    {isLoggedIn ? <UserMenu /> : <LoginButton />}
  </header>
);
```

```tsx
// components/Footer.tsx
import { theme } from '../state/auth';

export default () => (
  <footer className={theme}>
    © 2025
  </footer>
);
```

**No Provider Wrapping**:
Unlike React context, there's no need to wrap components:
```tsx
// NOT needed in Stream Weaver:
<ThemeProvider value={theme}>
  <App />
</ThemeProvider>
```

**Surgical Updates**:
When `theme` changes, only the bound locations update:
- `<header>` className
- `<footer>` className

No components re-execute, no tree traversal, just direct DOM updates.

### 10.2 Computed Values

Computed signals derive state from other signals through pure logic.

**Pattern: Derived State**

```typescript
// state/cart.ts
export const items = createSignal([]);
export const taxRate = createSignal(0.08);

// Computed total price
export const subtotal = createComputed(import("../logic/subtotal"), [items]);
export const tax = createComputed(import("../logic/tax"), [subtotal, taxRate]);
export const total = createComputed(import("../logic/total"), [subtotal, tax]);
```

**Logic Modules**:
```typescript
// logic/subtotal.ts
export default (items: ReadOnly<StateSignal<CartItem[]>>) => {
  return items.value.reduce((sum, item) => sum + item.price * item.qty, 0);
};

// logic/tax.ts
export default (
  subtotal: ReadOnly<StateSignal<number>>,
  rate: ReadOnly<StateSignal<number>>
) => {
  return subtotal.value * rate.value;
};

// logic/total.ts
export default (
  subtotal: ReadOnly<StateSignal<number>>,
  tax: ReadOnly<StateSignal<number>>
) => {
  return subtotal.value + tax.value;
};
```

**Usage in Components**:
```tsx
import { items, subtotal, tax, total } from '../state/cart';

const CartSummary = () => (
  <div>
    <p>Items: {items.value.length}</p>
    <p>Subtotal: ${subtotal}</p>
    <p>Tax: ${tax}</p>
    <p>Total: ${total}</p>
  </div>
);
```

**Automatic Cascade**:
When `items` changes:
1. `subtotal` re-computes
2. `tax` re-computes (depends on subtotal)
3. `total` re-computes (depends on subtotal and tax)
4. All bind points update

**Multi-Signal Dependencies**:
Computed signals can depend on any number of signals:
```typescript
const displayPrice = createComputed(
  import("./formatPrice"),
  [price, currency, locale, showDecimals]
);
```

### 10.3 Component Composition

Components can dynamically resolve to other components, enabling powerful composition patterns.

**Pattern: View Resolver**

A higher-order component that returns different components based on signals:

```typescript
// components/ViewResolver.tsx
const LoginView = createComponent(import("./LoginView"));
const DashboardView = createComponent(import("./DashboardView"));

export default (props: { isLoggedIn: ReadOnly<StateSignal<boolean>> }) => {
  return props.isLoggedIn.value
    ? <DashboardView />
    : <LoginView />;
};
```

**Usage**:
```tsx
// App.tsx
import { isLoggedIn } from '../state/auth';

const ViewResolver = createComponent(import("./components/ViewResolver"));

const App = () => (
  <div>
    <Header />
    <ViewResolver isLoggedIn={isLoggedIn} />
    <Footer />
  </div>
);
```

**Component Swapping**:
When `isLoggedIn` changes from `false` to `true`:
1. Weaver detects `ViewResolver` component depends on `isLoggedIn`
2. Re-executes `ViewResolver` with new value
3. Returns `<DashboardView />` instead of `<LoginView />`
4. Emits sync message for `ViewResolver`'s bind point
5. Sink replaces entire component region with new HTML

**Lazy Loading**:
```typescript
// Only DashboardView module is loaded when user logs in
// LoginView code never downloaded if user starts logged in
```

**Parallel Rendering**:
Multiple dynamic components render in parallel:
```tsx
const Layout = () => (
  <div>
    <AsyncHeader />      {/* Fetches user data */}
    <AsyncSidebar />     {/* Fetches navigation */}
    <AsyncContent />     {/* Fetches page data */}
    <AsyncFooter />      {/* Fetches footer links */}
  </div>
);
```

All four components execute in parallel. Output streams sequentially in document order.

### 10.4 Event Handling

Actions mutate signals in response to user interactions.

**Pattern: Button Click**

```typescript
// actions/increment.ts
export default (count: StateSignal<number>) => {
  count.value++;  // ✅ Actions receive writable signals
};
```

```tsx
// Component
import { count } from '../state/counter';

const Counter = () => {
  const increment = createHandler(import("../actions/increment"), [count]);

  return (
    <div>
      <p>Count: {count}</p>
      <button onClick={increment}>+1</button>
    </div>
  );
};
```

**Server Output**:
```html
<script>weaver.push({kind:'signal-definition',signal:{id:'s1',init:0}})</script>
<div>
  <p>Count: <!--^s1-->0<!--/s1--></p>
  <button data-w-onclick="a1">+1</button>
</div>
```

**Client Interaction**:
1. User clicks button
2. Event delegation catches click
3. Finds `data-w-action="a1"`
4. Loads and executes handler action
5. `count.value++` triggers reactivity
6. Sync message updates bind point
7. DOM shows new count

**Pattern: Form Submission**

```typescript
// actions/submitForm.ts
export default async (
  name: StateSignal<string>,
  email: StateSignal<string>,
  status: StateSignal<string>
) => {
  status.value = 'submitting';

  try {
    await fetch('/api/submit', {
      method: 'POST',
      body: JSON.stringify({
        name: name.value,
        email: email.value
      })
    });
    status.value = 'success';
  } catch (error) {
    status.value = 'error';
  }
};
```

```tsx
const ContactForm = () => {
  const name = createSignal('');
  const email = createSignal('');
  const status = createSignal('idle');

  const handleNameInput = createHandler(import("../actions/updateInput"), [name]);
  const handleEmailInput = createHandler(import("../actions/updateInput"), [email]);
  const handleSubmit = createHandler(import("../actions/submitForm"), [name, email, status]);

  return (
    <form onSubmit={handleSubmit}>
      <input value={name} onInput={handleNameInput} />
      <input value={email} onInput={handleEmailInput} />
      <button type="submit">Submit</button>
      <p>Status: {status}</p>
    </form>
  );
};

// actions/updateInput.ts
export default (event: InputEvent, signal: StateSignal<string>) => {
  signal.value = (event.target as HTMLInputElement).value;
};
```

**Pattern: Component Swapping via Action**

Actions can trigger component changes by updating resolver signals:

```typescript
// actions/login.ts
export default async (
  isLoggedIn: StateSignal<boolean>,
  user: StateSignal<User | null>
) => {
  const result = await fetch('/api/login', { ... });
  const userData = await result.json();

  user.value = userData;
  isLoggedIn.value = true;

  // ViewResolver component automatically swaps
  // from LoginView to DashboardView
};
```

This pattern enables:
- Authentication flows
- Multi-step wizards
- Tab/modal switching
- Route-like navigation

All with surgical DOM updates and zero hydration cost.

## 11. Future Work

The following areas are intentionally deferred for later iterations:

- **Bind Point Cleanup**: Memory optimization for removing bind points when DOM nodes are removed (MutationObserver-based GC)
- **Error Handling**: Standardized error boundaries and recovery strategies for action/computed failures
- **Update Batching**: Coalescing multiple signal updates within a single event loop tick
- **Race Condition Handling**: Cancellation and priority strategies for concurrent async actions
- **Worker Pool Parallelism**: Distributed ComponentDelegates to pre-warmed worker pool
- **UIntArray Optimization**: Optimized stream serialization representation
- **SharedArrayBuffer**: Worker pool memory optimization
- **Server Only Logic**: Provide a way to flag logic that must be run on the server and send signals to the server for remote execution instead
