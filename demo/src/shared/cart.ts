/**
 * Shared Cart State Module
 *
 * IMPOSSIBLE IN OTHER FRAMEWORKS:
 * - React: Hooks must be called inside components, can't export state like this
 * - Vue: Composables have similar restrictions
 * - Solid: defineSignal must be in reactive scope
 *
 * Stream Weaver: Signals are just objects with IDs - create them anywhere!
 * This module exports state that any component can import and use directly.
 * No Context providers, no store setup, no boilerplate.
 */
import { defineSignal, defineHandler, defineLogic } from "stream-weaver";

// Create state at module level - this "just works" in Stream Weaver
// In React, this would require Context, Redux, Zustand, etc.
export const cartCount = defineSignal(0);

// Create logic signals for handlers (type-safe with import())
const addToCartLogic = defineLogic(import("../logic/addToCart"));
const clearCartLogic = defineLogic(import("../logic/clearCart"));

// Create handlers that operate on the shared state (TypeScript validates deps match function signature)
export const addToCart = defineHandler(addToCartLogic, [cartCount]);
export const clearCart = defineHandler(clearCartLogic, [cartCount]);
