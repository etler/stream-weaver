/**
 * Client-only logic that returns viewport dimensions
 * Used for testing defineClientLogic
 */
export default function getViewport() {
  // This would fail on server (no window object)
  return {
    width: window.innerWidth,
    height: window.innerHeight,
  };
}
