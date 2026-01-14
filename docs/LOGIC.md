# Proposal: Addressable Logic Modules for TypeScript

## What we’re building

We want to represent TypeScript modules as addressable code: something that can be referenced, serialized, and later executed—without necessarily loading the module code immediately on the client.

---

## Requirements

* **Type-safe wiring at definition time**
  * When a graph node references a module-exported function, TypeScript should validate parameter compatibility at the point the node is created.
* **Serializable runtime representation**
  * The server must be able to serialize references to logic into JSON for the client to resume from.
* **Lazy client loading**
  * Logic modules must be loadable on demand, not automatically loaded as part of graph definition.
* **Minimal authoring ceremony**
  * No manual `ModuleMap`, no generated index files, no “register every module” patterns.
* **Robustness when code isn’t perfectly inline (optional)**
  * If developers store an import promise or pass it through helpers, we’d like serialization to still work when possible.

### Non-goals

* Enforcing functional purity / preventing closure capture.
* Enforcing TS compiler strictness choices (teams decide their own tsconfig).
* Runtime type-checking at execution time.

---

## Developer experience

Developers author graphs using `import("…")` directly in graph APIs. This is primarily a **type anchor**.

Example:

```ts
const count = createSignal(21);
const doubled = createComputed(import("./double"), [count]);
```

```ts
// double.ts
export default (count: Signal<number>) => count.value * 2;
```

If the dependency list doesn’t match the module export signature, TypeScript errors at the definition site.

### Minimal typing pattern (default export)

```ts
type DefaultExportFn<M> =
  M extends { default: (...args: any[]) => any } ? M["default"] : never;

type ArgsOf<F> = F extends (...args: infer A) => any ? A : never;
type RetOf<F>  = F extends (...args: any[]) => infer R ? R : never;

export function createComputed<
  M,
  F extends (...args: any[]) => any = DefaultExportFn<M>
>(
  mod: Promise<M>,
  deps: ArgsOf<F>
): { logic: LogicRef; deps: ArgsOf<F>; _out?: RetOf<F> } {
  // runtime payload is just LogicRef + deps; build injects the id
  return {} as any;
}
```

Key point: **Types come from `import("./x")`; runtime does not depend on having the module loaded.**

---

## Runtime representation (serializable + lazy)

At runtime we store a small token:

```ts
export type LogicRef = { id: string };
```

Execution uses a loader:

```ts
export type ModuleLoader = (id: string) => Promise<any>;

export async function loadLogic<M>(ref: LogicRef, loader: ModuleLoader): Promise<M> {
  return loader(ref.id) as Promise<M>;
}
```

Serialization:

```ts
export const serializeLogicRef = (ref: LogicRef) => ({ id: ref.id });
```

The client later receives `{ id }` and loads the module only when it must execute.

---

## Build-time responsibilities (bundler plugin)

A bundler plugin connects the authoring form to the runtime form.

### What the plugin must do

* **Recognize supported module references**
  * Typically `import("…")` with a string-literal specifier in known graph APIs (e.g., `createComputed(import("./double"), …)`).
* **Assign/derive a stable identifier**
  * Create a canonical `id` for the referenced module (resolved path/specifier/etc.).
* **Rewrite runtime payloads**
  * Replace the authored reference with `{ id }` (or an equivalent form) so runtime never carries import promises.
* **Ensure the referenced module is emitted**
  * Keep it in the build graph so the loader can import it later.
* **Enable `id → client asset` resolution**
  * Provide a way to map ids to actual client chunks/URLs (commonly via a manifest).

### Supported vs unsupported patterns

* **Supported (serializable):**
  * Statically discoverable module references (string-literal specifiers).
* **Unsupported (dynamic imports):**
  * Fully dynamic imports (`import(`./${x}`)`) since they can’t reliably map to a single emitted module without registries/codegen.

### Optional import robustness (fallback)

The preferred behavior is to rewrite graph definitions so runtime carries only stable ids. As a best-effort fallback (for cases where code isn’t in the “golden path” shape), the build can preserve **serializability** by attaching a stable id to any statically analyzable dynamic import promise:

* Rewrite `import("<literal>")` → `Object.assign(import("<literal>"), { __logicId: "<id>" })`
* Rewrite `createLogic(import("<literal>"))` → `createLogic("<id>")` when encountered

On the server, serialization can accept either:

* a normal logic reference `{ id }`, or
* any promise/object carrying `__logicId`, emitting `{ id: __logicId }`.

This keeps dynamic specifiers (`import(expr)`) as an explicit opt-out: if the target isn’t known at build time, no stable id can be produced.

---

## Open questions

* Default export only vs named export selection.
* Canonical `id` format (resolved path, normalized specifier, hash).
