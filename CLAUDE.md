# Guide for AI Coding Assistants

This document provides instructions for AI coding assistants implementing Stream Weaver. Follow this guide to work through the implementation milestones systematically.

## Purpose

You are building Stream Weaver, a reactive web framework with SSR streaming. This guide explains how to:
- Navigate the project documentation
- Work through implementation milestones
- Write tests and verify correctness
- Know when to stop for human review

**Quick Start**: Read `docs/API.md` to understand the framework, then begin with Milestone 1 in `docs/PLANNING.md`.

---

## Project Context

**What is Stream Weaver?**
A reactive web framework using signals for state management, with streaming SSR and automatic DOM updates. It features universal addressability (signals work anywhere, no positional constraints) and explicit dependencies (no hidden closures).

**Current State**: The POC includes:
- ComponentDelegate with DelegateStream for parallel async component rendering
- JSX runtime (jsx, Fragment)
- ComponentSerializer for HTML output
- Tests demonstrating parallel execution with sequential output

**Goal**: Build a production-ready framework with full reactive system, client-side hydration, event handling, and build tooling.

---

## Documentation Map

Before starting, familiarize yourself with these files:

| File | Purpose | When to Reference |
|------|---------|-------------------|
| **docs/API.md** | Complete framework specification with interfaces, types, and behavior | Always - this is the source of truth |
| **docs/ARCHITECTURE.md** | Design philosophy, trade-offs, comparisons to React/Qwik | When understanding "why" decisions were made |
| **docs/PLANNING.md** | 11 milestones with test criteria and deliverables | Your roadmap - read current milestone thoroughly |
| **CLAUDE.md (this file)** | How to execute the implementation process | Reference throughout development |

---

## The Milestone Process

### Core Principles

1. **One milestone at a time** - Complete M1 before starting M2
2. **Tests define success** - All test criteria must pass
3. **Stop for review** - After completing a milestone, stop and request human approval
4. **No skipping ahead** - Don't implement features from future milestones

### Milestone Workflow

```
Read Milestone Spec
        ↓
Understand Goal & Tests
        ↓
Implement Functionality
        ↓
Write/Run Tests
        ↓
All Tests Pass? ──No──→ Debug & Fix
        ↓ Yes
Request Review & Stop
```

---

## Working on a Milestone

### Step-by-Step Process

**1. Read the Milestone Spec**
- Open `docs/PLANNING.md`
- Read the entire milestone section (Goal, Tasks, Test Criteria, Deliverable)
- Understand what you're building and why

**2. Study the Test Criteria**
- Tests define what "done" means
- Each test shows expected behavior
- If a test is unclear, ask for clarification before proceeding

**3. Review Relevant API.md Sections**
- Find the interfaces you need to implement
- Understand the types and their relationships
- Match the specification exactly

**4. Implement the Functionality**
- Create files in appropriate locations (follow POC structure)
- Implement interfaces from API.md
- Keep code simple and focused on current milestone only

**5. Write Tests**
- Use the test criteria as your starting point
- Write tests in `tests/` directory
- Use existing test infrastructure (Vitest)
- Run tests frequently: `npm test`

**6. Verify Completion**
- All milestone tests pass
- No previous tests broken
- TypeScript compiles: `npm run build`
- No linting errors: `npm run lint`

**7. Request Review**
- State which milestone is complete
- Confirm all tests pass
- Stop and wait for human approval before proceeding

---

## Test-Driven Development

### Why Tests Matter

Tests are not just validation - they are **executable specifications**. The test criteria in each milestone define exactly what the implementation should do.

### Testing Workflow

```typescript
// 1. Read the test criteria from PLANNING.md
test('signal creation and value access', () => {
  const count = createSignal(0);
  expect(count.id).toBe('s1');
  expect(count.value).toBe(0);
});

// 2. Implement to make it pass
export function createSignal<T>(init: T): StateSignal<T> {
  // Implementation here
}

// 3. Run tests
// npm test

// 4. Iterate until green
```

### Test Guidelines

- **Copy test criteria exactly** from PLANNING.md as starting point
- **Add edge cases** if you discover gaps
- **Don't skip failing tests** - fix them before moving on
- **Run tests frequently** - after every small change
- **Test in isolation** - each test should be independent

---

## Code Guidelines

### Style and Structure

- **Follow POC patterns**: Look at existing `ComponentDelegate`, `DelegateStream` usage
- **Match API.md exactly**: Don't invent new interfaces or change existing ones
- **Keep it simple**: No over-engineering, no premature optimization
- **TypeScript strict mode**: All code must type-check
- **Clear names**: Use descriptive variable and function names

### Project Structure

```
stream-weaver/
├── src/
│   ├── signals/          # Signal primitives (M1-M3)
│   ├── registry/         # Registry and dependency graph (M1-M3)
│   ├── weaver/           # Server/Client Weaver (M7-M11)
│   ├── sink/             # Client DOM updater (M5)
│   ├── ComponentDelegate/  # Existing POC code
│   ├── ComponentHtmlSerializer/ # Existing POC code
│   └── jsx/              # Existing POC code
├── tests/
│   ├── signals.test.ts   # M1-M3 tests
│   ├── serialization.test.ts  # M4 tests
│   └── ...
└── docs/
```

### File Organization

- One class/interface per file
- Export public APIs from index files
- Keep related functionality together
- Use clear directory names

---

## Important Patterns from POC

### DelegateStream Pattern

The POC uses DelegateStream for async streaming transforms. Study this pattern:

```typescript
// From ComponentDelegate.ts
export class ComponentDelegate extends DelegateStream<Node, Token> {
  constructor() {
    super({
      transform: (node, chain) => {
        // Process node, emit tokens
        // Use chain() to pipe child streams
      },
      finish: (chain) => {
        chain(null);
      },
    });
  }
}
```

**Key concepts:**
- Transform input stream to output stream
- Use `chain()` to pipe child DelegateStreams
- Enables parallel execution with sequential output

### Registry Pattern

Signals are **definitions** (metadata), registry holds **live state**:

```typescript
// Signal object (definition)
const count = { id: 's1', kind: 'state', init: 0 };

// Registry stores live value
registry.set('s1', 0);

// Getter accesses registry
count.value // → registry.get('s1')
```

### Component Processing

Look at how ComponentDelegate processes components:
- Tokenizes JSX elements
- Spawns child delegates for components
- Chains streams for sequential output

Reuse these patterns when integrating components as signals (M10).

---

## When to Ask for Help

### Do Ask When:

- **Test criteria is ambiguous** - "What does this test expect to happen?"
- **Fundamental design question** - "Should the registry be a singleton or instance?"
- **Interfaces unclear** - "What should this method return?"
- **Milestone seems blocked** - "This milestone requires X but X isn't defined yet"
- **Tests pass but behavior seems wrong** - "Tests pass but this doesn't match API.md"

### Don't Ask When:

- Implementation details (how to structure a class, variable names, etc.)
- Standard TypeScript questions (use your knowledge)
- Minor code organization decisions
- Bug fixing (try debugging first)

### How to Ask

Be specific:
- ✅ "M2 test criteria shows `createComputedDef([count])` but API.md shows `createComputed(logic, deps)`. Should M2 use a different function name?"
- ❌ "I'm confused about computed signals"

---

## What NOT to Do

### Forbidden Actions

1. **Don't skip milestones** - You must complete M1 before M2, etc.
2. **Don't implement ahead** - Only build what current milestone requires
3. **Don't change APIs** - Follow API.md interfaces exactly
4. **Don't add dependencies** - Use only existing packages unless approved
5. **Don't move forward with failing tests** - All tests must pass
6. **Don't batch milestones** - Complete one, stop for review, continue

### Common Mistakes

```typescript
// ❌ Don't over-engineer
class SignalRegistry {
  private observers: WeakMap<...>;
  private cache: LRUCache<...>;
  // ... complex optimization
}

// ✅ Keep it simple
class SignalRegistry {
  private values = new Map<string, unknown>();
  get(id: string) { return this.values.get(id); }
  set(id: string, value: unknown) { this.values.set(id, value); }
}

// ❌ Don't invent new interfaces
interface MyCustomSignal extends Signal {
  customField: string;
}

// ✅ Use API.md interfaces exactly
interface StateSignal<T> extends Signal {
  init: T;
  kind: 'state';
}

// ❌ Don't implement future features
// (in M1, adding logic execution from M8)
const doubled = createComputed(logic, [count]);
await executeComputed(doubled.id); // M8 feature!

// ✅ Only current milestone
// (M1 just needs signal creation)
const count = createSignal(0);
count.value = 5;
```

---

## Debugging Tips

### When Tests Fail

1. **Read the error message carefully**
   ```
   Expected: 's1'
   Received: undefined
   ```
   → The `id` field isn't being set

2. **Check API.md interface**
   ```typescript
   interface StateSignal<T> extends Signal {
     id: string;  // ← This is required
     init: T;
     kind: 'state';
   }
   ```

3. **Verify implementation**
   ```typescript
   export function createSignal<T>(init: T): StateSignal<T> {
     return {
       id: allocateId(), // ← Make sure this is called
       init,
       kind: 'state'
     };
   }
   ```

4. **Add debug logging**
   ```typescript
   console.log('Creating signal with init:', init);
   const signal = { id: allocateId(), init, kind: 'state' };
   console.log('Created signal:', signal);
   return signal;
   ```

### Common Issues

**TypeScript errors:**
- Check that interfaces match API.md exactly
- Ensure all required fields are present
- Verify types are imported correctly

**Tests not found:**
- Check test file is in `tests/` directory
- Ensure file ends with `.test.ts` or `.test.tsx`
- Run `npm test` not just `tsc`

**Imports failing:**
- Use `@/` alias for src imports: `import { Signal } from '@/signals'`
- Check `tsconfig.json` for path configuration

**Registry state issues:**
- Add registry inspection: `console.log([...registry.values.entries()])`
- Verify signal IDs are unique
- Check getter/setter implementation

---

## Review Checklist

Before requesting review at the end of a milestone, verify:

### Code Quality
- [ ] All milestone tests pass (`npm test`)
- [ ] No previous tests broken (run full test suite)
- [ ] TypeScript compiles without errors (`npm run build`)
- [ ] No linting errors (`npm run lint`)
- [ ] Code follows existing patterns from POC

### Correctness
- [ ] Implementation matches API.md interfaces exactly
- [ ] All test criteria from PLANNING.md are implemented
- [ ] Edge cases are handled (empty inputs, undefined, etc.)
- [ ] No console errors or warnings when tests run

### Completeness
- [ ] All tasks in milestone "Implementation Tasks" are done
- [ ] Deliverable matches milestone description
- [ ] No features from future milestones implemented
- [ ] No TODOs or stub implementations left

### Documentation
- [ ] Public APIs have TSDoc comments (optional but helpful)
- [ ] Complex logic has explanatory comments
- [ ] Test names clearly describe what they test

### Request Review

Once all checks pass, state clearly:
```
Milestone [N] complete: [Milestone Name]

✅ All tests pass
✅ Implementation matches API.md
✅ Deliverable: [brief description]

Ready for review before proceeding to Milestone [N+1].
```

Then **STOP** and wait for human approval.

---

## Development Commands

```bash
# Install dependencies
npm install

# Run tests (Vitest)
npm test

# Run tests in watch mode
npm test -- --watch

# Build TypeScript
npm run build

# Run linter
npm run lint

# Fix lint errors automatically
npm run fix

# Type check without building
tsc --noEmit
```

---

## Milestone Quick Reference

| Milestone | Focus | Key Deliverable |
|-----------|-------|-----------------|
| M1 | Signal System Foundation | Signals with registry storage |
| M2 | Dependency Graph | Track signal dependencies without execution |
| M3 | Reactivity Propagation | Event-based update propagation |
| M4 | Server Bind Markers | HTML serialization with bind markers |
| M5 | Client Sink | DOM updater with Range-based replacement |
| M6 | Event Delegation Infrastructure | Event routing without execution |
| M7 | Logic System & Source Phase Imports | Module loading system |
| M8 | Computed Signals with Execution | Computed values with logic |
| M9 | Actions and Handlers with Execution | Mutations and event handling |
| M10 | Components as Signals | Components in reactive graph |
| M11 | Full Stack Integration | End-to-end SSR to interactive client |

---

## Summary

1. **Read API.md** - Understand the framework specification
2. **Follow PLANNING.md** - One milestone at a time
3. **Tests define success** - Make all test criteria pass
4. **Stop for review** - After each milestone completion
5. **Keep it simple** - No over-engineering
6. **Match interfaces exactly** - API.md is source of truth
7. **Ask when stuck** - Don't guess on fundamental questions

Remember: The goal is not to write clever code, but to **implement the specification correctly** so Stream Weaver works as designed.

Good luck! Start with Milestone 1 in `docs/PLANNING.md`.
