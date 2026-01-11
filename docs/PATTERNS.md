# 🧩 PATTERNS.md: Developer Guide & Recipes

> **Goal:** This guide explains how to think in "Streams" and "Signals" rather than Components and Lifecycles.

## 1. The Mental Model: "Events, Not Effects"

In React, you often write `useEffect` to synchronize state.
In Stream Weaver, you write **Event Handlers** to change state.

* **React (Synchronization):** "When `count` changes, run this side effect."
* **Weaver (Causality):** "When the user clicks, update `count` and log the result."

### The "No-Effect" Rule

Weaver (v1) intentionally omits a `useEffect` equivalent. Logic should only run in response to:

1. **User Interaction** (Clicks, Input).
2. **Server Events** (Stream updates).

This keeps the data flow unidirectional and predictable.

---

## 2. Managing Global State (The "Context" Pattern)

Since Weaver components do not re-render, you cannot rely on "Prop Drilling" to pass data down a deep tree. Instead, use **Signal Injection**.

### Pattern: The Context Registry

Instead of passing the *value*, pass the *Signal ID*.

**Parent (Provider):**

```typescript
import { createSignal, provideContext } from 'stream-weaver';

export default function App() {
  const theme = createSignal('dark');
  // Register the signal ID globally (or scoped to this subtree)
  provideContext('theme', theme);

  return html`<Header /><Main />`;
}

```

**Action File (`actions/theme.ts`):**

```typescript
import { Signal } from 'stream-weaver';

export default ([theme]: [Signal<string>]) => {
  theme.value = theme.value === 'dark' ? 'light' : 'dark';
};

```

**Child (Consumer):**

```typescript
import { injectContext, createAction } from 'stream-weaver';
// Import the logic as a reference (URL), not execution
import source toggleTheme from '../actions/theme';
// Import the type contract
import type toggleType from '../actions/theme';

export default function ThemeToggle() {
  // 1. Grab the signal reference (it's just an ID string!)
  const theme = injectContext('theme');

  // 2. Bind the action file to the signal
  return html`
    <button on:click=${createAction<typeof toggleType>(toggleTheme, [theme])}>
      Toggle Theme
    </button>
  `;
}

```

---

## 3. Organizing Logic

### Pattern: The "Action File" (Default)

In Stream Weaver, logic does not live inside your component. It lives in **Action Files**. This ensures the server never executes client-side logic.

**File structure:**

```text
src/
  components/
    Product.tsx
  actions/
    addToCart.ts

```

**1. Write the Logic (`actions/addToCart.ts`):**

```typescript
// Pure TypeScript. Easy to test. Easy to lint.
export default ([cart], productId) => {
  cart.value.push(productId);
};

```

**2. Bind the View (`components/Product.tsx`):**

```typescript
import source addToCart from '../actions/addToCart';

export function Product({ id }) {
  const cart = injectContext('cart');
  // Pass 'id' as a static argument (second param)
  return html`
    <button on:click=${createAction(addToCart, [cart], id)}>Buy</button>
  `;
}

```

### Pattern: Shared Logic

Because logic is just a file, sharing it is native. You simply import the same source handle in multiple components. The browser will cache the `action.js` file once, even if used by 50 different buttons.

---

## 4. The "Tuple Binding" Pattern (Complex State)

Sometimes an action needs access to multiple signals (e.g., "User" and "Form Data").
Weaver supports passing multiple dependencies as a tuple. The order is strict.

**Action File (`actions/submit.ts`):**

```typescript
import { Signal } from 'stream-weaver';
import type { User } from '../types';

// Define strict tuple expectation
export default ([user, form]: [Signal<User>, Signal<string>]) => {
  console.log('User', user.value.name, 'submitted', form.value);
};

```

**Component:**

```typescript
import source submitLogic from './actions/submit';

// ... inside component
const user = createSignal({ name: 'Alice' });
const form = createSignal('');

// Binds strictly in order: user -> arg[0], form -> arg[1]
const handler = createAction(submitLogic, [user, form]);

```

---

## 5. Working with Third-Party Libraries

Since Action Files are standard ES Modules, you use standard imports. The bundler (Vite) handles the code splitting automatically.

**Action File (`actions/analytics.ts`):**

```typescript
// ✅ Standard Import.
// The bundler will put this into a shared chunk if needed.
import { track } from 'my-analytics-lib';

export default () => track('button_clicked');

```

**What happens at build time:**

1. Vite sees `actions/analytics.ts` imports `my-analytics-lib`.
2. It creates a chunk for the action and a chunk for the lib.
3. The main `index.html` remains tiny.
4. When the user clicks, the browser downloads the action chunk + the lib chunk (in parallel).

---

## 6. Type Safety Tips

### Tip: "Types as Contracts"

Always use the **Dual Import** pattern to ensure your View obeys your Logic.

```typescript
// 1. The Handle (Runtime)
import source updateName from './actions/updateName';
// 2. The Contract (Build time)
import type updateType from './actions/updateName';

// 3. The Enforcer
createAction<typeof updateType>(updateName, [signal]);

```

If you change `updateName` to require a `number` but pass a `string` signal, `createAction` will throw a build error.

### Tip: The "Signal Bag"

If you find yourself passing 5+ signals, bundle them into a single object signal or a "Context Store" signal to keep your dependency arrays clean.

```typescript
// Messy
createAction(logic, [s1, s2, s3, s4]);

// Clean
const store = createSignal({ s1, s2, s3, s4 });
createAction(logic, [store]);

```
