/**
 * Slow double logic - takes 100ms to complete
 * Used for testing timeout: 0 (always defer)
 */
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export default async function slowDouble(x) {
  await delay(100);
  return x * 2;
}
