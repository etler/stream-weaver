/**
 * Creates a ReadableStream that counts from 0 to 10
 * Emits one number every 500ms
 */
export default function createCountingStream(): ReadableStream<number> {
  let count = 0;

  return new ReadableStream({
    async start(controller) {
      while (count <= 10) {
        controller.enqueue(count);
        count++;

        if (count <= 10) {
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      }
      controller.close();
    },
  });
}
