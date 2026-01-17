/**
 * Handler logic for clearing the cart
 * @param {Event} _event - The event object (unused)
 * @param {Object} cartCount - Signal interface with .value getter/setter
 */
export default function clearCart(_event, cartCount) {
  cartCount.value = 0;
}
