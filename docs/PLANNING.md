# Stream Weaver Implementation Plan

This document outlines the incremental implementation milestones for building Stream Weaver from the current POC to a full framework. Each milestone builds on previous work and includes clear, testable success criteria.

## Current POC Status

The POC includes:
- ✅ ComponentDelegate with DelegateStream for parallel async rendering
- ✅ JSX runtime (jsx, Fragment)
- ✅ ComponentSerializer for HTML output
- ✅ Tests demonstrating parallel execution with sequential output

## Implementation Strategy

**Infrastructure-First Approach**: Build the signal infrastructure (state storage, dependency tracking, reactivity propagation, serialization) before adding logic execution. This allows testing the reactive system by manually triggering updates, without needing module loading or build plugin transformation until later milestones.

## Implementation Milestones

---

## Milestone 1: Signal System Foundation

**Goal**: Implement basic signal definitions and registry for value storage.

**Implementation Tasks**:
- Create `Signal` interface and `StateSignal<T>` type (definition objects)
- Implement `defineSignal<T>(init: T): StateSignal<T>` - returns inert metadata object
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
  const count = defineSignal(0);
  expect(count.id).toBe('s1');
  expect(count.kind).toBe('state');
  expect(count.init).toBe(0);
  expect(count).not.toHaveProperty('value'); // No .value on definitions
});

test('multiple signals have unique IDs', () => {
  const s1 = defineSignal(1);
  const s2 = defineSignal(2);
  expect(s1.id).toBe('s2'); // Continues from previous test
  expect(s2.id).toBe('s3');
});

test('registry stores signal values', () => {
  const count = defineSignal(10);
  const registry = new WeaverRegistry();

  registry.registerSignal(count);
  expect(registry.getValue('s4')).toBe(10); // Initial value stored

  registry.setValue('s4', 20);
  expect(registry.getValue('s4')).toBe(20);
});

test('registry stores signal definitions', () => {
  const count = defineSignal(5);
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
- Implement `LogicSignal`, `ComputedSignal`, `ActionSignal`, `HandlerSignal` interfaces per API.md (metadata only)
- Implement content-addressable ID hashing (hash logic ID + deps → ID)
- Implement `defineLogic(mod: Promise<M>)` - creates LogicSignal (for testing, use shim that returns mock LogicSignal)
- Implement `defineComputed(logic, deps)` - accepts LogicSignal or Promise<M>, stores logic ID reference
- Implement `defineAction(logic, deps)`
- Implement `defineHandler(logic, deps)`
- Add dependency graph to WeaverRegistry: `Map<string, Set<string>>`
- Implement `registry.getDependents(id)` - returns Set of dependent signal IDs
- Implement `registry.getDependencies(id)` - returns array of dependency signal IDs
- Track bidirectional relationships when signals are registered

**Test Criteria**:
```typescript
// Test shim for defineLogic during M2 (before module loading works)
function createMockLogic(name: string): LogicSignal {
  return { id: `logic_${name}`, kind: 'logic', src: `${name}.js` };
}

test('computed definition registers dependencies', () => {
  const count = defineSignal(5);
  const doubleLogic = createMockLogic('double');
  const doubled = defineComputed(doubleLogic, [count]);

  const registry = new WeaverRegistry();
  registry.registerSignal(count);
  registry.registerSignal(doubleLogic);
  registry.registerSignal(doubled);

  const dependents = registry.getDependents(count.id);
  expect(dependents).toContain(doubled.id);
  expect(doubled.logic).toBe(doubleLogic.id); // Stores logic ID reference
});

test('registry tracks dependencies bidirectionally', () => {
  const count = defineSignal(5);
  const doubleLogic = createMockLogic('double');
  const doubled = defineComputed(doubleLogic, [count]);

  const registry = new WeaverRegistry();
  registry.registerSignal(count);
  registry.registerSignal(doubleLogic);
  registry.registerSignal(doubled);

  expect(registry.getDependents(count.id)).toContain(doubled.id);
  expect(registry.getDependencies(doubled.id)).toEqual([count.id]);
});

test('same logic and deps produce same ID (content-addressable)', () => {
  const count = defineSignal(5);
  const doubleLogic = createMockLogic('double');
  const c1 = defineComputed(doubleLogic, [count]);
  const c2 = defineComputed(doubleLogic, [count]);

  expect(c1.id).toBe(c2.id); // Hash based on logic ID + dep IDs
});

test('dependency graph tracks multiple levels', () => {
  const s1 = defineSignal(1);
  const doubleLogic = createMockLogic('double');
  const quadLogic = createMockLogic('quadruple');
  const c1 = defineComputed(doubleLogic, [s1]);
  const c2 = defineComputed(quadLogic, [c1]);

  const registry = new WeaverRegistry();
  registry.registerSignal(s1);
  registry.registerSignal(doubleLogic);
  registry.registerSignal(quadLogic);
  registry.registerSignal(c1);
  registry.registerSignal(c2);

  expect(registry.getDependents(s1.id)).toContain(c1.id);
  expect(registry.getDependents(c1.id)).toContain(c2.id);
});

test('action and handler definitions work similarly', () => {
  const count = defineSignal(0);
  const incLogic = createMockLogic('increment');
  const clickLogic = createMockLogic('click');
  const increment = defineAction(incLogic, [count]);
  const handleClick = defineHandler(clickLogic, [count]);

  const registry = new WeaverRegistry();
  registry.registerSignal(count);
  registry.registerSignal(incLogic);
  registry.registerSignal(clickLogic);
  registry.registerSignal(increment);
  registry.registerSignal(handleClick);

  expect(registry.getDependents(count.id)).toContain(increment.id);
  expect(registry.getDependents(count.id)).toContain(handleClick.id);
  expect(increment.logic).toBe(incLogic.id); // Stores logic ID reference
  expect(handleClick.logic).toBe(clickLogic.id);
});
```

**Deliverable**: Dependency graph infrastructure with bidirectional tracking, no logic execution.

---

## Milestone 3: Logic System & Signal Interfaces

**Goal**: Load logic modules and execute them with signal interface wrappers.

**Implementation Tasks**:
- Implement `loadLogic(logicSignal: LogicSignal)` using `await import(logicSignal.src)`
- Create signal interface wrappers that provide `.value` getter/setter accessing registry
- Implement `createReadOnlySignalInterface(registry, id)` - wrapper with readonly `.value`
- Implement `createWritableSignalInterface(registry, id)` - wrapper with writable `.value`
- Implement `executeComputed(registry, computedId)` - retrieves logic signal from registry via computed.logic ID, loads module, wraps deps as readonly, executes, caches result
- Implement `executeAction(registry, actionId)` - retrieves logic signal, loads module, wraps deps as writable, executes
- Implement `executeHandler(registry, handlerId, event)` - retrieves logic signal, loads module, passes event + writable deps, executes
- Store computed results in registry
- Defer reactivity propagation to M4 (manual execution only for now)

**Test Criteria**:
```typescript
test('logic module can be loaded', async () => {
  // tests/fixtures/double.ts: export default (count) => count.value * 2
  const doubleLogic: LogicSignal = {
    id: 'logic_double',
    kind: 'logic',
    src: './tests/fixtures/double.js'
  };
  const fn = await loadLogic(doubleLogic);

  expect(typeof fn).toBe('function');
});

test('computed executes logic and caches result', async () => {
  const count = defineSignal(5);
  const doubleLogic: LogicSignal = {
    id: 'logic_double',
    kind: 'logic',
    src: './tests/fixtures/double.js'
  };
  const doubled = defineComputed(doubleLogic, [count]);

  const registry = new WeaverRegistry();
  registry.registerSignal(count);
  registry.registerSignal(doubleLogic);
  registry.registerSignal(doubled);
  registry.setValue(count.id, 5);

  // executeComputed retrieves logic signal from registry using doubled.logic
  await executeComputed(registry, doubled.id);

  expect(registry.getValue(doubled.id)).toBe(10);
});

test('signal interface provides .value that accesses registry', () => {
  const count = defineSignal(5);
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
  const count = defineSignal(0);
  const incLogic: LogicSignal = {
    id: 'logic_increment',
    kind: 'logic',
    src: './tests/fixtures/increment.js'
  };
  const increment = defineAction(incLogic, [count]);

  const registry = new WeaverRegistry();
  registry.registerSignal(count);
  registry.registerSignal(incLogic);
  registry.registerSignal(increment);
  registry.setValue(count.id, 0);

  await executeAction(registry, increment.id);

  expect(registry.getValue(count.id)).toBe(1);
});

test('handler receives event and writable signal interfaces', async () => {
  // tests/fixtures/handleClick.ts: export default (event, count) => { count.value++ }
  const count = defineSignal(0);
  const clickLogic: LogicSignal = {
    id: 'logic_handleClick',
    kind: 'logic',
    src: './tests/fixtures/handleClick.js'
  };
  const handler = defineHandler(clickLogic, [count]);

  const registry = new WeaverRegistry();
  registry.registerSignal(count);
  registry.registerSignal(clickLogic);
  registry.registerSignal(handler);
  registry.setValue(count.id, 0);

  const mockEvent = new MouseEvent('click');
  await executeHandler(registry, handler.id, mockEvent);

  expect(registry.getValue(count.id)).toBe(1);
});

test('multiple signals can be passed to logic', async () => {
  // tests/fixtures/sum.ts: export default (a, b) => a.value + b.value
  const a = defineSignal(5);
  const b = defineSignal(10);
  const sumLogic: LogicSignal = {
    id: 'logic_sum',
    kind: 'logic',
    src: './tests/fixtures/sum.js'
  };
  const sum = defineComputed(sumLogic, [a, b]);

  const registry = new WeaverRegistry();
  registry.registerSignal(a);
  registry.registerSignal(b);
  registry.registerSignal(sumLogic);
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
  const count = defineSignal(5);
  const doubled = defineComputed({ src: './tests/fixtures/double.js' }, [count]);

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
  const count = defineSignal(2);
  const doubled = defineComputed({ src: './tests/fixtures/double.js' }, [count]);
  const quadrupled = defineComputed({ src: './tests/fixtures/double.js' }, [doubled]);

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
  const count = defineSignal(5);
  const doubled = defineComputed({ src: './tests/fixtures/double.js' }, [count]);
  const tripled = defineComputed({ src: './tests/fixtures/triple.js' }, [count]);

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
- Serialize LogicSignals separately with their own signal-definition
- Serialize computed/action/handler/component/node signals with logic ID references (string, not embedded object)

**Test Criteria**:
```typescript
test('signal serializes with bind markers and definition script', async () => {
  const count = defineSignal(5);
  const registry = new WeaverRegistry();
  registry.registerSignal(count);
  registry.setValue(count.id, 5);

  const weaver = new StreamWeaver({ root: <div>{count}</div>, registry });
  const html = (await Array.fromAsync(weaver.readable)).join('');

  expect(html).toContain('<!--^' + count.id + '-->5<!--/' + count.id + '-->');
  expect(html).toContain('<script>weaver.push({kind:"signal-definition",signal:{id:"' + count.id + '",kind:"state",init:5}})</script>');
});

test('attribute bindings serialize with data attributes', async () => {
  const theme = defineSignal('dark');
  const registry = new WeaverRegistry();
  registry.registerSignal(theme);
  registry.setValue(theme.id, 'dark');

  const weaver = new StreamWeaver({ root: <div className={theme}>Content</div>, registry });
  const html = (await Array.fromAsync(weaver.readable)).join('');

  expect(html).toContain('class="dark"');
  expect(html).toContain('data-w-classname="' + theme.id + '"');
});

test('handler bindings serialize with data attributes and logic', async () => {
  const count = defineSignal(0);
  const clickLogic: LogicSignal = {
    id: 'logic_click',
    kind: 'logic',
    src: './fixtures/click.js'
  };
  const handler = defineHandler(clickLogic, [count]);

  const registry = new WeaverRegistry();
  registry.registerSignal(count);
  registry.registerSignal(clickLogic);
  registry.registerSignal(handler);

  const weaver = new StreamWeaver({ root: <button onClick={handler}>Click</button>, registry });
  const html = (await Array.fromAsync(weaver.readable)).join('');

  expect(html).toContain('data-w-onclick="' + handler.id + '"');
  // Logic signal serialized separately
  expect(html).toContain('<script>weaver.push({kind:"signal-definition",signal:{id:"logic_click",kind:"logic",src:"./fixtures/click.js"}})</script>');
  // Handler references logic by ID
  expect(html).toContain('<script>weaver.push({kind:"signal-definition",signal:{id:"' + handler.id + '",kind:"handler",logic:"logic_click",deps:["' + count.id + '"]}})</script>');
});

test('computed definition serializes with logic reference', async () => {
  const count = defineSignal(5);
  const doubleLogic: LogicSignal = {
    id: 'logic_double',
    kind: 'logic',
    src: './fixtures/double.js'
  };
  const doubled = defineComputed(doubleLogic, [count]);

  const registry = new WeaverRegistry();
  registry.registerSignal(count);
  registry.registerSignal(doubleLogic);
  registry.registerSignal(doubled);
  registry.setValue(count.id, 5);

  await executeComputed(registry, doubled.id);

  const weaver = new StreamWeaver({ root: <div>{doubled}</div>, registry });
  const html = (await Array.fromAsync(weaver.readable)).join('');

  // Logic signal serialized separately
  expect(html).toContain('<script>weaver.push({kind:"signal-definition",signal:{id:"logic_double",kind:"logic",src:"./fixtures/double.js"}})</script>');
  // Computed references logic by ID
  expect(html).toContain('<script>weaver.push({kind:"signal-definition",signal:{id:"' + doubled.id + '",kind:"computed",logic:"logic_double",deps:["' + count.id + '"]}})</script>');
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
  const count = defineSignal(0);
  const handler = defineHandler({ src: './fixtures/click.js' }, [count]);

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
  const count1 = defineSignal(0);
  const count2 = defineSignal(0);
  const clickHandler = defineHandler({ src: './fixtures/increment.js' }, [count1]);
  const inputHandler = defineHandler({ src: './fixtures/increment.js' }, [count2]);

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
  const count = defineSignal(0);
  const handler = defineHandler({ src: './fixtures/increment.js' }, [count]);

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
- Implement `defineComponent(logic: Logic, props: Props): ComponentSignal`
- Implement content-addressable ID for components (hash logic + serialized props)
- Extract signal dependencies from props (signal objects → IDs)
- Register components in dependency graph when bound
- Update JSX factory to call `defineComponent` for function components
- Emit `signal-definition` tokens for components in ComponentDelegate
- Implement component re-rendering when prop signals change via SignalDelegate

**Test Criteria**:
```typescript
test('component definition is created with signal props', () => {
  const name = defineSignal('Alice');
  const Card = () => <div>{name}</div>;
  const card = defineComponent({ src: './fixtures/Card.js' }, { name, title: 'User' });

  expect(card.kind).toBe('component');
  expect(card.id).toMatch(/^c/);
  expect(card.props.name).toBe(name);
  expect(card.props.title).toBe('User');
});

test('component dependencies extracted from props', () => {
  const name = defineSignal('Alice');
  const age = defineSignal(30);
  const card = defineComponent({ src: './fixtures/Card.js' }, { name, age, role: 'Admin' });

  const registry = new WeaverRegistry();
  registry.registerSignal(name);
  registry.registerSignal(age);
  registry.registerSignal(card);

  expect(registry.getDependents(name.id)).toContain(card.id);
  expect(registry.getDependents(age.id)).toContain(card.id);
});

test('component serialization includes props and logic', async () => {
  const name = defineSignal('Alice');
  const Card = (props: { name: StateSignal<string>, title: string }) => <div>{props.name} - {props.title}</div>;
  const card = defineComponent({ src: './fixtures/Card.js' }, { name, title: 'User' });

  const registry = new WeaverRegistry();
  registry.registerSignal(name);
  registry.registerSignal(card);
  registry.setValue(name.id, 'Alice');

  const weaver = new StreamWeaver({ root: card, registry });
  const html = (await Array.fromAsync(weaver.readable)).join('');

  expect(html).toContain('<script>weaver.push({kind:"signal-definition",signal:{id:"' + card.id + '",kind:"component",logic:{src:"./fixtures/Card.js"},props:{name:"' + name.id + '",title:"User"}}})</script>');
});

test('component re-renders when prop signal changes', async () => {
  const name = defineSignal('Alice');
  const Card = (props: { name: StateSignal<string> }) => <div>{props.name}</div>;
  const card = defineComponent({ src: './fixtures/Card.js' }, { name });

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
  const count = defineSignal(0);
  const doubled = defineComputed({ src: './fixtures/double.js' }, [count]);
  const increment = defineHandler({ src: './fixtures/increment.js' }, [count]);

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

## Milestone 10: Build Plugin for Logic Transformation

**Goal**: Implement bundler plugin to transform `import("...")` expressions into LogicSignal references at build time.

**Implementation Tasks**:
- Create Vite/Rollup plugin that recognizes addressable logic patterns
- Implement AST traversal to find `import("...")` in:
  - `defineComputed(import("..."), deps)`
  - `defineAction(import("..."), deps)`
  - `defineHandler(import("..."), deps)`
  - `defineComponent(import("..."))`
  - `defineLogic(import("..."))`
- Generate stable, deterministic IDs for each unique module (hash of resolved path)
- **Primary strategy**: Inline rewrite - replace `import("...")` with LogicSignal object
- **Fallback strategy**: Metadata attachment - add `__logicId` to import expression for robustness
- Ensure modules are emitted to build output (add to bundle graph)
- Generate manifest mapping logic IDs → public URLs
- Provide manifest to server for SSR URL resolution

**Test Criteria**:
```typescript
test('plugin recognizes and transforms defineComputed pattern', async () => {
  const input = `
    const doubled = defineComputed(import("./double"), [count]);
  `;

  const result = await transformWithPlugin(input);

  expect(result.code).toContain('defineLogic');
  expect(result.code).toContain('id: "logic_');
  expect(result.code).toContain('src:');
  // Should create logic signal and pass it to defineComputed
});

test('plugin generates stable IDs for same module', async () => {
  const input1 = `const c1 = defineComputed(import("./double"), [x]);`;
  const input2 = `const c2 = defineComputed(import("./double"), [y]);`;

  const result1 = await transformWithPlugin(input1);
  const result2 = await transformWithPlugin(input2);

  // Extract logic IDs from both
  const id1 = extractLogicId(result1.code);
  const id2 = extractLogicId(result2.code);

  expect(id1).toBe(id2); // Same module → same ID
});

test('plugin generates manifest mapping IDs to URLs', async () => {
  const input = `
    const doubled = defineComputed(import("./double"), [count]);
    const tripled = defineComputed(import("./triple"), [count]);
  `;

  const { manifest } = await buildWithPlugin(input);

  expect(manifest).toHaveProperty('logic_double');
  expect(manifest).toHaveProperty('logic_triple');
  expect(manifest.logic_double.src).toMatch(/\/assets\/double-[a-z0-9]+\.js/);
  expect(manifest.logic_triple.src).toMatch(/\/assets\/triple-[a-z0-9]+\.js/);
});

test('plugin fallback attaches metadata to imports', async () => {
  const input = `
    const doubleFn = import("./double");
    const doubled = defineComputed(doubleFn, [count]);
  `;

  const result = await transformWithPlugin(input);

  // Should attach __logicId to import expression
  expect(result.code).toContain('__logicId');
});

test('plugin works with all addressable APIs', async () => {
  const input = `
    const doubled = defineComputed(import("./double"), [x]);
    const inc = defineAction(import("./inc"), [x]);
    const handler = defineHandler(import("./click"), [x]);
    const Card = defineComponent(import("./Card"));
  `;

  const result = await transformWithPlugin(input);

  // All should be transformed
  expect(result.code.match(/defineLogic/g).length).toBe(4);
});

test('manifest enables server URL resolution', async () => {
  const { manifest } = await buildWithPlugin(`
    const doubled = defineComputed(import("./double"), [count]);
  `);

  // Server can resolve logic ID to public URL
  const logicId = 'logic_double';
  const publicUrl = manifest[logicId].src;

  expect(publicUrl).toMatch(/^\/assets\//);
  expect(publicUrl).toMatch(/\.js$/);
});
```

**Deliverable**: Build plugin that transforms dynamic imports into LogicSignals with stable IDs and generates manifest for runtime resolution.

---

## Milestone 11: Async Logic

**Goal**: Enable logic functions to be asynchronous with proper await handling.

**Implementation Tasks**:
- Extract core logic execution into `executeLogic(registry, logicSignal, args): Promise<unknown>`
- Refactor `executeComputed`, `executeAction`, `executeHandler`, `executeNode` to use `executeLogic`
- Ensure logic execution awaits the result when it is a Promise
- Update `LogicFunction` type to allow `Promise<T>` return types
- Define `Serializable` type (JSON-compatible types) based on TypeFest's JsonValue:
  ```typescript
  type JsonPrimitive = string | number | boolean | null;
  type JsonObject = { [Key in string]: JsonValue };
  type JsonArray = JsonValue[] | readonly JsonValue[];
  type JsonValue = JsonPrimitive | JsonObject | JsonArray;

  // Alias for clarity in our API
  type Serializable = JsonValue;
  ```
- Update `defineSignal<T>` init type from `unknown` to `Serializable` (init is part of serialized definition)
- Update `defineComputed` init option type from `unknown` to `Serializable`
- Export `Serializable` type for use in `defineServerLogic` return type enforcement

**Test Criteria**:
```typescript
test('async computed logic resolves before storing value', async () => {
  // tests/fixtures/asyncDouble.ts: export default async (x) => { await delay(10); return x.value * 2; }
  const count = defineSignal(5);
  const asyncLogic: LogicSignal = {
    id: 'logic_asyncDouble',
    kind: 'logic',
    src: './tests/fixtures/asyncDouble.js'
  };
  const doubled = defineComputed(asyncLogic, [count]);

  const registry = new WeaverRegistry();
  registry.registerSignal(count);
  registry.registerSignal(asyncLogic);
  registry.registerSignal(doubled);
  registry.setValue(count.id, 5);

  await executeComputed(registry, doubled.id);

  // Value should be resolved, not a Promise
  expect(registry.getValue(doubled.id)).toBe(10);
});

test('async action completes before signal updates propagate', async () => {
  // tests/fixtures/asyncIncrement.ts: export default async (x) => { await delay(10); x.value++; }
  const count = defineSignal(0);
  const asyncLogic: LogicSignal = {
    id: 'logic_asyncInc',
    kind: 'logic',
    src: './tests/fixtures/asyncIncrement.js'
  };
  const increment = defineAction(asyncLogic, [count]);

  const registry = new WeaverRegistry();
  registry.registerSignal(count);
  registry.registerSignal(asyncLogic);
  registry.registerSignal(increment);
  registry.setValue(count.id, 0);

  await executeAction(registry, increment.id);

  expect(registry.getValue(count.id)).toBe(1);
});

test('defineSignal init must be Serializable', () => {
  // Valid: JSON-compatible types
  const s1 = defineSignal('hello');
  const s2 = defineSignal(42);
  const s3 = defineSignal(true);
  const s4 = defineSignal(null);
  const s5 = defineSignal({ name: 'Alice', age: 30 });
  const s6 = defineSignal([1, 2, 3]);
  const s7 = defineSignal({ nested: { array: [1, 'two', null] } });

  // TypeScript should error on non-serializable types:
  // const bad1 = defineSignal(() => {}); // Function
  // const bad2 = defineSignal(undefined); // undefined
  // const bad3 = defineSignal(Symbol()); // Symbol
  // const bad4 = defineSignal(new Map()); // Map
});

test('async handler awaits completion', async () => {
  // tests/fixtures/asyncHandler.ts: export default async (e, x) => { await delay(10); x.value = e.type; }
  const value = defineSignal('');
  const asyncLogic: LogicSignal = {
    id: 'logic_asyncHandler',
    kind: 'logic',
    src: './tests/fixtures/asyncHandler.js'
  };
  const handler = defineHandler(asyncLogic, [value]);

  const registry = new WeaverRegistry();
  registry.registerSignal(value);
  registry.registerSignal(asyncLogic);
  registry.registerSignal(handler);

  const mockEvent = new MouseEvent('click');
  await executeHandler(registry, handler.id, mockEvent);

  expect(registry.getValue(value.id)).toBe('click');
});
```

**Deliverable**: All logic execution properly awaits async functions with consolidated `executeLogic` function.

---

## Milestone 12: Deferred and Client Logic

**Goal**: Allow logic to execute without blocking the stream (via timeout) or only on client, using PENDING sentinel for pending state.

**Implementation Tasks**:
- Add `timeout?: number` option to `defineLogic`
  - `undefined` = no timeout, always inline (blocking)
  - `0` = always defer immediately (never block)
  - `> 0` = wait up to N ms, then defer if not complete
  - Note: `timeout` only affects async logic; sync functions execute immediately regardless
- Export `PENDING` symbol constant from stream-weaver
- Modify `executeLogic` to check `logicSignal.timeout`
- Implement Promise.race for timeout-based deferral
- When deferring: set value to `PENDING` (or `init` if specified), start execution, return immediately
- When deferred execution completes, push signal-update to main stream
- Update SignalDelegate to handle timeout-based deferred execution flow
- Add `MaybePending<T>` type helper
- Implement `defineClientLogic` function with `context: 'client'` flag
- When clientside on server: return `PENDING`/`init` immediately without loading module
- On client boot: detect and execute pending clientside signals

**Test Criteria**:
```typescript
import { PENDING } from 'stream-weaver';

test('timeout: 0 sets PENDING immediately', async () => {
  const count = defineSignal(5);
  const slowLogic = defineLogic({ src: './tests/fixtures/slowDouble.js' }, { timeout: 0 });
  const result = defineComputed(slowLogic, [count]);

  const registry = new WeaverRegistry();
  registry.registerSignal(count);
  registry.registerSignal(slowLogic);
  registry.registerSignal(result);
  registry.setValue(count.id, 5);

  // Start execution (don't await)
  const promise = executeComputed(registry, result.id);

  // Value should be PENDING immediately
  expect(registry.getValue(result.id)).toBe(PENDING);

  // After completion, value should be resolved
  await promise;
  expect(registry.getValue(result.id)).toBe(10);
});

test('timeout: 0 does not block stream', async () => {
  const count1 = defineSignal(5);
  const count2 = defineSignal(10);
  const slowLogic = defineLogic({ src: './tests/fixtures/slowDouble.js' }, { timeout: 0 });
  const fastLogic = defineLogic({ src: './tests/fixtures/double.js' });
  const slow = defineComputed(slowLogic, [count1]);
  const fast = defineComputed(fastLogic, [count2]);

  const registry = new WeaverRegistry();
  registry.registerSignal(count1);
  registry.registerSignal(count2);
  registry.registerSignal(slowLogic);
  registry.registerSignal(fastLogic);
  registry.registerSignal(slow);
  registry.registerSignal(fast);

  const delegate = new SignalDelegate(registry);
  const writer = delegate.writable.getWriter();

  const updates: string[] = [];
  (async () => {
    for await (const token of delegate.readable) {
      if (token.kind === 'signal-update') {
        updates.push(token.id);
      }
    }
  })();

  // Trigger both updates
  await writer.write({ kind: 'signal-update', id: count1.id, value: 5 });
  await writer.write({ kind: 'signal-update', id: count2.id, value: 10 });
  await writer.close();

  // Fast should complete before slow (timeout: 0 doesn't block)
  expect(updates.indexOf(fast.id)).toBeLessThan(updates.indexOf(slow.id));
});

test('timeout races execution against timer', async () => {
  const count = defineSignal(5);
  // Logic that takes 100ms
  const slowLogic = defineLogic({ src: './tests/fixtures/slow100ms.js' }, { timeout: 50 });
  const result = defineComputed(slowLogic, [count]);

  const registry = new WeaverRegistry();
  registry.registerSignal(count);
  registry.registerSignal(slowLogic);
  registry.registerSignal(result);
  registry.setValue(count.id, 5);

  const promise = executeComputed(registry, result.id);

  // Should be PENDING after 50ms timeout
  expect(registry.getValue(result.id)).toBe(PENDING);

  // After full completion, value should be resolved
  await promise;
  expect(registry.getValue(result.id)).toBe(10);
});

test('fast logic completes inline when within timeout', async () => {
  const count = defineSignal(5);
  // Logic that takes 10ms, timeout is 50ms
  const fastLogic = defineLogic({ src: './tests/fixtures/fast10ms.js' }, { timeout: 50 });
  const result = defineComputed(fastLogic, [count]);

  const registry = new WeaverRegistry();
  registry.registerSignal(count);
  registry.registerSignal(fastLogic);
  registry.registerSignal(result);
  registry.setValue(count.id, 5);

  await executeComputed(registry, result.id);

  // Should have completed inline (not PENDING)
  expect(registry.getValue(result.id)).toBe(10);
});

test('PENDING is a unique symbol', () => {
  expect(typeof PENDING).toBe('symbol');
  expect(PENDING).not.toBe(Symbol('PENDING')); // Unique instance
});

test('defineClientLogic sets context to client', () => {
  const viewportLogic = defineClientLogic(import('./getViewport'));

  expect(viewportLogic.context).toBe('client');
  expect(viewportLogic.kind).toBe('logic');
});

test('clientside logic returns PENDING on server', async () => {
  // Mock isServer() to return true
  const viewportLogic = defineClientLogic(import('./getViewport'));
  const viewport = defineComputed(viewportLogic, []);

  const registry = new WeaverRegistry();
  registry.registerSignal(viewportLogic);
  registry.registerSignal(viewport);

  await executeComputed(registry, viewport.id);

  // Should be PENDING, not executed
  expect(registry.getValue(viewport.id)).toBe(PENDING);
});

test('clientside logic uses init value on server when provided', async () => {
  const viewportLogic = defineClientLogic(import('./getViewport'));
  const viewport = defineComputed(viewportLogic, [], { init: { width: 1024, height: 768 } });

  const registry = new WeaverRegistry();
  registry.registerSignal(viewportLogic);
  registry.registerSignal(viewport);

  await executeComputed(registry, viewport.id);

  // Should use init value
  expect(registry.getValue(viewport.id)).toEqual({ width: 1024, height: 768 });
});

test('clientside logic executes on client', async () => {
  // Mock isServer() to return false
  const viewportLogic = defineClientLogic(import('./getViewport'));
  const viewport = defineComputed(viewportLogic, []);

  const registry = new WeaverRegistry();
  registry.registerSignal(viewportLogic);
  registry.registerSignal(viewport);

  await executeComputed(registry, viewport.id);

  // Should have actual value from logic execution
  expect(registry.getValue(viewport.id)).toEqual({
    width: expect.any(Number),
    height: expect.any(Number)
  });
});
```

**Deliverable**: Deferred and client logic execution with PENDING sentinel that handles execution timing appropriately.

---

## Milestone 13: Serverside Logic

**Goal**: Enable logic that executes only on the server with automatic client-server communication.

**Implementation Tasks**:
- Create `defineServerLogic<F>` function that enforces `Serializable` return type (using type from M11)
- Use `context: 'server'` flag on LogicSignal (using existing `context` union type)
- Implement `executeRemote(registry, signalId)` for client-side remote execution
- Build signal chain serializer that walks dependency graph
- Implement chain serialization optimization (prune at serializable values)
- Create `/weaver/execute` server endpoint
- Server endpoint: rebuild registry from chain, execute logic, return result
- Modify `executeLogic` to detect `context: 'server'` and call `executeRemote` on client
- Ensure server logic modules are excluded from client bundle (build plugin)

**Test Criteria**:
```typescript
test('defineServerLogic sets context to server', () => {
  const dbLogic = defineServerLogic(import('./serverLogic/query'));

  expect(dbLogic.context).toBe('server');
  expect(dbLogic.kind).toBe('logic');
});

test('signal chain serializer walks dependency graph', () => {
  const userId = defineSignal('user123');
  const formatted = defineComputed(formatLogic, [userId]);
  const result = defineComputed(serversideLogic, [formatted]);

  const registry = new WeaverRegistry();
  registry.registerSignal(userId);
  registry.registerSignal(formatLogic);
  registry.registerSignal(formatted);
  registry.registerSignal(serversideLogic);
  registry.registerSignal(result);

  const chain = serializeSignalChain(registry, result.id);

  // Chain includes all dependencies
  expect(chain.signals).toHaveProperty(userId.id);
  expect(chain.signals).toHaveProperty(formatted.id);
  expect(chain.signals).toHaveProperty(formatLogic.id);
  expect(chain.values).toHaveProperty(userId.id);
  expect(chain.values[userId.id]).toBe('user123');
});

test('chain serialization prunes at serializable computed values', () => {
  const a = defineSignal(5);
  const b = defineComputed(doubleLogic, [a]); // Returns number (serializable)
  const c = defineComputed(serversideLogic, [b]);

  const registry = new WeaverRegistry();
  // ... register all ...
  registry.setValue(b.id, 10); // Computed has serializable value

  const chain = serializeSignalChain(registry, c.id);

  // b's value is serializable, so a and doubleLogic can be pruned
  expect(chain.signals).not.toHaveProperty(a.id);
  expect(chain.values).toHaveProperty(b.id);
  expect(chain.values[b.id]).toBe(10);
});

test('server endpoint executes logic and returns result', async () => {
  const response = await fetch('/weaver/execute', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      signalId: 'c1',
      chain: {
        signals: {
          's1': { id: 's1', kind: 'state', init: '' },
          'logic_db': { id: 'logic_db', kind: 'logic', src: './db-query.js', context: 'server' },
          'c1': { id: 'c1', kind: 'computed', logic: 'logic_db', deps: ['s1'] }
        },
        values: { 's1': 'user123' }
      }
    })
  });

  const result = await response.json();
  expect(result.id).toBe('c1');
  expect(result.value).toEqual({ name: 'Alice' }); // From DB
});

test('executeLogic calls executeRemote for server logic on client', async () => {
  // Mock isClient() to return true
  const dbLogic = defineServerLogic(import('./serverLogic/query'));
  const result = defineComputed(dbLogic, [userId]);

  const registry = new WeaverRegistry();
  // ... setup ...

  // Should make fetch request, not load module
  await executeComputed(registry, result.id);

  expect(fetchMock).toHaveBeenCalledWith('/weaver/execute', expect.any(Object));
});
```

**Deliverable**: Serverside logic execution with automatic chain serialization and server endpoint.

---

## Milestone 14: Suspense Component

**Goal**: Provide a built-in Suspense component for showing fallback content while pending logic resolves.

**Implementation Tasks**:
- Create Suspense component logic module
- Register Suspense as a built-in component
- Suspense checks `child.value === PENDING` and returns fallback or child
- Ensure Suspense re-renders when child signal updates (standard reactivity)
- Export Suspense component from stream-weaver package

**Test Criteria**:
```typescript
test('Suspense shows fallback when child is PENDING', async () => {
  const slowLogic = defineLogic(import('./slowComponent'), { timeout: 0 });
  const SlowComponent = defineComponent(slowLogic);
  const slowNode = defineNode(SlowComponent, {});

  const registry = new WeaverRegistry();
  registry.registerSignal(slowLogic);
  registry.registerSignal(SlowComponent);
  registry.registerSignal(slowNode);
  registry.setValue(slowNode.id, PENDING);

  const fallback = <div class="loading">Loading...</div>;
  const suspenseNode = defineNode(Suspense, { child: slowNode, fallback });

  registry.registerSignal(suspenseNode);
  const result = await executeNode(registry, suspenseNode.id);

  // Should render fallback
  expect(result).toEqual(fallback);
});

test('Suspense shows child when resolved', async () => {
  const slowNode = defineSignal(null); // Simulate resolved node
  const childContent = <div class="content">Loaded!</div>;

  const registry = new WeaverRegistry();
  registry.registerSignal(slowNode);
  registry.setValue(slowNode.id, childContent);

  const fallback = <div class="loading">Loading...</div>;
  const suspenseNode = defineNode(Suspense, { child: slowNode, fallback });

  registry.registerSignal(suspenseNode);
  const result = await executeNode(registry, suspenseNode.id);

  // Should render child content
  expect(result).toEqual(childContent);
});

test('Suspense re-renders when child transitions from PENDING to resolved', async () => {
  const slowLogic = defineLogic(import('./slowComponent'), { timeout: 0 });
  const SlowComponent = defineComponent(slowLogic);
  const slowNode = defineNode(SlowComponent, {});

  const registry = new WeaverRegistry();
  // ... register all ...
  registry.setValue(slowNode.id, PENDING);

  const fallback = <div>Loading...</div>;
  const suspenseNode = defineNode(Suspense, { child: slowNode, fallback });
  registry.registerSignal(suspenseNode);

  // Initial render shows fallback
  let result = await executeNode(registry, suspenseNode.id);
  expect(result).toEqual(fallback);

  // Simulate child resolving
  const resolvedContent = <div>Content!</div>;
  registry.setValue(slowNode.id, resolvedContent);

  // Re-render shows content
  result = await executeNode(registry, suspenseNode.id);
  expect(result).toEqual(resolvedContent);
});

test('Suspense integrates with SignalDelegate for reactive updates', async () => {
  // Full integration test with deferred logic triggering Suspense swap
  const slowLogic = defineLogic(import('./slowComponent'), { timeout: 0 });
  const SlowComponent = defineComponent(slowLogic);
  const slowNode = defineNode(SlowComponent, {});

  const registry = new WeaverRegistry();
  // ... full setup ...

  const delegate = new SignalDelegate(registry);

  // Track DOM updates
  const updates: Array<{ id: string; value: unknown }> = [];
  // ... consume delegate.readable ...

  // Trigger slow node execution
  // ... should see suspenseNode update twice: once with fallback bind, once with content
});
```

**Deliverable**: Built-in Suspense component that shows fallback during PENDING state.

---

## Milestone 15: Reducer Signals

**Goal**: Provide a convenient way to reduce async iterables (including ReadableStream, AsyncGenerator, etc.) into reactive signal values.

**Implementation Tasks**:
- Define `ReducerSignal` interface with `source`, `reducer`, and `init` fields
- Implement `defineReducer(sourceSignal, reducerLogic, init)` function
- Implement iterable consumption in `executeReducer` using `for await...of`
- On each item: apply reducer, update registry, emit signal-update
- Handle iteration completion and errors
- Support both async and sync iterables
- Reducers are typically client-only for incremental updates (SSR emits init value)

**Test Criteria**:
```typescript
test('defineReducer creates a ReducerSignal', () => {
  const wsLogic = defineLogic(import('./websocket'));
  const wsStream = defineComputed(wsLogic, [channel]);
  const appendLogic = defineLogic(import('./append'));

  const messages = defineReducer(wsStream, appendLogic, []);

  expect(messages.kind).toBe('reducer');
  expect(messages.source).toBe(wsStream.id);
  expect(messages.reducer).toBe(appendLogic.id);
  expect(messages.init).toEqual([]);
});

test('reducer signal accumulates values via reducer', async () => {
  // Create a mock ReadableStream
  const mockStream = new ReadableStream({
    start(controller) {
      controller.enqueue({ id: 1, text: 'Hello' });
      controller.enqueue({ id: 2, text: 'World' });
      controller.close();
    }
  });

  const sourceSignal = defineSignal(mockStream);
  const appendLogic = defineLogic(import('./append'));
  const messages = defineReducer(sourceSignal, appendLogic, []);

  const registry = new WeaverRegistry();
  registry.registerSignal(sourceSignal);
  registry.registerSignal(appendLogic);
  registry.registerSignal(messages);
  registry.setValue(sourceSignal.id, mockStream);

  await executeReducer(registry, messages.id);

  const value = registry.getValue(messages.id);
  expect(value).toEqual([
    { id: 1, text: 'Hello' },
    { id: 2, text: 'World' }
  ]);
});

test('reducer signal with latest reducer keeps only last value', async () => {
  const mockStream = new ReadableStream({
    start(controller) {
      controller.enqueue(1);
      controller.enqueue(2);
      controller.enqueue(3);
      controller.close();
    }
  });

  const sourceSignal = defineSignal(mockStream);
  const latestLogic = defineLogic(import('./latest')); // (_, item) => item
  const current = defineReducer(sourceSignal, latestLogic, null);

  const registry = new WeaverRegistry();
  // ... register all ...

  await executeReducer(registry, current.id);

  expect(registry.getValue(current.id)).toBe(3);
});

test('reducer signal emits signal-update for each item', async () => {
  const mockStream = new ReadableStream({
    start(controller) {
      controller.enqueue('a');
      controller.enqueue('b');
      controller.close();
    }
  });

  const sourceSignal = defineSignal(mockStream);
  const appendLogic = defineLogic(import('./append'));
  const items = defineReducer(sourceSignal, appendLogic, []);

  const registry = new WeaverRegistry();
  // ... register all ...

  const delegate = new SignalDelegate(registry);
  const updates: unknown[] = [];

  (async () => {
    for await (const token of delegate.readable) {
      if (token.kind === 'signal-update' && token.id === items.id) {
        updates.push(token.value);
      }
    }
  })();

  await executeReducer(registry, items.id);

  // Should have emitted update for each item
  expect(updates).toEqual([
    ['a'],
    ['a', 'b']
  ]);
});

test('reducer signal handles iteration errors', async () => {
  const errorStream = new ReadableStream({
    start(controller) {
      controller.enqueue('ok');
      controller.error(new Error('Stream failed'));
    }
  });

  const sourceSignal = defineSignal(errorStream);
  const appendLogic = defineLogic(import('./append'));
  const items = defineReducer(sourceSignal, appendLogic, []);

  const registry = new WeaverRegistry();
  // ... register all ...

  await expect(executeReducer(registry, items.id)).rejects.toThrow('Stream failed');
});
```

**Deliverable**: Reducer signals that reduce async iterable items into reactive signal values.

---

## Milestone 16: Worker Logic

**Goal**: Enable CPU-intensive logic to execute in worker threads across all runtimes (browser, Bun, Node.js), keeping the main thread responsive.

**Isomorphic Support**:
- **Browser**: Web Workers API
- **Bun**: Web Workers API (same as browser)
- **Node.js**: `worker_threads` module

**Key Insight**: The existing logic module system already works for workers. Logic modules are ES modules that workers can import directly. Browser and Bun use `src` URLs, Node uses `ssrSrc` paths. No special bundling needed.

**Implementation Tasks**:
- Add `'worker'` to the `context` type in `LogicSignal` interface
- Implement `defineWorkerLogic(mod)` factory function (wrapper around `defineLogic` with `context: 'worker'`)
- Create single isomorphic worker script using Web Worker API
- Implement `WorkerPool` class using `web-worker` npm package
- Implement `executeInWorker(src, args)` function for message passing
- Modify `executeComputed` to detect worker context and route to worker pool

**Worker Pool Design**:
```typescript
class WorkerPool {
  private workers: Worker[] = [];
  private available: Worker[] = [];
  private pending: Array<{ resolve, reject, src, args }> = [];
  private maxWorkers: number;

  constructor(maxWorkers = navigator?.hardwareConcurrency || 4) {}

  // Use web-worker package for isomorphic Worker API
  private async createWorker(): Promise<Worker> {
    const WebWorker = (await import("web-worker")).default;
    return new WebWorker('./worker.js', { type: 'module' });
  }

  async execute(src: string, args: unknown[]): Promise<unknown> {
    const worker = this.acquire();
    return new Promise((resolve, reject) => {
      worker.onmessage = ({ data }) => {
        this.release(worker);
        if (data.error) reject(new Error(data.error));
        else resolve(data.result);
      };
      worker.postMessage({ src, args });
    });
  }

  private acquire(): Worker { /* get or create worker */ }
  private release(worker: Worker): void { /* return to pool */ }
}
```

**Worker Script**:
```typescript
// src/worker/worker.ts - Isomorphic (Browser, Node.js, Bun via web-worker package)
self.onmessage = async ({ data: { src, args } }) => {
  try {
    const mod = await import(src);
    const result = await mod.default(...args);
    self.postMessage({ result });
  } catch (error) {
    self.postMessage({ error: error.message });
  }
};
```

**Test Criteria**:
```typescript
test('defineWorkerLogic creates logic signal with worker context', () => {
  const logic = defineWorkerLogic(import('./heavyCompute'));

  expect(logic.kind).toBe('logic');
  expect(logic.context).toBe('worker');
});

test('worker logic executes in worker thread', async () => {
  // Create a logic that returns thread info
  const logic = defineWorkerLogic(import('./fixtures/threadInfo'));
  const computed = defineComputed(logic, []);

  const registry = new WeaverRegistry();
  registry.registerSignal(logic);
  registry.registerSignal(computed);

  await executeComputed(registry, computed.id);

  const result = registry.getValue(computed.id);
  // Worker self !== window (browser) or isMainThread === false (Node)
  expect(result.isWorker).toBe(true);
});

test('worker pool reuses workers', async () => {
  const pool = new WorkerPool(2);

  // Execute multiple tasks
  const results = await Promise.all([
    pool.execute('/src/logic/compute.js', [1]),
    pool.execute('/src/logic/compute.js', [2]),
    pool.execute('/src/logic/compute.js', [3]),
  ]);

  expect(results).toHaveLength(3);
  // Pool should have created at most 2 workers
  expect(pool.workerCount).toBeLessThanOrEqual(2);
});

test('worker logic handles errors', async () => {
  const logic = defineWorkerLogic(import('./fixtures/throwError'));
  const computed = defineComputed(logic, []);

  const registry = new WeaverRegistry();
  registry.registerSignal(logic);
  registry.registerSignal(computed);

  await expect(executeComputed(registry, computed.id))
    .rejects.toThrow('Intentional error');
});

test('worker logic with deferred timeout', async () => {
  // Worker logic can also use timeout for smart deferral
  const logic = defineWorkerLogic(import('./fixtures/slowCompute'), { timeout: 0 });
  const computed = defineComputed(logic, [], { init: 'loading' });

  const registry = new WeaverRegistry();
  registry.registerSignal(logic);
  registry.registerSignal(computed);

  // Initial execution returns init value
  await executeComputed(registry, computed.id);
  expect(registry.getValue(computed.id)).toBe('loading');

  // After worker completes, value updates
  await new Promise(r => setTimeout(r, 100));
  expect(registry.getValue(computed.id)).not.toBe('loading');
});
```

**Demo**:
```typescript
// demo/src/pages/WorkerDemo.tsx
import { defineWorkerLogic, defineComputed, defineSignal } from "stream-weaver";

// CPU-intensive Fibonacci calculation - works on browser, Bun, and Node
const fibLogic = defineWorkerLogic(import("../logic/fibonacci"));
const n = defineSignal(40);
const result = defineComputed(fibLogic, [n], { init: "Calculating..." });

export function WorkerExample() {
  return (
    <div>
      <h1>Worker Logic Demo</h1>
      <p>Fibonacci({n}) = {result}</p>
      <p>Main thread stays responsive during calculation</p>
      <p>Works on browser, Bun, and Node.js</p>
    </div>
  );
}
```

**Deliverable**: Isomorphic worker logic that executes CPU-intensive operations in worker threads (Web Workers for browser/Bun, worker_threads for Node.js) without blocking the main thread.

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
  ↓
M10 (Build Plugin)
  ↓
M11 (Async Logic)
  ↓
M12 (Deferred Logic) ──→ M14 (Suspense)
  ↓
M13 (Serverside Logic)

M11 (Async Logic)
  ↓
M15 (Stream Signals)
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
| M10 | High | High | AST transformation, manifest generation, build system integration |
| M11 | Low | Low | Extract executeLogic, add await |
| M12 | Medium | Medium | PENDING sentinel, timeout-based deferral + clientside execution |
| M13 | High | High | Chain serialization, server endpoint, client-server protocol |
| M14 | Low | Low | Built-in component using existing primitives |
| M15 | Medium | Medium | Stream subscription, repeated signal updates |

### Review Points

After each milestone, review:
- ✅ All tests pass
- ✅ Implementation matches API.md interfaces
- ✅ No regressions in previous milestones
- ✅ Code is clear and maintainable
- ✅ M1-M2: Pure infrastructure (no execution)
- ✅ M3+: Logic execution and integration

The agent should stop and request review before proceeding to the next milestone.
