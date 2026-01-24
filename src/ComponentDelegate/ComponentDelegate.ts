import { chunkify } from "@/ComponentDelegate/chunkify";
import { tokenize } from "@/ComponentDelegate/tokenize";
import { Token, NodeExecutable, ComputedExecutable, SuspenseExecutable } from "@/ComponentDelegate/types/Token";
import { DelegateStream } from "delegate-stream";
import { Node } from "@/jsx/types/Node";
import { WeaverRegistry } from "@/registry/WeaverRegistry";
import { ComponentElement } from "@/jsx/types/Element";
import { loadSSRModule } from "@/ssr";
import { executeComputed } from "@/logic/executeComputed";
import { executeSuspense } from "@/logic/executeSuspense";
import { PENDING } from "@/signals/pending";
import { serializeElement } from "@/ComponentSerializer/serialize";

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
              // NodeExecutable - load and execute component
              const delegate = new ComponentDelegate(reg);
              const writer = delegate.writable.getWriter();
              chain(delegate.readable);
              executeNodeSignal(chunk, writer, reg);
            } else if (chunk.kind === "computed-executable") {
              // ComputedExecutable - execute server-context computed signal
              const delegate = new ComponentDelegate(reg);
              const writer = delegate.writable.getWriter();
              chain(delegate.readable);
              executeComputedSignal(chunk, writer, reg);
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

/**
 * Execute a server-context computed signal and emit the result as text
 */
function executeComputedSignal(
  executable: ComputedExecutable,
  writer: WritableStreamDefaultWriter<Node>,
  registry?: WeaverRegistry,
): void {
  (async () => {
    if (!registry) {
      await writer.close();
      return;
    }

    const { computed } = executable;

    // Execute the computed signal (this handles server-context and worker-context logic)
    await executeComputed(registry, computed.id);

    // Get the result
    const value = registry.getValue(computed.id);

    // Emit the value as text (PENDING values become empty string)
    // eslint-disable-next-line @typescript-eslint/no-base-to-string
    const textContent = value === PENDING ? "" : String(value ?? "");
    await writer.write(textContent);
    await writer.close();
  })().catch((error: unknown) => {
    console.error(new Error("ComputedSignal Execution Error", { cause: error }));
    writer.close().catch(() => {
      // Ignore close errors
    });
  });
}

/** Collect all tokens from processing a node through ComponentDelegate */
async function collectTokens(node: Node, registry: WeaverRegistry): Promise<Token[]> {
  const delegate = new ComponentDelegate(registry);
  const writer = delegate.writable.getWriter();
  const tokens: Token[] = [];
  const readerPromise = (async () => {
    for await (const token of delegate.readable) {
      tokens.push(token);
    }
  })();
  await writer.write(node);
  await writer.close();
  await readerPromise;
  return tokens;
}

type ChainFn = (input: Iterable<Token> | AsyncIterable<Token> | null) => void;

/**
 * Execute SuspenseSignal. Unlike other executables that write a single Node,
 * Suspense needs to emit multiple token sequences whose content depends on
 * async processing results, requiring an async generator.
 */
function executeSuspenseSignal(executable: SuspenseExecutable, chain: ChainFn, registry?: WeaverRegistry): void {
  if (!registry) {
    return;
  }
  const reg = registry;

  chain(
    (async function* (): AsyncGenerator<Token> {
      const { suspense, children, fallback } = executable;

      // Process children to check for PENDING
      const childrenTokens = await collectTokens(children, reg);
      const result = executeSuspense(reg, suspense, childrenTokens);

      // Children signal defs must come first when showing fallback
      if (result.showFallback) {
        yield* childrenTokens.filter((token) => token.kind === "signal-definition");
      }

      yield { kind: "signal-definition", signal: suspense };
      yield { kind: "bind-marker-open", id: suspense.id };

      if (result.showFallback) {
        yield* await collectTokens(fallback, reg);
      } else {
        yield* childrenTokens;
      }

      yield { kind: "bind-marker-close", id: suspense.id };
    })(),
  );
}

/**
 * Execute a NodeSignal component by loading its module and calling it with props
 */
function executeNodeSignal(
  executable: NodeExecutable,
  writer: WritableStreamDefaultWriter<Node>,
  registry?: WeaverRegistry,
): void {
  (async () => {
    const { node, logic } = executable;

    // Load the component module
    // Use src (absolute path) - the SSR module loader will convert to Vite-friendly format
    const moduleSrc = logic.src;

    let module: unknown;
    try {
      // Use the SSR module loader (e.g., Vite's ssrLoadModule)
      // Falls back to direct import if no loader is configured
      module = await loadSSRModule(moduleSrc);
    } catch {
      // Module loading failed (common during SSR with URL paths)
      // Close the writer and return - client will hydrate the component
      console.warn(`SSR: Could not load component module ${moduleSrc}, will hydrate on client`);
      await writer.close();
      return;
    }

    // Get the component function (default export)
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
    const componentFn = (module as { default: unknown }).default as
      | ((props: Record<string, unknown>) => Node | Promise<Node>)
      | undefined;

    if (typeof componentFn !== "function") {
      console.warn(`Component module ${moduleSrc} does not have a default export function`);
      await writer.close();
      return;
    }

    // Prepare props - convert signal references to signal objects with value getters
    const propsWithSignals: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(node.props)) {
      if (registry && typeof value === "object" && value !== null && "id" in value && "kind" in value) {
        // This is a signal - create a proxy that reads from registry
        // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
        const signalId = (value as { id: string }).id;
        propsWithSignals[key] = {
          ...value,
          get value() {
            return registry.getValue(signalId);
          },
          set value(newValue: unknown) {
            registry.setValue(signalId, newValue);
          },
        };
      } else {
        propsWithSignals[key] = value;
      }
    }

    // Execute the component
    const result = await componentFn(propsWithSignals);

    // Write the result to continue processing
    await writer.write(result);
    await writer.close();
  })().catch((error: unknown) => {
    console.error(new Error("NodeSignal Render Error", { cause: error }));
    // Ensure writer is closed even on error
    writer.close().catch(() => {
      // Ignore close errors
    });
  });
}
