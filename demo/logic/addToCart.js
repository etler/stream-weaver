/**
 * Handler logic for adding to cart
 * @param {Event} _event - The event object (unused)
 * @param {Object} cartCount - Signal interface with .value getter/setter
 */
export default function addToCart(_event, cartCount) {
  cartCount.value = cartCount.value + 1;
}
