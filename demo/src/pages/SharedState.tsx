/**
 * Example 4: Module-Level Shared State
 * Demonstrates state created outside components and shared across the app
 *
 * IMPOSSIBLE IN OTHER FRAMEWORKS:
 * - React: Hooks must be called inside components
 * - Vue: Composables must be called in setup()
 * - Solid: createSignal needs reactive scope
 *
 * Stream Weaver: Signals are just objects - create them anywhere!
 * Import them in any component, no providers needed.
 */
import { cartCount, addToCart, clearCart } from "../shared/cart";

/**
 * A product card component that uses the shared cart state
 */
function ProductCard({ name, price, image }: { name: string; price: string; image: string }): JSX.Element {
  return (
    <div style="background: white; border-radius: 8px; padding: 1rem; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
      <div style={`height: 120px; background: ${image}; border-radius: 4px; margin-bottom: 1rem;`} />
      <h3 style="margin: 0 0 0.5rem 0;">{name}</h3>
      <p style="color: #666; margin: 0 0 1rem 0;">{price}</p>
      <button
        onClick={addToCart}
        style="width: 100%; padding: 0.5rem; background: #1976d2; color: white; border: none; border-radius: 4px; cursor: pointer;"
      >
        Add to Cart
      </button>
    </div>
  );
}

/**
 * A header component that displays the cart count
 */
function Header(): JSX.Element {
  return (
    <header style="display: flex; justify-content: space-between; align-items: center; padding: 1rem; background: white; border-radius: 8px; margin-bottom: 2rem; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
      <h2 style="margin: 0; color: #333;">Demo Store</h2>
      <div style="display: flex; align-items: center; gap: 1rem;">
        <div style="display: flex; align-items: center; gap: 0.5rem;">
          <span>Cart:</span>
          <span style="background: #1976d2; color: white; padding: 0.25rem 0.75rem; border-radius: 999px; font-weight: bold;">
            {cartCount}
          </span>
        </div>
        <button
          onClick={clearCart}
          style="padding: 0.5rem 1rem; background: #f44336; color: white; border: none; border-radius: 4px; cursor: pointer;"
        >
          Clear
        </button>
      </div>
    </header>
  );
}

/**
 * A floating cart indicator
 */
function FloatingCartBadge(): JSX.Element {
  return (
    <div style="position: fixed; bottom: 2rem; right: 2rem; background: #1976d2; color: white; padding: 1rem; border-radius: 50%; width: 60px; height: 60px; display: flex; flex-direction: column; align-items: center; justify-content: center; box-shadow: 0 4px 8px rgba(0,0,0,0.2);">
      <span style="font-size: 1.5rem;">{cartCount}</span>
      <span style="font-size: 0.7rem;">items</span>
    </div>
  );
}

/**
 * Root component for the demo
 */
export function SharedStateExample(): JSX.Element {
  return (
    <div style="padding: 1rem; max-width: 800px; margin: 0 auto;">
      <h1 style="text-align: center; color: #333;">Shared State Demo</h1>
      <p style="text-align: center; color: #666; max-width: 600px; margin: 0 auto 2rem auto;">
        All components share the same cart state defined in a separate module. No Context providers, no Redux, no prop
        drilling. Just import and use.
      </p>

      <div style="background: #e8f5e9; padding: 1rem; border-radius: 8px; margin-bottom: 2rem;">
        <strong>What makes this special:</strong>
        <ul style="margin: 0.5rem 0 0 0; padding-left: 1.5rem;">
          <li>cartCount is created in shared/cart.ts (outside any component)</li>
          <li>Header, ProductCard, and FloatingCartBadge all import and use it</li>
          <li>No Context.Provider wrapping the app</li>
          <li>No useContext() hooks or store subscriptions</li>
          <li>State just works because signals are addressable by ID</li>
        </ul>
      </div>

      <Header />

      <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 1rem;">
        <ProductCard
          name="Wireless Headphones"
          price="$79.99"
          image="linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
        />
        <ProductCard name="Smart Watch" price="$199.99" image="linear-gradient(135deg, #f093fb 0%, #f5576c 100%)" />
        <ProductCard name="Laptop Stand" price="$49.99" image="linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)" />
        <ProductCard name="USB-C Hub" price="$39.99" image="linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)" />
      </div>

      <FloatingCartBadge />
    </div>
  );
}
