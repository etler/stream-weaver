/**
 * Async computed logic that doubles a value after a delay
 */
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export default async function asyncDouble(x) {
  await delay(10);
  return x * 2;
}
