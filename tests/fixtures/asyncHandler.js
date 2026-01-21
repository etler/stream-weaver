/**
 * Async handler logic that sets a value to the event type after a delay
 */
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export default async function asyncHandler(e, x) {
  await delay(10);
  x.value = e.type;
}
