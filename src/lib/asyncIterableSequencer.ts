type AnyIterable<T> = AsyncIterable<T> | Iterable<T>;

export function asyncIterableSequencer<T>(): {
  sequence: AsyncGenerator<T>;
  push: (iterator: AnyIterable<T> | null) => void;
} {
  let resolver: (iterator: AnyIterable<T> | null) => void;
  const next = (): AsyncGenerator<T> => {
    const { promise, resolve } = Promise.withResolvers<AnyIterable<T> | null>();
    resolver = (nextIterator) => {
      if (nextIterator !== null) {
        resolve(flatten(nextIterator, next()));
      } else {
        resolve(null);
      }
    };
    const generator = async function* () {
      const result = await promise;
      if (result !== null) {
        yield* result;
      }
    };
    return generator();
  };
  const push = (iterator: AnyIterable<T> | null): void => {
    resolver(iterator);
  };
  const sequence = next();
  return { sequence, push };
}

async function* flatten<T>(...iterators: AnyIterable<T>[]): AsyncGenerator<T> {
  for (const iterator of iterators) {
    yield* iterator;
  }
}
