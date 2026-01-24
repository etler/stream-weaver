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

type ChainFn = (input: Iterable<Token> | AsyncIterable<Token> | null) => void;

/** Execute SuspenseSignal - process children, check PENDING, emit tokens via chain */
function executeSuspenseSignal(executable: SuspenseExecutable, chain: ChainFn, registry?: WeaverRegistry): void {
  if (!registry) {
    return;
  }

  const reg = registry; // Capture for closure

  // Use async generator to yield tokens as they're ready
  async function* generateTokens(): AsyncGenerator<Token> {
    const { suspense, children, fallback } = executable;

    // Create a sub-delegate to process children
    const childDelegate = new ComponentDelegate(reg);
    const childWriter = childDelegate.writable.getWriter();

    // Collect tokens from the child delegate
    const collectedItems: unknown[] = [];
    const readerPromise = (async () => {
      const reader = childDelegate.readable.getReader();
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }
        collectedItems.push(value);
      }
    })();

    await childWriter.write(children);
    await childWriter.close();
    await readerPromise;

    // Flatten collected tokens
    const childrenTokens: Token[] = [];
    for (const item of collectedItems) {
      if (Array.isArray(item)) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
        childrenTokens.push(...(item as Token[]));
      } else if (typeof item === "object" && item !== null && "kind" in item) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
        childrenTokens.push(item as Token);
      }
    }

    // Analyze children for PENDING signals
    const result = executeSuspense(reg, suspense, childrenTokens);
    const childSignalDefs = childrenTokens.filter((token) => token.kind === "signal-definition");

    if (result.showFallback) {
      // Emit children's signal defs (for client tracking), then fallback content
      for (const def of childSignalDefs) {
        yield def;
      }
      yield { kind: "signal-definition", signal: suspense };
      yield { kind: "bind-marker-open", id: suspense.id };

      // Process fallback through a sub-delegate
      const fallbackDelegate = new ComponentDelegate(reg);
      const fallbackWriter = fallbackDelegate.writable.getWriter();
      const fallbackReader = fallbackDelegate.readable.getReader();
      await fallbackWriter.write(fallback);
      await fallbackWriter.close();
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      while (true) {
        const { done, value } = await fallbackReader.read();
        if (done) {
          break;
        }
        yield value;
      }

      yield { kind: "bind-marker-close", id: suspense.id };
    } else {
      // Emit children tokens directly
      yield { kind: "signal-definition", signal: suspense };
      yield { kind: "bind-marker-open", id: suspense.id };
      for (const token of childrenTokens) {
        yield token;
      }
      yield { kind: "bind-marker-close", id: suspense.id };
    }
  }

  chain(generateTokens());
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
