import { chunkify } from "@/ComponentDelegate/chunkify";
import { tokenize } from "@/ComponentDelegate/tokenize";
import { Token, SuspenseExecutable } from "@/ComponentDelegate/types/Token";
import { DelegateStream } from "delegate-stream";
import { Node } from "@/jsx/types/Node";
import { WeaverRegistry } from "@/registry/WeaverRegistry";
import { ComponentElement } from "@/jsx/types/Element";
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
              // NodeExecutable - execute via SignalDelegate, then continue tokenizing result
              if (reg) {
                executeViaSignalDelegate(chunk.node.id, chain, reg, nodeToTokens(reg));
              }
            } else if (chunk.kind === "computed-executable") {
              // ComputedExecutable - execute via SignalDelegate, emit as text token
              if (reg) {
                executeViaSignalDelegate(chunk.computed.id, chain, reg, computedToToken);
              }
            } else {
              // SuspenseExecutable - process children, check PENDING, emit tokens directly
              executeSuspenseSignal(chunk, chain, reg);
            }
          } else {
            // ComponentElement (function component) - execute directly
            const delegate = new ComponentDelegate(reg);
            const writer = delegate.writable.getWriter();
            chain(delegate.readable);
            executeComponentElement(chunk, writer);
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
 * Execute a function component and write its output
 */
function executeComponentElement(component: ComponentElement, writer: WritableStreamDefaultWriter<Node>): void {
  (async () => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const { type, props } = component;
    const node = await type(props);
    await writer.write(node);
    await writer.close();
  })().catch((error: unknown) => {
    console.error(new Error("Component Render Error", { cause: error }));
  });
}

type ChainFn = (input: Iterable<Token> | AsyncIterable<Token> | null) => void;
type TransformFn = (value: unknown, innerChain: ChainFn) => void;

/**
 * Execute a signal via SignalDelegate and transform the result.
 * SignalDelegate handles execution; transformFn converts result to tokens.
 */
function executeViaSignalDelegate(
  signalId: string,
  chain: ChainFn,
  registry: WeaverRegistry,
  transformFn: TransformFn,
): void {
  const signalDelegate = new SignalDelegate(registry);

  const transformer = new DelegateStream<SignalToken, Token>({
    transform: (event, innerChain) => {
      transformFn(event.value, innerChain);
    },
    finish: (innerChain) => {
      innerChain(null);
    },
  });

  void signalDelegate.readable.pipeTo(transformer.writable);
  chain(transformer.readable);

  const writer = signalDelegate.writable.getWriter();
  void writer.write({ kind: "execute-signal", id: signalId }).then(async () => writer.close());
}

/** Transform computed value to text token */
function computedToToken(value: unknown, innerChain: ChainFn): void {
  // eslint-disable-next-line @typescript-eslint/no-base-to-string
  const textContent = value === PENDING ? "" : String(value ?? "");
  innerChain([{ kind: "text", content: textContent }]);
}

/** Transform node value through ComponentDelegate for tokenization */
function nodeToTokens(registry: WeaverRegistry): TransformFn {
  return (value, innerChain) => {
    if (value !== PENDING) {
      const componentDelegate = new ComponentDelegate(registry);
      innerChain(componentDelegate.readable);
      const writer = componentDelegate.writable.getWriter();
      // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
      void writer.write(value as Node).then(async () => writer.close());
    }
  };
}

/**
 * Execute SuspenseSignal: accumulate children, check for PENDING, emit fallback or flush children.
 * Bind markers are handled by tokenize - this only emits children signal-defs + content.
 */
function executeSuspenseSignal(executable: SuspenseExecutable, chain: ChainFn, registry?: WeaverRegistry): void {
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
