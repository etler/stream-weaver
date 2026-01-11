# 🧩 PATTERNS.md: Addressable Design Patterns

This document outlines how to solve common web development challenges using the **Universal Addressable Factory** model. By treating state, logic, and UI as unique pointers, we eliminate the need for complex framework internals like "Context Providers" or "Re-rendering Trees."

---

## 1. The "Global Bus" Pattern (Solving the Context Problem)

**The Problem:** In React, sharing state across distant components requires a `<Provider>`, which triggers re-renders for every child in the tree whenever the value changes.

**The Weaver Solution:** Because signals are addressable IDs, state does not need to live inside the UI tree. It lives in the **Sink**.

* **Definition:** Define and export your signal from a standard TypeScript file.
* **Usage:** Any component can import the signal ID and "weave" it into the HTML.
* **The Result:** When the value updates, the Sink performs a surgical DOM update only on the elements bound to that ID. No components are re-executed.

---

## 2. The "Recursive Resolver" Pattern (Solving Dynamic Components)

**The Problem:** Swapping a "Login" view for a "Profile" view usually requires re-rendering a parent component and re-executing branching logic on every state change.

**The Weaver Solution:** Treat the "Switch" logic as a pure **Resolver Action** that returns a Component Binding.

* **The Pattern:** Create an action that takes a state (e.g., `isLoggedIn`) and returns a JSX tag (e.g., `<Profile />`).
* **The Result:** The parent component remains a static shell. The Sink observes the "View Slot" address. When the state changes, the Sink runs the resolver, fetches the new component's code, and surgically swaps the DOM portal.

```tsx
// logic/view-resolver.ts
import source Profile from '../components/Profile';
import source Login from '../components/Login';

export default (isLoggedIn, user) => {
  return isLoggedIn ? <Profile user={user} /> : <Login />;
};

// App.tsx
const currentView = createAction(viewResolver, [isLoggedIn, userSignal]);
export const App = () => <main>{currentView}</main>;

```

---

## 3. The "Action Middleware" Pattern (Solving Prop Drilling)

**The Problem:** Passing event handlers (like `onDelete`) through five layers of components is brittle and causes unnecessary "Prop Drilling."

**The Weaver Solution:** Actions are serializable addresses. You can pass an action's `Binding` as a dependency to another action, or simply import the action pointer directly where needed.

* **The Pattern:** A "Guard Action" (e.g., `withLogging`) that takes a "Business Action" as a dependency.
* **The Result:** You compose logic at the address level. The server flushes a nested pointer; the client resolves the chain.

---

## 4. The "Derived Pipeline" Pattern (Solving the Computed Problem)

**The Problem:** Calculating a "Total Price" based on "Quantity" and "Price" signals usually requires a `useMemo` hook trapped inside a component or a complex selector.

**The Weaver Solution:** An action can return a value, which automatically allocates a **Derived Signal ID**.

* **The Pattern:** `const total = createAction(calculateTotal, [price, quantity])`.
* **The Result:** `total` is now a valid address. You can pass `total` into a "Checkout" action just like a regular signal. This creates a **Distributed Call Stack**.

---

## 5. The "ChainExplode" Pattern (Solving Dynamic Lists)

**The Problem:** Rendering a list of 1,000 items with independent timers or handlers usually bogs down the main thread during hydration.

**The Weaver Solution:** Since `createX` can be called in loops, you can generate unique addresses for every item on the fly.

* **The Pattern:** Call `createAction` inside a `.map()` during the server-side stream.
* **The Result:** Each item arrives with its own pre-wired, surgical interactivity. The browser doesn't "loop" to attach listeners; it just populates the Sink as the HTML arrives.

---

## 6. The "Surgical Attribute" Pattern (Solving Class/Style Toggling)

**The Problem:** To toggle a "dark-mode" class, most frameworks re-render the entire Layout component.

**The Weaver Solution:** Weave a signal directly into an attribute.

* **The Pattern:** `<div class="${themeSignal}">`.
* **The Result:** The Sink performs a direct `element.className = val` update. This is the **holy grail** of performance: state-to-DOM updates with zero component overhead.

---

### Comparison: The Old Way vs. The Weaver Way

| Classical Problem | The React Way | **The Weaver Pattern** |
| --- | --- | --- |
| **Global State** | Context Provider (Tree-bound) | **Global Signal (Address-bound)** |
| **Computeds** | `useMemo` (Component-bound) | **Derived Actions (ID-bound)** |
| **Prop Drilling** | Manual passing of functions | **Direct Address Import/Composition** |
| **Dynamic UI** | Conditional Rendering (Parent-bound) | **Recursive Resolver (Portal-bound)** |
| **Interactivity** | Hydration / Re-rendering | **Address Resolution / Surgical Update** |
