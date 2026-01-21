/**
 * Async action logic that increments a value after a delay
 */
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export default async function asyncIncrement(x) {
  await delay(10);
  x.value++;
}
