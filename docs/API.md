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

interface ComputedSignal extends Signal {
  logic: Logic;
  deps: string[];
  kind: 'computed';
}

interface ActionSignal extends Signal {
  logic: Logic;
  deps: string[];
  kind: 'action';
}

interface HandlerSignal extends ActionSignal {
  kind: 'handler';
}

interface ComponentSignal extends Signal {
  logic: Logic;
  props: Record<string, Signal | string | number | boolean | null>;
  kind: 'component';
}

// ReadOnly wrapper for signal mutation control
type ReadOnly<T> = { readonly [K in keyof T]: T[K] };
```

**Signal Mutation Model**:
Stream Weaver prevents circular dependencies through a **Sources vs Dependents** architecture:

- **Sources** (can mutate signals):
  - `createSignal()` - Creates writable signals
  - `createAction()` - Receives `StateSignal<T>` objects with writable `.value`

- **Dependents** (read-only access):
  - `createComputed()` - Receives `ReadOnly<StateSignal<T>>` objects, cannot mutate
  - `createComponent()` - Receives `ReadOnly<StateSignal<T>>` in props, cannot mutate

This design prevents loops by ensuring computed signals and components can never mutate the signals they depend on. Only actions (which are explicitly invoked, not automatically triggered) can cause mutations. The readonly constraint is enforced at compile-time via TypeScript - at runtime, signal objects are identical, but TypeScript prevents writes in computed/component contexts.

**Addressable Entities**:
All reactive entities (signals, computed values, actions, components) are addressable definitions that get registered with the Weaver. The complete set of addressable types forms a union:

```typescript
type AnySignal =
  | StateSignal
  | ComputedSignal
  | ActionSignal
  | HandlerSignal
  | ComponentSignal;
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

Logic represents addressable references to executable code. Rather than serializing closures or function implementations, Stream Weaver serializes references to modules that can be dynamically loaded and executed in any context.

**Key Properties**:
- **Addressable**: Logic is a pointer to code, not the code itself
- **Isomorphic**: The same module reference resolves to executable code on server and client
- **Lazy**: Code is loaded only when needed via dynamic imports
- **Source Phase Imports**: Leverages ECMAScript Source Phase Imports (Stage 3) for module addressing

**Type Definition**:
```typescript
interface LogicDefinition {
  src: string;          // Module URL (e.g., '/assets/increment-abc123.js')
  key?: string;         // Export name (defaults to 'default')
}
```

**Module Resolution**:
- **Server**: Logic references use source file paths during rendering
- **Build**: Module bundler generates public URLs for client access
- **Client**: Logic references contain public URLs that can be dynamically imported

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

### 3.2 Signals as Values

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
function createComputed(
  logic: Logic,
  deps: Signal[]
): ComputedSignal
```

**Parameters**:
- `logic`: Reference to a module containing the computation function
- `deps`: Array of signal dependencies passed as arguments to the function

**Returns**:
A computed signal definition. Access its value via the registry (e.g., `doubled.value` uses a getter).

**Execution Model**:
The logic function receives **ReadOnly signal objects** as positional arguments via spread. The readonly constraint prevents mutation and eliminates circular dependency issues:

```typescript
// logic/double.ts
export default (count: ReadOnly<StateSignal<number>>) => {
  return count.value * 2;  // Can read, cannot mutate
};

// Usage
const count = createSignal(5);
const doubled = createComputed(doubleSrc, [count]);
// doubled.value === 10
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
const vm = createComputed(viewModelSrc, [userSignal, settingsSignal]);
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
function createAction(
  logic: Logic,
  deps: Signal[]
): ActionSignal
```

**Parameters**:
- `logic`: Reference to a module containing the action function
- `deps`: Array of signal dependencies passed as arguments to the function

**Returns**:
An action object that can be invoked by user interactions or other imperative code.

**Execution Model**:
Unlike computed signals which receive readonly signals, action functions receive **writable signal objects** (`StateSignal<T>`) and can mutate them:

```typescript
// actions/increment.ts
export default (count: StateSignal<number>) => {
  count.value++;  // Mutates the signal, triggers reactivity
};

// Usage
const count = createSignal(0);
const increment = createAction(incrementSrc, [count]);
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
function createHandler(
  logic: Logic,
  deps: Signal[]
): HandlerSignal
```

**Parameters**:
- `logic`: Reference to a module containing the handler function
- `deps`: Array of signal dependencies passed as arguments to the function

**Returns**:
A handler signal that can be attached to DOM event attributes (onClick, onSubmit, etc.).

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
const count = createSignal(0);
const handleClick = createHandler(clickSrc, [count]);

<button onClick={handleClick}>Click</button>
```

Handlers extend actions with event-specific behavior. Use `createAction` for pure state mutations, and `createHandler` when you need access to DOM event data.

### 4.3 createComponent()

Creates a component, which is a special kind of computed signal that also acts as a DelegateStream. Components combine reactive logic with stream-based rendering.

**Type Signature**:
```typescript
function createComponent<Props>(
  logic: Logic,
  props: Props
): ComponentSignal
```

**Parameters**:
- `logic`: Reference to a module containing the component function
- `props`: Object containing props. Props can be:
  - **Primitives** (string, number, boolean, null) - passed directly as values
  - **Everything else** (objects, arrays, etc.) - must be passed as signals

**Returns**:
A component signal that represents both a reactive value and a rendering stream.

**Note on Value**: Unlike regular signals which hold data, or computed signals which cache results, component signals don't store a meaningful "value." They are execution records that mark where components should render. The component's output is streamed as events/tokens rather than stored.

**Component Functions**:
Component functions receive props containing **ReadOnly signal objects** and return JSX (Node). Signal props are passed as objects at instantiation (setting up dependencies) but received as readonly references at execution:

```typescript
// components/UserCard.tsx
interface Props {
  name: ReadOnly<StateSignal<string>>;
  count: ReadOnly<StateSignal<number>>;
}

export default (props: Props) => {
  // Can read signal values
  const displayName = props.name.value.toUpperCase();

  // Can pass signals to child components
  const increment = createHandler(incSrc, [props.count]);

  return (
    <div>
      <h1>{props.name.value}</h1>
      <p>Count: {props.count.value}</p>
      <button onClick={increment}>Increment</button>
    </div>
  );
};
```

**Instantiation vs Execution**:
```tsx
// At instantiation - pass signal objects (sets up dependencies)
<UserCard name={nameSignal} count={countSignal} />

// At execution - receive ReadOnly signals (prevents mutation)
export default (props: { name: ReadOnly<StateSignal<string>> }) => {
  props.name.value = 'changed';  // ❌ TypeScript error - readonly
  return <div>{props.name.value}</div>;  // ✅ Can read
};
```

**Props Serialization**:
Primitives can be passed directly, while complex values must be signals:

```tsx
// ✅ Primitives passed directly
<Card title="Welcome" count={5} enabled={true} />

interface CardProps {
  title: string;
  count: number;
  enabled: boolean;
}

// ✅ Mixed primitives and signals
<UserProfile name={nameSignal} role="admin" age={25} />

interface UserProfileProps {
  name: ReadOnly<StateSignal<string>>;  // Object must be signal
  role: string;                          // Primitive can be direct
  age: number;                           // Primitive can be direct
}

// ❌ Objects/arrays must be signals
<DataTable rows={[{id: 1}, {id: 2}]} />  // Wrong - array not wrapped

// ✅ Correct - wrap in signal
const rows = createSignal([{id: 1}, {id: 2}]);
<DataTable rows={rows} />
```

**JSX Integration**:
Typically, components are not created manually with `createComponent`. Instead, the JSX factory function detects component usage and creates them automatically:

```typescript
// You write:
<UserCard name={nameSignal} count={countSignal} />

// JSX factory internally calls:
jsx(UserCard, { name: nameSignal, count: countSignal })
// Which creates: createComponent(UserCardSrc, { name: nameSignal, count: countSignal })
```

**As Computed-Like Signal**:
Components behave like computed signals in that:
- They have dependencies (props that are signals)
- They re-execute when those dependencies change
- They produce output (streamed tokens/events)

However, unlike computed signals which cache results in the registry, components are stream producers that push DOM updates to the stream.

**As DelegateStream**:
Components are also streams because:
- They spawn as independent DelegateStreams during rendering
- They can emit multiple event types (bind markers, tokens, registrations)
- They chain into parent streams maintaining sequential output
- They enable recursive parallel component spawning

**Lifecycle**:
1. **Creation**: JSX instantiation creates component signal
2. **Execution**: Component function runs, returns JSX tree
3. **Stream Spawning**: New ComponentDelegate processes returned tree
4. **Registration**: Component signal registered with bind markers
5. **Updates**: When props change, component re-executes and emits new output

## 5. Component Model

### 5.1 Components as Signals

Components are reactive entities like computed signals. They have dependencies (props), execute logic when those dependencies change, and produce rendered output to the stream.

**Value Semantics**:
Unlike regular signals (which hold data) or computed signals (which cache results), component signals are execution records. They mark locations where components render and track dependencies, but don't store the rendered output as a "value." The component's output streams as events/tokens during rendering.

On the client, when a component re-renders due to prop changes, the new output is generated and streamed to the Sink as a sync message, but this is not stored as a persistent value on the component signal itself.

**Dependency Tracking**:
When props contain signals, the component becomes dependent on those signals:

```tsx
const nameSignal = createSignal('Alice');
const countSignal = createSignal(0);

<UserCard name={nameSignal} count={countSignal} />
// Component c1 depends on signals: ['s1', 's2']
```

**Reactive Updates**:
When a prop signal updates:
1. Weaver detects `nameSignal` changed
2. Finds dependent component `c1`
3. Re-executes component function with new prop values
4. Generates new rendered output
5. Emits sync message: `{ id: 'c1', html: '...' }`
6. Sink replaces all `<!--^c1-->...<!--/c1-->` regions with new HTML

**Component Instance Identity**:
Each JSX component instantiation creates a **new** component signal:

```tsx
<UserCard name={alice} />  // Creates c1
<UserCard name={bob} />    // Creates c2 (separate instance)
```

Both are independent signals that update independently when their respective props change.

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

  // Component (function)
  if (typeof type === 'function') {
    return createComponent(type, props);
  }

  // Fragment
  if (type === Fragment) {
    return { type: Fragment, props: undefined, children: [...] };
  }
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
JSX component syntax automatically creates component signals:

```tsx
// You write:
<UserCard name="Alice" count={countSignal} />

// Compiles to:
jsx(UserCard, { name: "Alice", count: countSignal })

// jsx() function calls:
createComponent(UserCardLogic, { name: "Alice", count: countSignal })

// Creates ComponentSignal c1 with:
// - logic reference to UserCard module
// - props containing literal "Alice" and signal reference
```

**Components as Bindings**:
Since components are signals, component instantiation creates a binding in the output:

```tsx
<div>
  <UserCard name="Alice" />
</div>
```

Server output:
```html
<script>weaver.push({kind:'signal-definition',signal:{id:'c1',kind:'component',logic:{...},props:{...}}})</script>
<div>
  <!--^c1-->
    <div class="user-card">
      <h2>Alice</h2>
    </div>
  <!--/c1-->
</div>
```

When the component's props update, the entire region between `<!--^c1-->` and `<!--/c1-->` is replaced with the component's new output.

**Props Handling**:
Props can contain a mix of literal values and signal references:

```typescript
// Literal values are passed directly
<Card title="Hello" />

// Signals are passed as objects (not unwrapped)
<Card count={countSignal} />

// Inside component:
const Card = (props) => {
  // props.title === "Hello" (literal)
  // props.count === Signal object (can be bound)
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

**Computed Signal**:
```typescript
{
  kind: 'signal-definition',
  signal: {
    id: 'c1',
    kind: 'computed',
    logic: { src: '/assets/double.js', key: 'default' },
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
    logic: { src: '/assets/increment.js', key: 'default' },
    deps: ['s1']
  }
}
```

**Component**:
```typescript
{
  kind: 'signal-definition',
  signal: {
    id: 'comp1',
    kind: 'component',
    logic: { src: '/assets/UserCard.js', key: 'default' },
    props: { name: 's1', count: 's2' }
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
const doubled = createComputed(doubleSrc, [count]);

const App = () => (
  <div>
    <p>Count: {count}</p>
    <p>Doubled: {doubled}</p>
  </div>
);
```

Server output:
```html
<script>weaver.push({kind:'signal-definition',signal:{id:'s1',kind:'state',init:5}})</script>
<script>weaver.push({kind:'signal-definition',signal:{id:'c1',kind:'computed',logic:{src:'/assets/double.js'},deps:['s1']}})</script>
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

### 9.1 Source Phase Imports

Stream Weaver leverages ECMAScript Source Phase Imports (Stage 3) to treat modules as addressable data rather than immediately executable code.

**Source Phase Import Syntax**:
```typescript
import source CardModule from './components/Card';
import source incrementLogic from './actions/increment';

// CardModule is a module source reference, not the executed module
const card = createComponent(CardModule, props);
```

**Module as Data**:
Source phase imports return a module source object that can be:
- Passed around as data
- Serialized to a URL string
- Dynamically imported later: `import(source.url)`

**Server Execution Context**:
On the server during SSR:
- Components import logic modules via `import source`
- The build system provides source paths that resolve to actual modules
- During rendering, the server can execute these modules

**Client URL Resolution**:
The build system generates a manifest mapping source paths to public URLs:

```json
{
  "/src/components/Card.tsx": "/assets/Card-abc123.js",
  "/src/actions/increment.ts": "/assets/increment-def456.js"
}
```

When serializing to HTML, the server looks up the public URL for each module source and emits that in the registration script.

**Vite Plugin Integration**:
A Vite plugin handles:
- Intercepting source phase imports
- Generating the module mapping manifest
- Providing server-side resolution
- Ensuring client bundles are split appropriately

**Polyfill Strategy**:
Until source phase imports are widely supported, a build-time transformation converts:
```typescript
import source Card from './Card';
```

To:
```typescript
import CardUrl from './Card?url';
const Card = { url: CardUrl };
```

Vite's `?url` import provides the module URL as a string.

### 9.2 Module Mapping

The build system generates a mapping between source file paths and public bundle URLs.

**Build Process**:

1. **Development Mode**:
   - Vite serves modules directly: `/src/components/Card.tsx`
   - No bundling, instant transforms
   - Module URLs are source paths

2. **Production Build**:
   - Vite bundles and hashes modules: `/assets/Card-abc123.js`
   - Generates manifest: `.vite/manifest.json`
   - Maps original paths → hashed bundles

**Manifest Structure**:
```json
{
  "src/components/Card.tsx": {
    "file": "assets/Card-abc123.js",
    "src": "src/components/Card.tsx",
    "isEntry": false,
    "imports": ["assets/jsx-runtime-def456.js"]
  },
  "src/actions/increment.ts": {
    "file": "assets/increment-789xyz.js",
    "src": "src/actions/increment.ts",
    "isEntry": false
  }
}
```

**Server-Side Path Resolution**:
During SSR, the server reads the manifest and resolves module sources:

**Serialization Example**:
When the server serializes an addressable with logic (computed, action, or component):
- Look up the module's source path in the manifest
- Replace source path with public URL from manifest
- Emit as `signal-definition` message with complete definition

Example: Computed signal uses server source path during SSR, but gets serialized with public client URL:
```
Server: { id: 'c1', kind: 'computed', logic: { src: '/src/logic/double.ts' }, deps: ['s1'] }
↓
Client: weaver.push({ kind: 'signal-definition', signal: { id: 'c1', kind: 'computed', logic: { src: '/assets/double-abc123.js' }, deps: ['s1'] } })
```

**Client-Side Import**:
When the client needs to execute logic:
```typescript
const definition = registry.definitions.get('a1');
const module = await import(definition.logic.src);  // Fetches /assets/increment-789xyz.js
```

**Code Splitting**:
Each logic module is a separate bundle entry, enabling:
- Lazy loading (only fetch what's needed)
- Parallel downloads (multiple modules at once)
- Optimal caching (hash-based URLs)

**Development Experience**:
```typescript
// You write:
import source increment from './actions/increment';

// Build provides:
// - Dev: increment.url === '/src/actions/increment.ts'
// - Prod: increment.url === '/assets/increment-789xyz.js'

// Server renders:
<script>weaver.push({
  kind: 'signal-definition',
  signal: {
    id: 'a1',
    kind: 'action',
    logic: { src: '/assets/increment-789xyz.js' },
    deps: ['s1']
  }
})</script>

// Client imports:
await import('/assets/increment-789xyz.js');  // Fetches bundle
```

**No Manual Configuration**:
Developers don't manage the mapping manually. The build system:
- Detects `import source` statements
- Bundles referenced modules
- Generates manifest automatically
- Server loads manifest at startup

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
import source calculateTotal from '../logic/calculateTotal';

export const items = createSignal([]);
export const taxRate = createSignal(0.08);

// Computed total price
export const subtotal = createComputed(subtotalLogic, [items]);
export const tax = createComputed(taxLogic, [subtotal, taxRate]);
export const total = createComputed(totalLogic, [subtotal, tax]);
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
  formatPriceSrc,
  [price, currency, locale, showDecimals]
);
```

### 10.3 Component Composition

Components can dynamically resolve to other components, enabling powerful composition patterns.

**Pattern: View Resolver**

A higher-order component that returns different components based on signals:

```typescript
// components/ViewResolver.tsx
import source LoginView from './LoginView';
import source DashboardView from './DashboardView';

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
import source ViewResolver from './components/ViewResolver';

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
import source incrementSrc from '../actions/increment';

const Counter = () => {
  const increment = createHandler(incrementSrc, [count]);

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
import source submitFormSrc from '../actions/submitForm';
import source updateInputSrc from '../actions/updateInput';

const ContactForm = () => {
  const name = createSignal('');
  const email = createSignal('');
  const status = createSignal('idle');

  const handleNameInput = createHandler(updateInputSrc, [name]);
  const handleEmailInput = createHandler(updateInputSrc, [email]);
  const handleSubmit = createHandler(submitFormSrc, [name, email, status]);

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
- **Source Phase Import Polyfill**: Build-time transformation for environments without native support
