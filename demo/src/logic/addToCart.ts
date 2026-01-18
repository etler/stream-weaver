/**
 * Handler logic for adding to cart
 */
import type { WritableSignalInterface } from "stream-weaver";

export default function addToCart(_event: Event, cartCount: WritableSignalInterface<number>): void {
  cartCount.value = cartCount.value + 1;
}
