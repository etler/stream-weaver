/**
 * Logic that takes 100ms to complete
 * Used for testing timeout race (when timeout < 100ms)
 */
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export default async function slow100ms(x) {
  await delay(100);
  return x.value * 2;
}
