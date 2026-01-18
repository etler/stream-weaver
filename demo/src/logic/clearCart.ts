/**
 * Handler logic for clearing the cart
 */
interface SignalInterface {
  value: number;
}

export default function clearCart(_event: Event, cartCount: SignalInterface): void {
  cartCount.value = 0;
}
