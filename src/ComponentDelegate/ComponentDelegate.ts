import { chunkify } from "@/ComponentDelegate/chunkify";
import { tokenize } from "@/ComponentDelegate/tokenize";
import { Token, SuspenseExecutable } from "@/ComponentDelegate/types/Token";
import { DelegateStream } from "delegate-stream";
import { Node } from "@/jsx/types/Node";
import { WeaverRegistry } from "@/registry/WeaverRegistry";
import { SignalDelegate } from "@/SignalDelegate/SignalDelegate";
import { SignalToken } from "@/SignalDelegate/types";
import { PENDING } from "@/signals/pending";
import { serializeElement, serializeTokenArray } from "@/ComponentSerializer/serialize";

export class ComponentDelegate extends DelegateStream<Node, Token> {
  constructor(registry?: WeaverRegistry) {
    // Capture registry in closure for use in transform function
    const reg = registry;

    super({
      transform: (node, chain) => {
        // Fast path: try direct serialization for sync subtrees
        const html = serializeElement(node, reg);
        if (html !== null) {
          // Sync subtree - emit pre-serialized HTML directly
          chain([{ kind: "raw-html", content: html }]);
          return;
        }

        // Slow path: tokenize and process chunks (has async content)
        const chunks = chunkify(tokenize(node, reg));
        for (const chunk of chunks) {
          if (Array.isArray(chunk)) {
            // Token array - emit directly
            chain(chunk);
          } else if ("kind" in chunk) {
            if (chunk.kind === "node-executable") {
              // NodeExecutable - execute via SignalDelegate, tokenize result through ComponentDelegate
              if (reg) {
                const signalDelegate = new SignalDelegate(reg);
                const tokenizer = new NodeTokenizer(reg);
                void signalDelegate.readable.pipeTo(tokenizer.writable);
                chain(tokenizer.readable);
                const writer = signalDelegate.writable.getWriter();
                void writer.write({ kind: "execute-signal", id: chunk.node.id }).then(async () => writer.close());
              }
            } else if (chunk.kind === "computed-executable") {
              // ComputedExecutable - execute via SignalDelegate, emit as text token
              if (reg) {
                const signalDelegate = new SignalDelegate(reg);
                // Transform: signal-update → text token
                const tokenStream = signalDelegate.readable.pipeThrough(
                  new TransformStream<SignalToken, Token>({
                    transform(event, controller) {
                      // eslint-disable-next-line @typescript-eslint/no-base-to-string
                      const text = event.value === PENDING ? "" : String(event.value ?? "");
                      controller.enqueue({ kind: "text", content: text });
                    },
                  }),
                );
                chain(tokenStream);
                const writer = signalDelegate.writable.getWriter();
                void writer.write({ kind: "execute-signal", id: chunk.computed.id }).then(async () => writer.close());
              }
            } else {
              // SuspenseExecutable - process children, check PENDING, emit tokens directly
              resolveSuspenseSignal(chunk, chain, reg);
            }
          } else {
            // ComponentElement (function component) - call and tokenize result
            const delegate = new ComponentDelegate(reg);
            chain(delegate.readable);
            const writer = delegate.writable.getWriter();
            (async () => {
              const node = await chunk.type(chunk.props);
              await writer.write(node);
              await writer.close();
            })().catch((error: unknown) => {
              console.error(new Error("Component Render Error", { cause: error }));
            });
          }
        }
      },
      finish: (chain) => {
        chain(null);
      },
    });
  }
}

/**
 * Transforms signal-update events into tokens by passing Node values through ComponentDelegate.
 * Used to tokenize the result of NodeSignal execution.
 */
class NodeTokenizer extends DelegateStream<SignalToken, Token> {
  constructor(registry: WeaverRegistry) {
    super({
      transform: (event, chain) => {
        if (event.value !== PENDING) {
          const componentDelegate = new ComponentDelegate(registry);
          chain(componentDelegate.readable);
          const writer = componentDelegate.writable.getWriter();
          // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
          void writer.write(event.value as Node).then(async () => writer.close());
        }
      },
      finish: (chain) => {
        chain(null);
      },
    });
  }
}

type ChainFn = (input: Iterable<Token> | AsyncIterable<Token> | null) => void;

/**
 * Resolve SuspenseSignal: accumulate children, check for PENDING, emit fallback or flush children.
 * Bind markers are handled by tokenize - this only emits children signal-defs + content.
 */
function resolveSuspenseSignal(executable: SuspenseExecutable, chain: ChainFn, registry?: WeaverRegistry): void {
  if (!registry) {
    return;
  }

  const { suspense, children, fallback } = executable;
  const reg = registry;

  // Output delegate that handles both token arrays and nodes
  const isTokenArray = (val: unknown): val is Token[] =>
    Array.isArray(val) && (val.length === 0 || (typeof val[0] === "object" && val[0] !== null && "kind" in val[0]));

  const output = new DelegateStream<Token[] | Node, Token>({
    transform: (input, innerChain) => {
      if (isTokenArray(input)) {
        innerChain(input);
      } else {
        const delegate = new ComponentDelegate(reg);
        innerChain(delegate.readable);
        const writer = delegate.writable.getWriter();
        void writer.write(input).then(async () => writer.close());
      }
    },
    finish: (innerChain) => {
      innerChain(null);
    },
  });

  chain(output.readable);
  const writer = output.writable.getWriter();

  (async () => {
    // 1. Process children and accumulate
    const childDelegate = new ComponentDelegate(reg);
    const childWriter = childDelegate.writable.getWriter();
    await childWriter.write(children);
    await childWriter.close();

    const buffer: Token[] = [];
    let hasPending = false;

    for await (const token of childDelegate.readable) {
      buffer.push(token);
      if (token.kind === "signal-definition" && reg.getValue(token.signal.id) === PENDING) {
        hasPending = true;
      } else if (token.kind === "bind-marker-open" && reg.getValue(token.id) === PENDING) {
        hasPending = true;
      }
    }

    // 2. Update suspense metadata (signal object is mutated before serialization)
    const pendingDeps = hasPending
      ? buffer
          .filter((tok): tok is Token & { kind: "signal-definition" } => tok.kind === "signal-definition")
          .filter((tok) => reg.getValue(tok.signal.id) === PENDING)
          .map((tok) => tok.signal.id)
      : [];
    suspense.pendingDeps = pendingDeps;
    // eslint-disable-next-line no-underscore-dangle
    suspense._childrenHtml = serializeTokenArray(
      buffer.filter((tok) => tok.kind !== "signal-definition"),
      false,
    );

    // 3. Emit children signal definitions (needed for client hydration)
    const signalDefs = buffer.filter((tok) => tok.kind === "signal-definition");
    await writer.write(signalDefs);

    // 4. Emit content: fallback Node or buffered children tokens
    if (hasPending) {
      await writer.write(fallback);
    } else {
      const contentTokens = buffer.filter((tok) => tok.kind !== "signal-definition");
      await writer.write(contentTokens);
    }

    await writer.close();
  })().catch((error: unknown) => {
    console.error(new Error("SuspenseSignal Execution Error", { cause: error }));
    writer.close().catch(() => {});
  });
}
