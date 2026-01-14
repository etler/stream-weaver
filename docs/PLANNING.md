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

**Goal**: Implement the basic signal primitive with registry storage.

**Implementation Tasks**:
- Create `Signal` interface and `StateSignal<T>` type
- Implement `createSignal<T>(init: T): StateSignal<T>`
- Implement counter-based ID allocation (`s1`, `s2`, ...)
- Create `WeaverRegistry` class with `Map<string, any>` for storing values
- Implement `.value` getter/setter that reads/writes to registry

**Test Criteria**:
```typescript
test('signal creation and value access', () => {
  const count = createSignal(0);
  expect(count.id).toBe('s1');
  expect(count.init).toBe(0);
  expect(count.value).toBe(0); // Reads from registry

  count.value = 5; // Writes to registry
  expect(count.value).toBe(5);
});

test('multiple signals have unique IDs', () => {
  const s1 = createSignal(1);
  const s2 = createSignal(2);
  expect(s1.id).toBe('s1');
  expect(s2.id).toBe('s2');
});

test('registry stores signal values', () => {
  const count = createSignal(10);
  const registry = getGlobalRegistry();

  expect(registry.get('s1')).toBe(10);

  count.value = 20;
  expect(registry.get('s1')).toBe(20);
});
```

**Deliverable**: Basic signal objects that store values in a registry.

---

## Milestone 2: Dependency Graph

**Goal**: Track dependencies between signals without execution.

**Implementation Tasks**:
- Add `ComputedSignal`, `ActionSignal`, `HandlerSignal` interfaces (just metadata, no logic execution yet)
- Implement content-addressable ID hashing (hash signature → ID)
- Implement `createComputedDef(deps: Signal[]): ComputedSignal` (registers dependency metadata only)
- Implement `createActionDef(deps: Signal[]): ActionSignal`
- Implement `createHandlerDef(deps: Signal[]): HandlerSignal`
- Build dependency graph: `dependencies: Map<string, Set<string>>`
- Track which signals are dependencies of which computeds/actions

**Test Criteria**:
```typescript
test('computed definition registers dependencies', () => {
  const count = createSignal(5);
  const doubled = createComputedDef([count]); // No logic yet

  const registry = getGlobalRegistry();
  const dependents = registry.getDependents('s1');

  expect(dependents).toContain(doubled.id);
});

test('same deps produce same ID', () => {
  const count = createSignal(5);
  const c1 = createComputedDef([count]);
  const c2 = createComputedDef([count]);

  expect(c1.id).toBe(c2.id);
});

test('dependency graph tracks multiple levels', () => {
  const s1 = createSignal(1);
  const c1 = createComputedDef([s1]);
  const c2 = createComputedDef([c1]);

  const registry = getGlobalRegistry();
  expect(registry.getDependents('s1')).toContain(c1.id);
  expect(registry.getDependents(c1.id)).toContain(c2.id);
});
```

**Deliverable**: Dependency graph infrastructure without execution.

---

## Milestone 3: Reactivity Propagation

**Goal**: Make signal updates traverse the dependency graph and emit update events.

**Implementation Tasks**:
- Implement signal setter that emits `signal-update` event
- Implement `propagateUpdate(signalId: string)` that traverses dependency graph
- Emit update events for all dependents (recursively)
- Add event listener system for observing propagation
- No actual execution yet - just event emission

**Test Criteria**:
```typescript
test('signal update propagates to dependents', () => {
  const count = createSignal(5);
  const doubled = createComputedDef([count]);

  const events = [];
  registry.on('update', (id) => events.push(id));

  count.value = 10; // Triggers propagation

  expect(events).toContain('s1'); // Signal itself
  expect(events).toContain(doubled.id); // Dependent notified
});

test('cascading updates propagate through graph', () => {
  const count = createSignal(2);
  const doubled = createComputedDef([count]);
  const quadrupled = createComputedDef([doubled]);

  const events = [];
  registry.on('update', (id) => events.push(id));

  count.value = 3;

  expect(events).toEqual(['s1', doubled.id, quadrupled.id]);
});

test('multiple dependents all notified', () => {
  const count = createSignal(5);
  const doubled = createComputedDef([count]);
  const tripled = createComputedDef([count]);

  const events = [];
  registry.on('update', (id) => events.push(id));

  count.value = 10;

  expect(events).toContain(doubled.id);
  expect(events).toContain(tripled.id);
});
```

**Deliverable**: Event-based reactivity propagation without execution.

---

## Milestone 4: Server Bind Markers

**Goal**: Serialize signals and bindings to HTML without logic execution.

**Implementation Tasks**:
- Implement bind marker generation (`<!--^s1-->`, `<!--/s1-->`)
- Implement `signal-definition` event emission in ComponentDelegate
- Create inline script serialization (`<script>weaver.push(...)</script>`)
- Implement attribute binding serialization (`data-w-classname="s1"`)
- Implement event handler serialization (`data-w-onclick="h1"`)
- Update ComponentSerializer to handle bindings in token-open events

**Test Criteria**:
```typescript
test('signal serializes with bind markers', async () => {
  const count = createSignal(5);
  const html = await renderToString(<div>{count}</div>);

  expect(html).toContain('<!--^s1-->5<!--/s1-->');
  expect(html).toContain('<script>weaver.push({kind:"signal-definition",signal:{id:"s1",kind:"state",init:5}})</script>');
});

test('attribute bindings serialize with data attributes', async () => {
  const theme = createSignal('dark');
  const html = await renderToString(<div className={theme}>Content</div>);

  expect(html).toContain('class="dark"');
  expect(html).toContain('data-w-classname="s1"');
});

test('handler bindings serialize with data attributes', async () => {
  const handler = createHandlerDef([]);
  const html = await renderToString(<button onClick={handler}>Click</button>);

  expect(html).toContain('data-w-onclick="h1"');
  expect(html).toContain('<script>weaver.push({kind:"signal-definition",signal:{id:"h1",kind:"handler",deps:[]}})');
});

test('computed definition serializes', async () => {
  const count = createSignal(5);
  const doubled = createComputedDef([count]);
  const html = await renderToString(<div>{doubled}</div>);

  expect(html).toContain('<script>weaver.push({kind:"signal-definition",signal:{id:"c1",kind:"computed",deps:["s1"]}})</script>');
});
```

**Deliverable**: Complete server-side HTML serialization with bind markers and metadata.

---

## Milestone 5: Client Sink

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

## Milestone 6: Event Delegation Infrastructure

**Goal**: Wire up event listeners and handler lookup without execution.

**Implementation Tasks**:
- Implement global event listeners (click, submit, input, etc.)
- Implement event delegation via `data-w-{eventname}` lookup
- Implement handler registry lookup by ID
- Emit "handler-triggered" event when handler is found (but don't execute yet)
- Track which handler IDs are triggered

**Test Criteria**:
```typescript
test('event delegation finds handler ID', () => {
  document.body.innerHTML = '<button data-w-onclick="h1">Click</button>';

  const events = [];
  registry.on('handler-triggered', (id, event) => events.push(id));

  const button = document.querySelector('button');
  button.click();

  expect(events).toContain('h1');
});

test('multiple event types work', () => {
  document.body.innerHTML = `
    <button data-w-onclick="h1">Click</button>
    <form data-w-onsubmit="h2"><button type="submit">Submit</button></form>
    <input data-w-oninput="h3" />
  `;

  const events = [];
  registry.on('handler-triggered', (id) => events.push(id));

  document.querySelector('button').click();
  expect(events).toContain('h1');

  document.querySelector('input').dispatchEvent(new Event('input'));
  expect(events).toContain('h3');
});

test('event delegation bubbles to parent', () => {
  document.body.innerHTML = '<div data-w-onclick="h1"><button>Nested</button></div>';

  const events = [];
  registry.on('handler-triggered', (id) => events.push(id));

  document.querySelector('button').click();
  expect(events).toContain('h1'); // Parent handler triggered
});
```

**Deliverable**: Event delegation infrastructure that identifies handlers without executing them.

---

## Milestone 7: Logic System & Source Phase Imports

**Goal**: Implement module references and dynamic loading.

**Implementation Tasks**:
- Create `Logic` interface (`{ url: string, key?: string }`)
- Implement source phase import polyfill (transform to `{ url: string }`)
- Create Vite plugin for `import source` → `import ... from '...?url'`
- Implement dynamic `import(logic.url)` loader
- Implement module execution helper that loads and calls function
- Test with direct function references first, then migrate to module URLs

**Test Criteria**:
```typescript
test('logic module can be loaded', async () => {
  const logic: Logic = { url: '/test/double.js' };
  const module = await loadLogic(logic);

  expect(typeof module.default).toBe('function');
});

test('source phase import polyfill', () => {
  // In source:
  // import source doubleSrc from './logic/double';

  // After transform:
  // import doubleUrl from './logic/double?url';
  // const doubleSrc = { url: doubleUrl };

  const doubleSrc = { url: '/assets/double-abc123.js' };
  expect(doubleSrc.url).toMatch(/\.js$/);
});

test('logic execution with signal arguments', async () => {
  const count = createSignal(5);
  const logic: Logic = { url: '/test/double.js' };

  const result = await executeLogic(logic, [count]);
  expect(result).toBe(10);
});
```

**Deliverable**: Module loading system with source phase import support.

---

## Milestone 8: Computed Signals with Execution

**Goal**: Add logic execution to computed signals.

**Implementation Tasks**:
- Update `createComputed(logic: Logic, deps: Signal[]): ComputedSignal`
- Implement computed execution: load module, call with ReadOnly signals, cache result
- Connect execution to reactivity propagation (when update event fires, execute)
- Implement `ReadOnly<T>` wrapper (TypeScript-only, runtime same object)
- Update registry to cache computed results

**Test Criteria**:
```typescript
test('computed executes logic and caches result', async () => {
  const count = createSignal(5);
  const doubled = createComputed(doubleSrc, [count]);

  // Initially undefined until executed
  await weaver.executeComputed(doubled.id);
  expect(doubled.value).toBe(10);
});

test('computed automatically re-executes on dependency change', async () => {
  const count = createSignal(5);
  const doubled = createComputed(doubleSrc, [count]);

  await weaver.executeComputed(doubled.id);
  expect(doubled.value).toBe(10);

  count.value = 7;
  await waitForExecution();
  expect(doubled.value).toBe(14);
});

test('computed receives readonly signals', async () => {
  const logic = (count: ReadOnly<StateSignal<number>>) => {
    // TypeScript compile check:
    // count.value = 10; // ❌ Error
    return count.value * 2; // ✅ OK
  };

  const count = createSignal(5);
  const doubled = createComputed(logic, [count]);

  await weaver.executeComputed(doubled.id);
  expect(doubled.value).toBe(10);
});

test('cascading computed updates', async () => {
  const count = createSignal(2);
  const doubled = createComputed(doubleSrc, [count]);
  const quadrupled = createComputed(doubleSrc, [doubled]);

  await weaver.executeComputed(doubled.id);
  await weaver.executeComputed(quadrupled.id);

  count.value = 3;
  await waitForExecution();

  expect(doubled.value).toBe(6);
  expect(quadrupled.value).toBe(12);
});
```

**Deliverable**: Computed signals with full logic execution and reactivity.

---

## Milestone 9: Actions and Handlers with Execution

**Goal**: Execute actions and handlers with mutation capability.

**Implementation Tasks**:
- Update `createAction(logic: Logic, deps: Signal[]): ActionSignal`
- Update `createHandler(logic: Logic, deps: Signal[]): HandlerSignal`
- Implement action execution: load module, call with writable signals
- Implement handler execution: load module, call with event + writable signals
- Connect handlers to event delegation (execute when triggered)
- Ensure actions receive writable `StateSignal<T>` objects

**Test Criteria**:
```typescript
test('action can mutate signals', async () => {
  const count = createSignal(0);
  const increment = createAction(incrementSrc, [count]);

  await weaver.executeAction(increment.id);
  expect(count.value).toBe(1);
});

test('handler receives event and signals', async () => {
  const count = createSignal(0);
  const handler = createHandler(incrementSrc, [count]);

  const mockEvent = new MouseEvent('click');
  await weaver.executeHandler(handler.id, mockEvent);

  expect(count.value).toBe(1);
});

test('action execution triggers reactivity', async () => {
  const count = createSignal(0);
  const doubled = createComputed(doubleSrc, [count]);
  const increment = createAction(incrementSrc, [count]);

  await weaver.executeComputed(doubled.id);
  expect(doubled.value).toBe(0);

  await weaver.executeAction(increment.id);
  await waitForExecution();

  expect(count.value).toBe(1);
  expect(doubled.value).toBe(2);
});

test('handler execution via click event', async () => {
  document.body.innerHTML = `
    <script>
      weaver.push({kind:'signal-definition',signal:{id:'s1',init:0}});
      weaver.push({kind:'signal-definition',signal:{id:'h1',kind:'handler',logic:{url:'/increment.js'},deps:['s1']}});
    </script>
    <div><!--^s1-->0<!--/s1--></div>
    <button data-w-onclick="h1">+1</button>
  `;

  const clientWeaver = new ClientWeaver();

  document.querySelector('button').click();
  await waitForExecution();

  expect(document.querySelector('div').textContent.trim()).toBe('1');
});
```

**Deliverable**: Full action and handler execution with mutations and event handling.

---

## Milestone 10: Components as Signals

**Goal**: Integrate components into the reactive signal system.

**Implementation Tasks**:
- Create `ComponentSignal` interface with props
- Implement `createComponent(logic: Logic, props: Props): ComponentSignal`
- Implement content-addressable ID for components (hash logic + serialized props)
- Extract signal dependencies from props (signal objects → IDs)
- Register components in dependency graph
- Emit `signal-definition` events for components in ComponentDelegate
- Implement component re-rendering when prop signals change

**Test Criteria**:
```typescript
test('component registers as signal', () => {
  const name = createSignal('Alice');
  const card = createComponent(CardSrc, { name, title: 'User' });

  expect(card.kind).toBe('component');
  expect(card.id).toMatch(/^c/);
  expect(weaver.registry.definitions.has(card.id)).toBe(true);
});

test('component dependencies extracted from props', () => {
  const name = createSignal('Alice');
  const age = createSignal(30);
  const card = createComponent(CardSrc, { name, age, role: 'Admin' });

  const deps = weaver.registry.getDependents('s1'); // name signal
  expect(deps).toContain(card.id);

  const deps2 = weaver.registry.getDependents('s2'); // age signal
  expect(deps2).toContain(card.id);
});

test('component re-renders when prop signal changes', async () => {
  const name = createSignal('Alice');
  const card = createComponent(CardSrc, { name });

  const html1 = await renderToString(<div>{card}</div>);
  expect(html1).toContain('Alice');

  name.value = 'Bob';
  await waitForExecution();

  const html2 = await renderToString(<div>{card}</div>);
  expect(html2).toContain('Bob');
});

test('component serialization includes props', async () => {
  const name = createSignal('Alice');
  const card = createComponent(CardSrc, { name, title: 'User' });

  const html = await renderToString(<div>{card}</div>);

  expect(html).toContain('<script>weaver.push({kind:"signal-definition",signal:{id:"c1",kind:"component",logic:{url:"/Card.js"},props:{name:"s1",title:"User"}}})</script>');
});
```

**Deliverable**: Components as fully reactive entities in the signal graph.

---

## Milestone 11: Full Stack Integration

**Goal**: End-to-end SSR to interactive client with all features working.

**Implementation Tasks**:
- Create `ClientWeaver` class that initializes from HTML
- Implement registry restoration from inline scripts
- Implement `weaver.push()` for registration messages
- Connect signal updates → computed re-execution → sink updates
- Connect event delegation → handler execution → signal updates → reactivity
- Create example app demonstrating full workflow
- Implement module manifest for production builds

**Test Criteria**:
```typescript
test('client initializes from server HTML', () => {
  const serverHtml = `
    <script>
      window.weaver = new ClientWeaver();
      weaver.push({kind:'signal-definition',signal:{id:'s1',kind:'state',init:5}});
      weaver.push({kind:'signal-definition',signal:{id:'c1',kind:'computed',logic:{url:'/double.js'},deps:['s1']}});
    </script>
    <div>
      <p>Count: <!--^s1-->5<!--/s1--></p>
      <p>Doubled: <!--^c1-->10<!--/c1--></p>
    </div>
  `;

  document.body.innerHTML = serverHtml;
  const clientWeaver = new ClientWeaver();

  expect(clientWeaver.registry.definitions.size).toBe(2);
  expect(clientWeaver.sink.bindPoints.size).toBe(2);
});

test('full reactive cycle: event → action → computed → DOM', async () => {
  const serverHtml = await renderCounterApp();
  document.body.innerHTML = serverHtml;

  const clientWeaver = new ClientWeaver();

  // Initial state
  expect(document.querySelector('.count').textContent).toBe('0');
  expect(document.querySelector('.doubled').textContent).toBe('0');

  // Click increment button
  document.querySelector('.increment').click();
  await waitForExecution();

  // State updated
  expect(document.querySelector('.count').textContent).toBe('1');
  expect(document.querySelector('.doubled').textContent).toBe('2');

  // Click again
  document.querySelector('.increment').click();
  await waitForExecution();

  expect(document.querySelector('.count').textContent).toBe('2');
  expect(document.querySelector('.doubled').textContent).toBe('4');
});

test('component reactivity works end-to-end', async () => {
  const serverHtml = await renderCardListApp();
  document.body.innerHTML = serverHtml;

  const clientWeaver = new ClientWeaver();

  // Update user name
  const input = document.querySelector('input[name="username"]');
  input.value = 'Bob';
  input.dispatchEvent(new Event('input'));

  await waitForExecution();

  // Component re-rendered with new name
  expect(document.querySelector('.card .name').textContent).toBe('Bob');
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
M3 (Reactivity Propagation)
  ↓
M4 (Server Bind Markers) ──→ M5 (Client Sink)
  ↓                            ↓
M6 (Event Delegation) ────────┘
  ↓
M7 (Logic System)
  ↓
M8 (Computed) ──→ M9 (Actions/Handlers)
  ↓                  ↓
M10 (Components) ←──┘
  ↓
M11 (Full Stack Integration)
```

### Estimated Complexity

| Milestone | Complexity | Risk | Notes |
|-----------|-----------|------|-------|
| M1 | Low | Low | Basic infrastructure |
| M2 | Medium | Medium | Content-addressable IDs, graph building |
| M3 | Medium | High | Reactivity propagation correctness |
| M4 | Medium | Medium | Serialization of all binding types |
| M5 | Medium | Low | Standard DOM Range manipulation |
| M6 | Low | Low | Event delegation patterns |
| M7 | High | High | Module loading, source phase imports |
| M8 | Medium | Medium | Logic execution, ReadOnly enforcement |
| M9 | Medium | Medium | Mutation handling, event integration |
| M10 | Medium | Medium | Component integration with existing POC |
| M11 | High | High | Full client/server parity |

### Review Points

After each milestone, review:
- ✅ All tests pass
- ✅ Implementation matches API.md interfaces
- ✅ No regressions in previous milestones
- ✅ Code is clear and maintainable
- ✅ Infrastructure is testable without execution (M1-M6)

The agent should stop and request review before proceeding to the next milestone.
