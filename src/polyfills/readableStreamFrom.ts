/**
 * Polyfill for ReadableStream.from()
 * Required for Chrome/Safari which don't yet support this static method
 * Firefox supports it natively
 */

// Extend ReadableStream interface to include the from method
declare global {
  interface ReadableStreamConstructor {
    from<T>(iterable: Iterable<T> | AsyncIterable<T>): ReadableStream<T>;
  }
  // eslint-disable-next-line no-var
  var ReadableStream: ReadableStreamConstructor & {
    prototype: ReadableStream;
    new <R = unknown>(underlyingSource?: UnderlyingSource<R>, strategy?: QueuingStrategy<R>): ReadableStream<R>;
  };
}

// Only add polyfill if ReadableStream.from doesn't exist
if (typeof ReadableStream !== "undefined" && ReadableStream.from === undefined) {
  ReadableStream.from = function <T>(iterable: Iterable<T> | AsyncIterable<T>): ReadableStream<T> {
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
