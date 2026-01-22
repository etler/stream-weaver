/**
 * Creates a ReadableStream that counts from 0 to 5 on the server
 * Emits one number every 100ms (fast for SSR demo)
 * This will complete during SSR, showing the final accumulated result
 */
export default function createServerCountingStream(): ReadableStream<number> {
  let count = 0;

  return new ReadableStream({
    async start(controller) {
      while (count <= 5) {
        controller.enqueue(count);
        count++;

        if (count <= 5) {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      }
      controller.close();
    },
  });
}
