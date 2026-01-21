/**
 * Client-only logic that returns viewport dimensions
 * Used for testing createClientLogic
 */
export default function getViewport() {
  // This would fail on server (no window object)
  return {
    width: window.innerWidth,
    height: window.innerHeight,
  };
}
