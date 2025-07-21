type AnyIterable<T> = AsyncIterable<T> | Iterable<T>;
type Generator<T> = AsyncGenerator<T, void, unknown>;

export class AsyncIterableSequencer<T> implements AsyncIterable<T> {
  private resolve: (iterator: AnyIterable<T> | null) => void;
  private iterator: AsyncGenerator<T, void, unknown>;
  constructor() {
    const nextIterablePromiseGenerator = (): Generator<T> => {
      const promise = new Promise<AnyIterable<T> | null>((resolve) => {
        this.resolve = (nextIterator) => {
          if (nextIterator !== null) {
            resolve(flatten(nextIterator, nextIterablePromiseGenerator()));
          } else {
            resolve(null);
          }
        };
      });
      return (async function* () {
        const result = await promise;
        if (result !== null) {
          yield* result;
        }
      })();
    };
    this.resolve = () => {
      throw new Error("IterableSequencer used before initialization");
    };
    this.iterator = nextIterablePromiseGenerator();
  }

  push(iterator: AnyIterable<T> | null): void {
    this.resolve(iterator);
  }

  async next(): Promise<IteratorResult<T>> {
    return this.iterator.next();
  }

  async throw(error?: unknown): Promise<IteratorResult<T>> {
    return this.iterator.throw(error);
  }

  [Symbol.asyncIterator](): Generator<T> {
    return this.iterator;
  }
}

async function* flatten<T>(...iterators: AnyIterable<T>[]): Generator<T> {
  for (const iterator of iterators) {
    yield* iterator;
  }
}
