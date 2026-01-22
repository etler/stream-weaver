/**
 * Consumes a server counting stream and returns the final accumulated result
 * This blocks during SSR until the stream completes
 */
import createServerCountingStream from "./serverCountingStream";

export default async function consumeServerStream(): Promise<number[]> {
  const stream = createServerCountingStream();
  const result: number[] = [];

  // Iterate over the stream and accumulate values
  for await (const value of stream) {
    result.push(value);
  }

  return result;
}
