/**
 * Polyfill for ReadableStream.from()
 * Required for Chrome/Safari which don't yet support this static method
 * Firefox supports it natively
 */

// Check if polyfill is needed and add it
if (
  typeof ReadableStream !== "undefined" &&
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-type-assertion
  (ReadableStream as any).from === undefined
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-type-assertion
  (ReadableStream as any).from = function <T>(iterable: Iterable<T> | AsyncIterable<T>): ReadableStream<T> {
    // Check if it's an async iterable
    const isAsyncIterable = (obj: Iterable<T> | AsyncIterable<T>): obj is AsyncIterable<T> => {
      return Symbol.asyncIterator in obj;
    };

    if (isAsyncIterable(iterable)) {
      const iterator = iterable[Symbol.asyncIterator]();
      return new ReadableStream<T>({
        async pull(controller) {
          const result = await iterator.next();
          if (result.done === true) {
            controller.close();
          } else {
            controller.enqueue(result.value);
          }
        },
      });
    } else {
      const iterator = iterable[Symbol.iterator]();
      return new ReadableStream<T>({
        pull(controller) {
          const result = iterator.next();
          if (result.done === true) {
            controller.close();
          } else {
            controller.enqueue(result.value);
          }
        },
      });
    }
  };
}

export {};
