export type AnyIterable<T> = AsyncIterable<T> | Iterable<T>;
export type Chainable<T> = AnyIterable<T> | null;
export type Chain<T> = (iterator: Chainable<T>) => void;
export interface AsyncIterableSequencerReturn<T> {
  sequence: AsyncGenerator<T>;
  chain: Chain<T>;
}

export function asyncIterableSequencer<T>(): AsyncIterableSequencerReturn<T> {
  let resolver: Chain<T>;
  const next = (): AsyncGenerator<T> => {
    const { promise, resolve } = Promise.withResolvers<AnyIterable<T>>();
    resolver = (nextIterator) => {
      resolve(nextIterator ? flatten(nextIterator, next()) : empty());
    };
    const generator = async function* () {
      yield* await promise;
    };
    return generator();
  };
  return {
    sequence: next(),
    chain: (iterator) => {
      resolver(iterator);
    },
  };
}

async function* flatten<T>(...iterators: AnyIterable<T>[]): AsyncGenerator<T> {
  for (const iterator of iterators) {
    yield* iterator;
  }
}

function* empty() {}
