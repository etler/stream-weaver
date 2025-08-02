import { asyncIterableSequencer, Chain } from "@/lib/asyncIterableSequencer";

export interface ConductorStreamOptions<I, O> {
  start?: (chain: Chain<O>) => void;
  transform: (chunk: I, chain: Chain<O>) => void;
  finish?: (chain: Chain<O>) => void;
}

export class ConductorStream<I, O> {
  public readable: ReadableStream<O>;
  public writable: WritableStream<I>;

  constructor({ start, transform, finish }: ConductorStreamOptions<I, O>) {
    const { sequence, chain } = asyncIterableSequencer<O>();
    this.readable = ReadableStream.from<O>(sequence);
    this.writable = new WritableStream<I>({
      write: (chunk) => {
        transform(chunk, chain);
      },
      close: () => {
        finish?.(chain);
      },
    });
    start?.(chain);
  }
}
