/**
 * Logic that takes 10ms to complete
 * Used for testing timeout race (when timeout > 10ms, should complete inline)
 */
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export default async function fast10ms(x) {
  await delay(10);
  return x * 2;
}
