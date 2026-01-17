/**
 * Shared State Module
 *
 * IMPOSSIBLE IN OTHER FRAMEWORKS:
 * - React: Hooks must be called inside components, can't export state like this
 * - Vue: Composables have similar restrictions
 * - Solid: createSignal must be in reactive scope
 *
 * Stream Weaver: Signals are just objects with IDs - create them anywhere!
 * This module exports state that any component can import and use directly.
 * No Context providers, no store setup, no boilerplate.
 */
import { createSignal, createHandler, createLogic } from "../../src/signals";

// Create state at module level - this "just works" in Stream Weaver
// In React, this would require Context, Redux, Zustand, etc.
export const cartCount = createSignal(0);

// Create logic signals for handlers
const addToCartLogic = createLogic("/logic/addToCart.js");
const clearCartLogic = createLogic("/logic/clearCart.js");

// Create handlers that operate on the shared state
export const addToCart = createHandler(addToCartLogic, [cartCount]);
export const clearCart = createHandler(clearCartLogic, [cartCount]);

// You can even create computed values from shared state
// export const cartTotal = createComputed(calculateTotalLogic, [cartCount, pricePerItem]);
