import { AsyncIterableSequencer } from "@/lib/AsyncIterableSequencer";

type Chain<O> = AsyncIterableSequencer<O>["push"];

export interface ConductorStreamOptions<I, O> {
  start?: (chain: Chain<O>) => void;
  transform: (chunk: I, chain: Chain<O>) => void;
  finish?: (chain: Chain<O>) => void;
}

export class ConductorStream<I, O> {
  public readable: ReadableStream<O>;
  public writable: WritableStream<I>;

  constructor({ start, transform, finish }: ConductorStreamOptions<I, O>) {
    const sequencer = new AsyncIterableSequencer<O>();
    const chain = sequencer.push.bind(sequencer);
    let maybeController: ReadableStreamDefaultController<O> | undefined;
    this.readable = new ReadableStream<O>({
      start: (controller) => {
        maybeController = controller;
        start?.(chain);
      },
    });
    this.writable = new WritableStream<I>({
      write: (chunk) => {
        transform(chunk, chain);
      },
      close: () => {
        finish?.(chain);
      },
    });
    if (maybeController === undefined) {
      throw new Error("Stream controller could not be resolved");
    }
    const controller = maybeController;
    (async () => {
      for await (const item of sequencer) {
        controller.enqueue(item);
      }
      controller.close();
    })().catch((error: unknown) => {
      controller.error(error);
    });
  }
}
