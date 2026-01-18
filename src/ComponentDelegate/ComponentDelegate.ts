import { chunkify } from "@/ComponentDelegate/chunkify";
import { tokenize } from "@/ComponentDelegate/tokenize";
import { Token, NodeExecutable } from "@/ComponentDelegate/types/Token";
import { DelegateStream } from "delegate-stream";
import { Node } from "@/jsx/types/Node";
import { WeaverRegistry } from "@/registry";
import { ComponentElement } from "@/jsx/types/Element";
import { loadSSRModule } from "@/ssr";

export class ComponentDelegate extends DelegateStream<Node, Token> {
  constructor(registry?: WeaverRegistry) {
    // Capture registry in closure for use in transform function
    const reg = registry;

    super({
      transform: (node, chain) => {
        const chunks = chunkify(tokenize(node, reg));
        for (const chunk of chunks) {
          if (Array.isArray(chunk)) {
            // Token array - emit directly
            chain(chunk);
          } else if ("kind" in chunk) {
            // NodeExecutable - load and execute component
            const delegate = new ComponentDelegate(reg);
            const writer = delegate.writable.getWriter();
            chain(delegate.readable);
            executeNodeSignal(chunk, writer, reg);
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
