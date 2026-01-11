# ⚖️ COMPARISONS.md: Stream Weaver vs. The World

> **Goal:** To clearly articulate why Stream Weaver exists by contrasting its trade-offs with existing solutions. We do not claim to be "better" at everything, but we claim to be **more architecturally transparent** and **more efficient** for distributed applications.

## 1. Weaver vs. React (Next.js / RSC)

The dominant paradigm is **Hydration**. React sends HTML, then sends the JavaScript to re-build that HTML, then attaches listeners.

| Feature | React / Next.js (RSC) | Stream Weaver |
| --- | --- | --- |
| **Interactive Initiation** | **Hydration:** Re-runs component logic on the client. | **Resumption:** Attaches listeners to existing DOM. Zero component logic runs. |
| **Bundle Size** | **O(Tree):** Grows with the size of the component tree. | **O(Interaction):** Grows only with the interactive elements (buttons). |
| **Data Flow** | **Prop Drilling / Context:** Data is passed through the tree. | **Signal Injection:** IDs are passed directly to listeners. |
| **Network** | **Waterfalls:** JS loads after HTML parses. | **Parallel Stream:** Logic/Signals stream alongside HTML. |

**The Weaver Advantage:**

* **Zero "Uncanny Valley":** There is no period where the UI looks interactive but isn't. The HTML is just a visual snapshot; the "Brain" (Sink) wakes up instantly.
* **No Double Execution:** Server logic never runs on the client.

---

## 2. Weaver vs. Qwik

Qwik is the closest spiritual relative (Resumability), but their implementation relies on **Implicit Magic** (the Compiler) whereas Weaver relies on **Explicit Standards** (the Platform).

| Feature | Qwik | Stream Weaver |
| --- | --- | --- |
| **Syntax** | **Implicit:** `$(() => count++)`. The compiler captures `count`. | **Explicit:** `([s]) => s.value++`. You pass `[count]` manually. |
| **Safety** | **Runtime Surprise:** Easy to accidentally serialize huge objects. | **Build-Time Guarantee:** TypeScript prevents mismatched dependencies. |
| **Refactoring** | **Fragile:** Moving code out of `$` can break the optimizer. | **Robust:** Logic lives in standard `.ts` files; it is immutable. |
| **Standardization** | **Proprietary:** Custom `q-json` format and loader. | **Standard:** Stage 3 **Source Phase Imports** (`import source`). |

**The Weaver Advantage:**

* **Predictability:** You never have to debug the compiler. You know exactly what is crossing the wire because you typed it into the dependency array.
* **Future Proof:** We bet on ECMAScript proposals, not custom framework hacks.

---

## 3. Weaver vs. Wiz (Google Internal)

Wiz is the inspiration for the "Fine-Grained" approach, but it suffers from poor Developer Experience (DX).

| Feature | Wiz | Stream Weaver |
| --- | --- | --- |
| **Authoring** | **Registry Pattern:** Action IDs must be manually mapped strings. | **Import Pattern:** Actions are imported as source handles (`import source`). |
| **Type Safety** | **Low:** Loose contracts between template and logic. | **High:** Strict TS inference tunnels types from Logic to View. |
| **Ecosystem** | **Closed:** Internal to Google. | **Open:** Built on Vite and standard ESM. |

**The Weaver Advantage:**

* **Modern DX:** We bring the power of the "Wiz Model" (Action Registries) but automate the registry maintenance using standard imports. You feel like you're writing modules, but you ship optimized registries.

---

## 4. Summary of Trade-offs

Stream Weaver is **NOT** for everyone.

* **Don't use Weaver if:** You are building a local-first dashboard (like Linear) where the entire app state needs to live in memory anyway. React is better for high-frequency, complex client-side state.
* **Use Weaver if:** You are building a content-heavy, edge-deployed application (E-commerce, Media, SaaS Landing) where **Time-to-Interactive** and **Bandwidth** are the critical metrics.

### The "Golden Rule" Comparison

* **React:** "I will trade Startup Performance for high-fidelity Client State."
* **Qwik:** "I will trade Architectural Simplicity for Developer Convenience."
* **Weaver:** "I will trade Developer Convenience (separating logic files) for **Maximum Performance and Standards Compliance**."
