This final update to **COMPARISONS.md** integrates the "Addressable Factory" revelation. It contrasts Stream Weaver's **Address-Centric** model (where state and logic are universal pointers) against the **Tree-Centric** model of React and the **Compiler-Centric** model of Qwik.

---

# ⚖️ COMPARISONS.md: Stream Weaver vs. The World

> **Goal:** To articulate why Stream Weaver exists by contrasting its trade-offs with existing solutions. We prioritize **Architectural Transparency** and **Universal Addressability** over implicit magic.

## 1. Weaver vs. React (Next.js / RSC)

The dominant paradigm is **Hydration**. React sends HTML, then sends the JavaScript to re-build that HTML and its memory state.

| Feature | React / Next.js (RSC) | Stream Weaver |
| --- | --- | --- |
| **State Model** | **Positional:** State is tied to a component's location in the tree. | **Addressable:** State is a global ID (`s1`) reachable from anywhere. |
| **Rules of Hooks** | **Strict:** Hooks must be at the top level, in order, in components. | **None:** `createSignal` can be called in loops, globals, or utilities. |
| **Interactivity** | **Hydration:** Re-runs component logic to attach listeners. | **Resumption:** Sink resolves IDs to DOM nodes instantly. |
| **Data Flow** | **Tree-Bound:** Prop drilling or Context Providers. | **Direct:** Any Action can import any Signal ID directly. |

**The Weaver Advantage:**

* **Escape the "Component Prison":** You don't need a "Context Provider" to share state across the app. You just export a signal from a `.ts` file.
* **Zero Double Execution:** The server renders; the client only executes the specific action clicked.

---

## 2. Weaver vs. Qwik

Qwik shares our goal of Resumability but achieves it through **Implicit Compiler Magic**. Weaver achieves it through **Explicit Architectural Standards**.

| Feature | Qwik | Stream Weaver |
| --- | --- | --- |
| **Logic Extraction** | **Compiler-Driven:** `$(...)` captures closures. | **Address-Driven:** `import source` references modules. |
| **State Scope** | **Component-Local:** State must be inside `component$`. | **Universal:** State can be global or local singletons. |
| **Reactivity** | **Proxy-Tree:** Serializes a graph of objects. | **Flat Sink:** Serializes a flat Map of IDs. |
| **Standardization** | **Proprietary:** Custom `q-json` and optimizer. | **Standard:** Stage 3 **Source Phase Imports**. |

**The Weaver Advantage:**

* **"Honest" State:** In Qwik, it’s easy to accidentally serialize a massive parent object because of a closure. In Weaver, you only serialize what you explicitly pass to the dependency array.
* **No Compiler Debugging:** You never have to wonder why a variable didn't serialize; if it’s not an ID in the array, it’s not there.

---

## 3. Weaver vs. Wiz (Google Internal)

Wiz is the gold standard for "Action-State" separation but is notoriously difficult to author.

| Feature | Wiz | Stream Weaver |
| --- | --- | --- |
| **Authoring** | **Registry Pattern:** Manual string IDs for every action. | **Factory Pattern:** `createAction` uses standard imports. |
| **Type Safety** | **Manual:** Hard to sync template types with logic. | **Automatic:** TS infers types from the `source` handle. |
| **Composition** | **Limited:** Actions are usually flat handlers. | **Recursive:** Actions can return signals and be nested. |

**The Weaver Advantage:**

* **Modern DX:** We provide the "Holy Grail" power of the Wiz model (Action Registries) but automate it using standard TypeScript. You get the world's most performant architecture with the DX of a modern framework.

---

## 4. The "Holy Grail" Comparison: Addressability

| The Rule | The Rest of the World | **Stream Weaver** |
| --- | --- | --- |
| **Where can I create state?** | Inside a Component. | **Anywhere (Global, Loop, Utility).** |
| **How is state tracked?** | By its position in the tree. | **By its unique Address (ID).** |
| **Can logic return state?** | Usually via re-renders or state-lifting. | **Directly (Actions return Signals).** |
| **Can I nest logic?** | Only via component composition. | **Yes (Actions can depend on Actions).** |

---

## 5. Summary of Trade-offs

Stream Weaver is **NOT** a general-purpose tool for every use case.

* **Don't use Weaver if:** You are building a high-fidelity, local-first "App" (like a Video Editor or Figma) where the entire state should live in a complex, non-serializable memory graph.
* **Use Weaver if:** You are building **Distributed Applications** (E-commerce, AI Agents, Streaming Platforms) where you need to "ChainExplode" interactivity from a server to a client with zero hydration and maximum speed.

### The "Golden Rule" Comparison

* **React:** "I will trade Startup Performance for high-fidelity Client State."
* **Qwik:** "I will trade Architectural Simplicity for Developer Convenience."
* **Weaver:** "I will trade Developer Convenience (explicitly passing IDs) for **Total Addressability and Unbounded Scale**."

---

**Next Step:** With all documentation updated to the "Universal Addressable Factory" model, are you ready to implement the first piece of the "Walking Skeleton"—the **`createSignal`** ID allocator in `src/runtime/Signal.ts`?
