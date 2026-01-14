# Stream Weaver Implementation Plan

This document outlines the incremental implementation milestones for building Stream Weaver from the current POC to a full framework. Each milestone builds on previous work and includes clear, testable success criteria.

## Current POC Status

The POC includes:
- ✅ ComponentDelegate with DelegateStream for parallel async rendering
- ✅ JSX runtime (jsx, Fragment)
- ✅ ComponentSerializer for HTML output
- ✅ Tests demonstrating parallel execution with sequential output

## Implementation Strategy

**Infrastructure-First Approach**: Build the signal infrastructure (state storage, dependency tracking, reactivity propagation, serialization) before adding logic execution. This allows testing the reactive system by manually triggering updates, without needing module loading or source phase imports until later milestones.

## Implementation Milestones

---

## Milestone 1: Signal System Foundation

**Goal**: Implement basic signal definitions and registry for value storage.

**Implementation Tasks**:
- Create `Signal` interface and `StateSignal<T>` type (definition objects)
- Implement `createSignal<T>(init: T): StateSignal<T>` - returns inert metadata object
- Implement ID allocation (counter-based: `s1`, `s2`, ... or hash-based)
- Create `WeaverRegistry` class with internal Maps for:
  - Signal definitions: `Map<string, Signal>`
  - Signal values: `Map<string, unknown>`
- Implement registry methods:
  - `registerSignal(signal: Signal): void` - stores definition + initial value
  - `getValue(id: string): unknown` - reads value
  - `setValue(id: string, value: unknown): void` - writes value (no events yet)
  - `getSignal(id: string): Signal` - retrieves definition

**Test Criteria**:
```typescript
test('signal creation produces definition object', () => {
  const count = createSignal(0);
  expect(count.id).toBe('s1');
  expect(count.kind).toBe('state');
  expect(count.init).toBe(0);
  expect(count).not.toHaveProperty('value'); // No .value on definitions
});

test('multiple signals have unique IDs', () => {
  const s1 = createSignal(1);
  const s2 = createSignal(2);
  expect(s1.id).toBe('s2'); // Continues from previous test
  expect(s2.id).toBe('s3');
});

test('registry stores signal values', () => {
  const count = createSignal(10);
  const registry = new WeaverRegistry();

  registry.registerSignal(count);
  expect(registry.getValue('s4')).toBe(10); // Initial value stored

  registry.setValue('s4', 20);
  expect(registry.getValue('s4')).toBe(20);
});

test('registry stores signal definitions', () => {
  const count = createSignal(5);
  const registry = new WeaverRegistry();

  registry.registerSignal(count);
  const retrieved = registry.getSignal('s5');

  expect(retrieved).toBe(count); // Same definition object
  expect(retrieved.init).toBe(5);
});
```

**Deliverable**: Signal definition objects and WeaverRegistry for value storage.

---

## Milestone 2: Dependency Graph

**Goal**: Track dependencies between signals without execution.

**Implementation Tasks**:
- Implement `ComputedSignal`, `ActionSignal`, `HandlerSignal` interfaces per API.md (metadata only)
- Implement content-addressable ID hashing (hash logic + deps → ID)
- Implement `createComputed(logic, deps)` - uses dummy logic objects for testing
- Implement `createAction(logic, deps)`
- Implement `createHandler(logic, deps)`
- Add dependency graph to WeaverRegistry: `Map<string, Set<string>>`
- Implement `registry.getDependents(id)` - returns Set of dependent signal IDs
- Implement `registry.getDependencies(id)` - returns array of dependency signal IDs
- Track bidirectional relationships when signals are registered

**Test Criteria**:
```typescript
test('computed definition registers dependencies', () => {
  const count = createSignal(5);
  const doubled = createComputed({ src: 'double.js' }, [count]);

  const registry = new WeaverRegistry();
  registry.registerSignal(count);
  registry.registerSignal(doubled);

  const dependents = registry.getDependents(count.id);
  expect(dependents).toContain(doubled.id);
});

test('registry tracks dependencies bidirectionally', () => {
  const count = createSignal(5);
  const doubled = createComputed({ src: 'double.js' }, [count]);

  const registry = new WeaverRegistry();
  registry.registerSignal(count);
  registry.registerSignal(doubled);

  expect(registry.getDependents(count.id)).toContain(doubled.id);
  expect(registry.getDependencies(doubled.id)).toEqual([count.id]);
});

test('same logic and deps produce same ID (content-addressable)', () => {
  const count = createSignal(5);
  const c1 = createComputed({ src: 'double.js' }, [count]);
  const c2 = createComputed({ src: 'double.js' }, [count]);

  expect(c1.id).toBe(c2.id);
});

test('dependency graph tracks multiple levels', () => {
  const s1 = createSignal(1);
  const c1 = createComputed({ src: 'double.js' }, [s1]);
  const c2 = createComputed({ src: 'quadruple.js' }, [c1]);

  const registry = new WeaverRegistry();
  registry.registerSignal(s1);
  registry.registerSignal(c1);
  registry.registerSignal(c2);

  expect(registry.getDependents(s1.id)).toContain(c1.id);
  expect(registry.getDependents(c1.id)).toContain(c2.id);
});

test('action and handler definitions work similarly', () => {
  const count = createSignal(0);
  const increment = createAction({ src: 'increment.js' }, [count]);
  const handleClick = createHandler({ src: 'click.js' }, [count]);

  const registry = new WeaverRegistry();
  registry.registerSignal(count);
  registry.registerSignal(increment);
  registry.registerSignal(handleClick);

  expect(registry.getDependents(count.id)).toContain(increment.id);
  expect(registry.getDependents(count.id)).toContain(handleClick.id);
});
```

**Deliverable**: Dependency graph infrastructure with bidirectional tracking, no logic execution.

---

## Milestone 3: Logic System & Signal Interfaces

**Goal**: Load logic modules and execute them with signal interface wrappers.

**Implementation Tasks**:
- Implement `loadLogic(logic: Logic)` using `await import(logic.src)`
- Create signal interface wrappers that provide `.value` getter/setter accessing registry
- Implement `createReadOnlySignalInterface(registry, id)` - wrapper with readonly `.value`
- Implement `createWritableSignalInterface(registry, id)` - wrapper with writable `.value`
- Implement `executeComputed(registry, id)` - loads logic, wraps deps as readonly, executes, caches result
- Implement `executeAction(registry, id)` - loads logic, wraps deps as writable, executes
- Implement `executeHandler(registry, id, event)` - loads logic, passes event + writable deps, executes
- Store computed results in registry
- Defer reactivity propagation to M4 (manual execution only for now)

**Test Criteria**:
```typescript
test('logic module can be loaded', async () => {
  // tests/fixtures/double.ts: export default (count) => count.value * 2
  const logic = { src: './tests/fixtures/double.js' };
  const fn = await loadLogic(logic);

  expect(typeof fn).toBe('function');
});

test('computed executes logic and caches result', async () => {
  const count = createSignal(5);
  const doubled = createComputed({ src: './tests/fixtures/double.js' }, [count]);

  const registry = new WeaverRegistry();
  registry.registerSignal(count);
  registry.registerSignal(doubled);
  registry.setValue(count.id, 5);

  await executeComputed(registry, doubled.id);

  expect(registry.getValue(doubled.id)).toBe(10);
});

test('signal interface provides .value that accesses registry', () => {
  const count = createSignal(5);
  const registry = new WeaverRegistry();
  registry.registerSignal(count);
  registry.setValue(count.id, 5);

  const countInterface = createWritableSignalInterface(registry, count.id);

  expect(countInterface.value).toBe(5);
  countInterface.value = 10;
  expect(registry.getValue(count.id)).toBe(10);
});

test('action can mutate signals via writable interface', async () => {
  // tests/fixtures/increment.ts: export default (count) => { count.value++ }
  const count = createSignal(0);
  const increment = createAction({ src: './tests/fixtures/increment.js' }, [count]);

  const registry = new WeaverRegistry();
  registry.registerSignal(count);
  registry.registerSignal(increment);
  registry.setValue(count.id, 0);

  await executeAction(registry, increment.id);

  expect(registry.getValue(count.id)).toBe(1);
});

test('handler receives event and writable signal interfaces', async () => {
  // tests/fixtures/handleClick.ts: export default (event, count) => { count.value++ }
  const count = createSignal(0);
  const handler = createHandler({ src: './tests/fixtures/handleClick.js' }, [count]);

  const registry = new WeaverRegistry();
  registry.registerSignal(count);
  registry.registerSignal(handler);
  registry.setValue(count.id, 0);

  const mockEvent = new MouseEvent('click');
  await executeHandler(registry, handler.id, mockEvent);

  expect(registry.getValue(count.id)).toBe(1);
});

test('multiple signals can be passed to logic', async () => {
  // tests/fixtures/sum.ts: export default (a, b) => a.value + b.value
  const a = createSignal(5);
  const b = createSignal(10);
  const sum = createComputed({ src: './tests/fixtures/sum.js' }, [a, b]);

  const registry = new WeaverRegistry();
  registry.registerSignal(a);
  registry.registerSignal(b);
  registry.registerSignal(sum);
  registry.setValue(a.id, 5);
  registry.setValue(b.id, 10);

  await executeComputed(registry, sum.id);

  expect(registry.getValue(sum.id)).toBe(15);
});
```

**Deliverable**: Logic loading and execution with signal interface wrappers that provide `.value` access.

---

## Milestone 4: Reactivity Propagation (ChainExplode)

**Goal**: Implement SignalDelegate to propagate updates and trigger logic execution recursively.

**Implementation Tasks**:
- Create `SignalDelegate` extending `DelegateStream<SignalEvent, Token>`
- Implement transform that receives signal-update events
- Query registry for dependents when update event received
- Use `chain()` to spawn logic execution for each dependent
- Execute computed logic when its dependencies update
- Emit new signal-update events after execution completes
- Support cascading updates through multiple levels
- Maintain parallel execution with sequential output ordering

**Test Criteria**:
```typescript
test('signal update triggers dependent computed execution', async () => {
  const count = createSignal(5);
  const doubled = createComputed({ src: './tests/fixtures/double.js' }, [count]);

  const registry = new WeaverRegistry();
  registry.registerSignal(count);
  registry.registerSignal(doubled);
  registry.setValue(count.id, 5);

  await executeComputed(registry, doubled.id); // Initial execution
  expect(registry.getValue(doubled.id)).toBe(10);

  const delegate = new SignalDelegate(registry);
  const writer = delegate.writable.getWriter();

  // Collect output tokens
  const tokens = [];
  (async () => {
    for await (const token of delegate.readable) {
      tokens.push(token);
    }
  })();

  // Trigger update
  await writer.write({ kind: 'signal-update', id: count.id, value: 7 });
  await writer.close();

  // Computed should have re-executed
  expect(registry.getValue(doubled.id)).toBe(14);
});

test('cascading updates propagate through multiple levels', async () => {
  const count = createSignal(2);
  const doubled = createComputed({ src: './tests/fixtures/double.js' }, [count]);
  const quadrupled = createComputed({ src: './tests/fixtures/double.js' }, [doubled]);

  const registry = new WeaverRegistry();
  registry.registerSignal(count);
  registry.registerSignal(doubled);
  registry.registerSignal(quadrupled);
  registry.setValue(count.id, 2);

  await executeComputed(registry, doubled.id);
  await executeComputed(registry, quadrupled.id);

  expect(registry.getValue(doubled.id)).toBe(4);
  expect(registry.getValue(quadrupled.id)).toBe(8);

  const delegate = new SignalDelegate(registry);
  const writer = delegate.writable.getWriter();

  const events = [];
  (async () => {
    for await (const event of delegate.readable) {
      if (event.kind === 'signal-update') {
        events.push(event.id);
      }
    }
  })();

  await writer.write({ kind: 'signal-update', id: count.id, value: 3 });
  await writer.close();

  // All levels updated
  expect(registry.getValue(count.id)).toBe(3);
  expect(registry.getValue(doubled.id)).toBe(6);
  expect(registry.getValue(quadrupled.id)).toBe(12);
  expect(events).toEqual([count.id, doubled.id, quadrupled.id]);
});

test('multiple dependents execute in parallel', async () => {
  const count = createSignal(5);
  const doubled = createComputed({ src: './tests/fixtures/double.js' }, [count]);
  const tripled = createComputed({ src: './tests/fixtures/triple.js' }, [count]);

  const registry = new WeaverRegistry();
  registry.registerSignal(count);
  registry.registerSignal(doubled);
  registry.registerSignal(tripled);
  registry.setValue(count.id, 5);

  await executeComputed(registry, doubled.id);
  await executeComputed(registry, tripled.id);

  const delegate = new SignalDelegate(registry);
  const writer = delegate.writable.getWriter();

  (async () => {
    for await (const token of delegate.readable) {
      // Consume stream
    }
  })();

  const startTime = Date.now();
  await writer.write({ kind: 'signal-update', id: count.id, value: 10 });
  await writer.close();
  const elapsed = Date.now() - startTime;

  expect(registry.getValue(doubled.id)).toBe(20);
  expect(registry.getValue(tripled.id)).toBe(30);
  // Should execute in parallel, not sequentially
  expect(elapsed).toBeLessThan(100); // Reasonable threshold
});
```

**Deliverable**: Full reactive propagation using ChainExplode pattern with cascading updates.

---

## Milestone 5: Server Bind Markers

**Goal**: Serialize signals and bindings to HTML with bind markers and metadata scripts.

**Implementation Tasks**:
- Implement bind marker generation (`<!--^s1-->`, `<!--/s1-->`)
- Implement `signal-definition` token emission in ComponentDelegate when signal bound
- Create inline script serialization (`<script>weaver.push(...)</script>`)
- Implement attribute binding serialization (`data-w-classname="s1"`)
- Implement event handler serialization (`data-w-onclick="h1"`)
- Update ComponentSerializer to handle bind markers and definition scripts
- Serialize Logic references with both `src` and `key` fields

**Test Criteria**:
```typescript
test('signal serializes with bind markers and definition script', async () => {
  const count = createSignal(5);
  const registry = new WeaverRegistry();
  registry.registerSignal(count);
  registry.setValue(count.id, 5);

  const weaver = new StreamWeaver({ root: <div>{count}</div>, registry });
  const html = (await Array.fromAsync(weaver.readable)).join('');

  expect(html).toContain('<!--^' + count.id + '-->5<!--/' + count.id + '-->');
  expect(html).toContain('<script>weaver.push({kind:"signal-definition",signal:{id:"' + count.id + '",kind:"state",init:5}})</script>');
});

test('attribute bindings serialize with data attributes', async () => {
  const theme = createSignal('dark');
  const registry = new WeaverRegistry();
  registry.registerSignal(theme);
  registry.setValue(theme.id, 'dark');

  const weaver = new StreamWeaver({ root: <div className={theme}>Content</div>, registry });
  const html = (await Array.fromAsync(weaver.readable)).join('');

  expect(html).toContain('class="dark"');
  expect(html).toContain('data-w-classname="' + theme.id + '"');
});

test('handler bindings serialize with data attributes and logic', async () => {
  const count = createSignal(0);
  const handler = createHandler({ src: './fixtures/click.js' }, [count]);

  const registry = new WeaverRegistry();
  registry.registerSignal(count);
  registry.registerSignal(handler);

  const weaver = new StreamWeaver({ root: <button onClick={handler}>Click</button>, registry });
  const html = (await Array.fromAsync(weaver.readable)).join('');

  expect(html).toContain('data-w-onclick="' + handler.id + '"');
  expect(html).toContain('<script>weaver.push({kind:"signal-definition",signal:{id:"' + handler.id + '",kind:"handler",logic:{src:"./fixtures/click.js"},deps:["' + count.id + '"]}})</script>');
});

test('computed definition serializes with logic reference', async () => {
  const count = createSignal(5);
  const doubled = createComputed({ src: './fixtures/double.js' }, [count]);

  const registry = new WeaverRegistry();
  registry.registerSignal(count);
  registry.registerSignal(doubled);
  registry.setValue(count.id, 5);

  await executeComputed(registry, doubled.id);

  const weaver = new StreamWeaver({ root: <div>{doubled}</div>, registry });
  const html = (await Array.fromAsync(weaver.readable)).join('');

  expect(html).toContain('<script>weaver.push({kind:"signal-definition",signal:{id:"' + doubled.id + '",kind:"computed",logic:{src:"./fixtures/double.js"},deps:["' + count.id + '"]}})</script>');
});
```

**Deliverable**: Complete server-side HTML serialization with bind markers, data attributes, and signal definitions.

---

## Milestone 6: Client Sink

**Goal**: Implement the client-side DOM update sink.

**Implementation Tasks**:
- Create `Sink` class
- Implement bind marker scanning and Range creation
- Implement `data-w-*` attribute scanning for attribute bindings
- Implement `sync(id, html)` for content replacement
- Implement `syncAttribute(id, attr, value)` for attribute updates
- Implement recursive rescanning after updates

**Test Criteria**:
```typescript
test('sink discovers bind markers', () => {
  document.body.innerHTML = '<!--^s1-->5<!--/s1-->';
  const sink = new Sink();
  sink.scan(document.body);

  expect(sink.bindPoints.has('s1')).toBe(true);
  expect(sink.bindPoints.get('s1').length).toBe(1);
});

test('sink updates content on sync', () => {
  document.body.innerHTML = '<!--^s1-->5<!--/s1-->';
  const sink = new Sink();
  sink.scan(document.body);

  sink.sync('s1', '10');
  expect(document.body.textContent.trim()).toBe('10');
});

test('sink updates attributes', () => {
  document.body.innerHTML = '<div class="dark" data-w-classname="s1">Test</div>';
  const sink = new Sink();
  sink.scan(document.body);

  sink.syncAttribute('s1', 'classname', 'light');
  expect(document.querySelector('div').className).toBe('light');
});

test('sink handles multiple bind points for same signal', () => {
  document.body.innerHTML = '<div><!--^s1-->5<!--/s1--></div><span><!--^s1-->5<!--/s1--></span>';
  const sink = new Sink();
  sink.scan(document.body);

  sink.sync('s1', '10');
  expect(document.querySelector('div').textContent.trim()).toBe('10');
  expect(document.querySelector('span').textContent.trim()).toBe('10');
});

test('sink rescans after update for nested markers', () => {
  document.body.innerHTML = '<!--^c1--><!--^s1-->5<!--/s1--><!--/c1-->';
  const sink = new Sink();
  sink.scan(document.body);

  sink.sync('c1', '<div><!--^s1-->10<!--/s1--></div>');

  // Rescan should discover the new s1 marker
  sink.sync('s1', '20');
  expect(document.body.textContent.trim()).toBe('20');
});
```

**Deliverable**: Working client-side DOM updater that handles content and attribute bindings.

---

## Milestone 7: Event Delegation Infrastructure

**Goal**: Wire up event listeners and route to SignalDelegate for handler execution.

**Implementation Tasks**:
- Implement global event listeners (click, submit, input, etc.) on document root
- Implement event delegation via `data-w-{eventname}` attribute lookup
- Find handler ID from data attribute when event fires
- Route to SignalDelegate by emitting handler-execute event to stream
- Integrate with M4's SignalDelegate for actual execution
- Support event bubbling through DOM hierarchy

**Test Criteria**:
```typescript
test('event delegation finds handler ID and triggers execution', async () => {
  const count = createSignal(0);
  const handler = createHandler({ src: './fixtures/click.js' }, [count]);

  const registry = new WeaverRegistry();
  registry.registerSignal(count);
  registry.registerSignal(handler);
  registry.setValue(count.id, 0);

  document.body.innerHTML = '<button data-w-onclick="' + handler.id + '">Click</button>';

  const delegate = new SignalDelegate(registry);
  setupEventDelegation(delegate); // Wire up events to delegate

  document.querySelector('button').click();
  await waitFor(() => registry.getValue(count.id) === 1);

  expect(registry.getValue(count.id)).toBe(1);
});

test('multiple event types work', async () => {
  const count1 = createSignal(0);
  const count2 = createSignal(0);
  const clickHandler = createHandler({ src: './fixtures/increment.js' }, [count1]);
  const inputHandler = createHandler({ src: './fixtures/increment.js' }, [count2]);

  const registry = new WeaverRegistry();
  registry.registerSignal(count1);
  registry.registerSignal(count2);
  registry.registerSignal(clickHandler);
  registry.registerSignal(inputHandler);

  document.body.innerHTML = `
    <button data-w-onclick="${clickHandler.id}">Click</button>
    <input data-w-oninput="${inputHandler.id}" />
  `;

  const delegate = new SignalDelegate(registry);
  setupEventDelegation(delegate);

  document.querySelector('button').click();
  await waitFor(() => registry.getValue(count1.id) === 1);

  document.querySelector('input').dispatchEvent(new Event('input'));
  await waitFor(() => registry.getValue(count2.id) === 1);

  expect(registry.getValue(count1.id)).toBe(1);
  expect(registry.getValue(count2.id)).toBe(1);
});

test('event delegation bubbles to parent', async () => {
  const count = createSignal(0);
  const handler = createHandler({ src: './fixtures/increment.js' }, [count]);

  const registry = new WeaverRegistry();
  registry.registerSignal(count);
  registry.registerSignal(handler);
  registry.setValue(count.id, 0);

  document.body.innerHTML = '<div data-w-onclick="' + handler.id + '"><button>Nested</button></div>';

  const delegate = new SignalDelegate(registry);
  setupEventDelegation(delegate);

  document.querySelector('button').click();
  await waitFor(() => registry.getValue(count.id) === 1);

  expect(registry.getValue(count.id)).toBe(1); // Parent handler executed
});
```

**Deliverable**: Event delegation infrastructure that routes events to SignalDelegate for execution.

---

## Milestone 8: Components as Signals

**Goal**: Integrate components into the reactive signal system.

**Implementation Tasks**:
- Implement `ComponentSignal` interface per API.md
- Implement `createComponent(logic: Logic, props: Props): ComponentSignal`
- Implement content-addressable ID for components (hash logic + serialized props)
- Extract signal dependencies from props (signal objects → IDs)
- Register components in dependency graph when bound
- Update JSX factory to call `createComponent` for function components
- Emit `signal-definition` tokens for components in ComponentDelegate
- Implement component re-rendering when prop signals change via SignalDelegate

**Test Criteria**:
```typescript
test('component definition is created with signal props', () => {
  const name = createSignal('Alice');
  const Card = () => <div>{name}</div>;
  const card = createComponent({ src: './fixtures/Card.js' }, { name, title: 'User' });

  expect(card.kind).toBe('component');
  expect(card.id).toMatch(/^c/);
  expect(card.props.name).toBe(name);
  expect(card.props.title).toBe('User');
});

test('component dependencies extracted from props', () => {
  const name = createSignal('Alice');
  const age = createSignal(30);
  const card = createComponent({ src: './fixtures/Card.js' }, { name, age, role: 'Admin' });

  const registry = new WeaverRegistry();
  registry.registerSignal(name);
  registry.registerSignal(age);
  registry.registerSignal(card);

  expect(registry.getDependents(name.id)).toContain(card.id);
  expect(registry.getDependents(age.id)).toContain(card.id);
});

test('component serialization includes props and logic', async () => {
  const name = createSignal('Alice');
  const Card = (props: { name: StateSignal<string>, title: string }) => <div>{props.name} - {props.title}</div>;
  const card = createComponent({ src: './fixtures/Card.js' }, { name, title: 'User' });

  const registry = new WeaverRegistry();
  registry.registerSignal(name);
  registry.registerSignal(card);
  registry.setValue(name.id, 'Alice');

  const weaver = new StreamWeaver({ root: card, registry });
  const html = (await Array.fromAsync(weaver.readable)).join('');

  expect(html).toContain('<script>weaver.push({kind:"signal-definition",signal:{id:"' + card.id + '",kind:"component",logic:{src:"./fixtures/Card.js"},props:{name:"' + name.id + '",title:"User"}}})</script>');
});

test('component re-renders when prop signal changes', async () => {
  const name = createSignal('Alice');
  const Card = (props: { name: StateSignal<string> }) => <div>{props.name}</div>;
  const card = createComponent({ src: './fixtures/Card.js' }, { name });

  const registry = new WeaverRegistry();
  registry.registerSignal(name);
  registry.registerSignal(card);
  registry.setValue(name.id, 'Alice');

  // Initial render
  await executeComputed(registry, card.id);
  expect(registry.getValue(card.id)).toContain('Alice');

  // Update signal
  const delegate = new SignalDelegate(registry);
  const writer = delegate.writable.getWriter();

  (async () => {
    for await (const token of delegate.readable) {
      // Consume stream
    }
  })();

  await writer.write({ kind: 'signal-update', id: name.id, value: 'Bob' });
  await writer.close();

  // Component should re-execute
  expect(registry.getValue(card.id)).toContain('Bob');
});
```

**Deliverable**: Components as fully reactive entities in the signal graph.

---

## Milestone 9: Full Stack Integration

**Goal**: End-to-end SSR to interactive client with all features working.

**Implementation Tasks**:
- Create `ClientWeaver` class that initializes from HTML
- Implement registry restoration from inline `<script>weaver.push()</script>` tags
- Parse and register signal definitions from server HTML
- Initialize Sink and scan for bind markers
- Initialize SignalDelegate and connect to event delegation
- Wire up full reactive flow: events → handlers → updates → computed → DOM
- Create working example demonstrating full SSR→client hydration

**Test Criteria**:
```typescript
test('client initializes from server HTML', () => {
  const serverHtml = `
    <script>
      window.weaver = new ClientWeaver();
      weaver.push({kind:'signal-definition',signal:{id:'s1',kind:'state',init:5}});
      weaver.push({kind:'signal-definition',signal:{id:'c1',kind:'computed',logic:{src:'/double.js'},deps:['s1']}});
    </script>
    <div>
      <p>Count: <!--^s1-->5<!--/s1--></p>
      <p>Doubled: <!--^c1-->10<!--/c1--></p>
    </div>
  `;

  document.body.innerHTML = serverHtml;
  const clientWeaver = new ClientWeaver();

  // Registry has both signals
  expect(clientWeaver.registry.getSignal('s1')).toBeDefined();
  expect(clientWeaver.registry.getSignal('c1')).toBeDefined();

  // Sink discovered bind points
  expect(clientWeaver.sink.hasBindPoint('s1')).toBe(true);
  expect(clientWeaver.sink.hasBindPoint('c1')).toBe(true);
});

test('full reactive cycle: event → handler → computed → DOM', async () => {
  // Server-side rendering
  const count = createSignal(0);
  const doubled = createComputed({ src: './fixtures/double.js' }, [count]);
  const increment = createHandler({ src: './fixtures/increment.js' }, [count]);

  const registry = new WeaverRegistry();
  registry.registerSignal(count);
  registry.registerSignal(doubled);
  registry.registerSignal(increment);
  registry.setValue(count.id, 0);

  await executeComputed(registry, doubled.id);

  const App = () => (
    <div>
      <p class="count"><!--^{count.id}-->0<!--/{count.id}--></p>
      <p class="doubled"><!--^{doubled.id}-->0<!--/{doubled.id}--></p>
      <button class="increment" data-w-onclick={increment.id}>+1</button>
    </div>
  );

  const weaver = new StreamWeaver({ root: <App />, registry });
  const serverHtml = (await Array.fromAsync(weaver.readable)).join('');

  // Client-side hydration
  document.body.innerHTML = serverHtml;
  const clientWeaver = new ClientWeaver();

  // Initial state
  expect(document.querySelector('.count').textContent.trim()).toBe('0');
  expect(document.querySelector('.doubled').textContent.trim()).toBe('0');

  // Click increment button
  document.querySelector('.increment').click();
  await waitFor(() => document.querySelector('.count').textContent.trim() === '1');

  // State updated reactively
  expect(document.querySelector('.count').textContent.trim()).toBe('1');
  expect(document.querySelector('.doubled').textContent.trim()).toBe('2');

  // Click again
  document.querySelector('.increment').click();
  await waitFor(() => document.querySelector('.count').textContent.trim() === '2');

  expect(document.querySelector('.count').textContent.trim()).toBe('2');
  expect(document.querySelector('.doubled').textContent.trim()).toBe('4');
});
```

**Deliverable**: Production-ready framework with complete SSR to client interactivity.

---

## Implementation Strategy

### Approach for AI Agent

Each milestone should be implemented as follows:

1. **Read the milestone spec** - Understand the goal and deliverables
2. **Implement the functionality** - Write the code for the milestone
3. **Write tests first or alongside** - Ensure all test criteria pass
4. **Run tests** - Verify the milestone is complete
5. **Stop for review** - Wait for human approval before proceeding

### Testing Philosophy

- Each milestone must have passing tests before moving on
- Tests should cover the interfaces defined in API.md
- Use the existing test infrastructure (Vitest)
- Tests serve as executable documentation
- Early milestones test infrastructure without execution (events, propagation)
- Later milestones add execution and test end-to-end workflows

### Dependencies Between Milestones

```
M1 (Signals)
  ↓
M2 (Dependency Graph)
  ↓
M3 (Logic System & Signal Interfaces)
  ↓
M4 (Reactivity Propagation / ChainExplode)
  ↓
M5 (Server Bind Markers) ──→ M6 (Client Sink)
  ↓                            ↓
M7 (Event Delegation) ────────┘
  ↓
M8 (Components as Signals)
  ↓
M9 (Full Stack Integration)
```

### Estimated Complexity

| Milestone | Complexity | Risk | Notes |
|-----------|-----------|------|-------|
| M1 | Low | Low | Basic infrastructure |
| M2 | Medium | Medium | Content-addressable IDs, graph building |
| M3 | High | High | Module loading, signal interfaces with .value |
| M4 | High | High | ChainExplode reactivity, cascading updates |
| M5 | Medium | Medium | Serialization of all binding types |
| M6 | Medium | Low | Standard DOM Range manipulation |
| M7 | Low | Low | Event delegation patterns |
| M8 | Medium | Medium | Component integration with existing POC |
| M9 | High | High | Full client/server parity |

### Review Points

After each milestone, review:
- ✅ All tests pass
- ✅ Implementation matches API.md interfaces
- ✅ No regressions in previous milestones
- ✅ Code is clear and maintainable
- ✅ M1-M2: Pure infrastructure (no execution)
- ✅ M3+: Logic execution and integration

The agent should stop and request review before proceeding to the next milestone.
