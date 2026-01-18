/**
 * Handler logic for adding to cart
 */
interface SignalInterface {
  value: number;
}

export default function addToCart(_event: Event, cartCount: SignalInterface): void {
  cartCount.value = cartCount.value + 1;
}
