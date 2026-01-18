/**
 * Handler logic for clearing the cart
 */
import type { WritableSignalInterface } from "stream-weaver";

export default function clearCart(_event: Event, cartCount: WritableSignalInterface<number>): void {
  cartCount.value = 0;
}
