# Stream Weaver: Technical Specification

## A Unified Isomorphic Natively Streaming UI Framework

## Executive Summary

Weaver is a novel streaming architecture that enables sequence order-preserving parallel streaming component rendering with minimal performance overhead allowing frameworks to capitalize on the latent efficiency provided by asynchronous parallel streams. It solves low level problems in current streaming frameworks by flattening async generators with an unresolved tail promise enabling unbounded async iterator chains that can be attached in real time, eliminating the need for complex stream and component orchestration while maintaining full parallelism.

## Problem Statement

Current streaming component architectures face a fundamental challenge with dynamic stream orchestration: The coordination of parallel work that expands during execution while maintaining sequential output for real-time consumption. Traditional approaches require knowing all work upfront and cannot elegantly handle recursive or nested work that emerges during processing, forcing a choice between pre-computing everything or implementing complex runtime coordination.

Existing approaches demonstrate these limitations in practice. React's Streaming Server Components require complex coordination between server and client boundaries, often resulting in layout shifts and memory accumulation as components resolve out of order. React Native's bridge coordination between JavaScript and native contexts creates performance overhead when managing dynamic component hierarchies. Similarly, traditional streaming coordination approaches often require buffering mechanisms or complex state management to maintain order during parallel processing. This creates memory overhead and coordination complexity for applications requiring real-time responsiveness.

The fundamental question becomes: How do you coordinate parallel work that discovers and spawns additional work during execution, while maintaining sequential output order for real-time consumption, without complex orchestration overhead?

## Solution Architecture

To explore that solution we require a low level queueing primitive that can enqueue entire streams as opposed to granular data points. This enables us to create stream encapsulations that can self coordinate through transform operations that can then self queue additional streams in the position it holds in the stream queue. With the ability to enqueue new asynchronous streaming work in the middle of a stream, we can create a higher level framework that orchestrates work planning strategies at the level of entire work streams as opposed to granular operations.

### Core Approach: Relay Pattern & Async Iterable Sequencers

To enable sequential processing of parallel streams, we need a method to enqueue entire streams as opposed to individual chunks of results. As streams can also implement the interface of an async iterable, this is possible by chaining together async iterables with async generators, ending with an unfulfilled async iterable promise that allows the existing generator to delegate to another async iterable.

In order to chain async iterables together, we define a **Relay Pattern** for leaving an unfulfilled promise at the end of an async iterable by using a flatten generator to flatten it with an unresolved promise as a tail entry. The unresolved promise allows the async generator to await on a promise for a new async iterable. The flatten generator ensures that a fulfilled async iterable promise will be yielded and delegated to, allowing it to take over as the next async iterable yielding new results when the chain has reached its reference.

The Relay Pattern is analogous to a relay race, where a racer represents an async iterable that is completed when the racer reaches the end of their stint. At this point they can pass along the baton to the next racer, who continues the chain. If there is no racer ready to take on the baton, the racer will await until a new racer is ready. The whole chain only ends when the final racer reaches the finish line.

We define the interface for this pattern as an **Async Iterable Sequencer** which provides a queue-like interface for adding new async iterables to the async iterable chain in a guaranteed sequence. The interface exposes a method for chaining additional async iterables to the chain or providing a termination signal to indicate no additional pending async iterators will be added.

The chain is managed by a stateful object, which keeps track of the chained unfulfilled async iterable tail promise resolver reference. The object is also responsible for ensuring a new tail promise will be flattened onto the chain and the resolver reference is updated with the new resolver to keep the generator open with an unfulfilled promise. When the promise is fulfilled the generator yields to delegate to the chained async iterable.

The object also exposes an async iterable interface allowing it to be consumed transparently and used in any context an async iterable is accepted. Because this approach does not require any underlying buffers, there is no additional memomory overhead for managing iterable output, and minimal memory overhead for managing the async iterable chain, giving it minimal memory overhead characteristics, only requiring it to retain references to iterables.

For Garbage Collection, the underlying iterable merging is performed via a standard `flatten` call which executes `yield*` and delegates the iteration to another iterator. After delegation, the `for await` generator loop ends and returns from the generator function to allow it and iterator references within `flatten` to be garbage collected.

```javascript
type AnyIterable<T> = AsyncIterable<T> | Iterable<T>;
type Generator<T> = AsyncGenerator<T, void, unknown>;

class AsyncIterableSequencer<T> implements AsyncIterable<T> {
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
    this.iterator = nextIterablePromiseGenerator();
  }

  push(iterator: AnyIterable<T> | null): void {
    this.resolve(iterator);
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
```

<small>[Implementation with tests: https://github.com/etler/async-iterable-sequencer](https://github.com/etler/async-iterable-sequencer)</small>

### Orchestration: Conductor Streams and Stream Weaver Frameworks

The **Async Iterable Sequencer** enables us to chain entire streams that implement the async iterator pattern together with an open ended chain. As streams maintain their own buffers they can process incoming data asyncronously and in parallel while being chained in a sequencer with their content pending consumption. This allows us to have parallel streams that can be consumed in a FIFO order on the async iterable chain.

This can be employed in a module that implements a transform stream interface that we define as a **Conductor Stream**. The transform callback of the conductor can be used to process the writable inbound stream to detect directives to invoke chaining other streams onto the outbound readable stream. Like a conductor, the Conductor Stream orchestrates streams by deciding how the streams should be sequenced.

The sequencer iterable can then be consumed in a detached asyncronous execution context and process the iterable chain to enqueue the output onto the outbound readable stream controller until it receives a terminate signal and completes at which point it can close the stream controller.

```typescript
type Chain<O> = AsyncIterableSequencer<O>["push"];

export interface ConductorStreamOptions<I, O> {
  start: (chain: Chain<O>) => void;
  transform: (chunk: I, chain: Chain<O>) => void;
  finish: (chain: Chain<O>) => void;
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
        start(chain);
      },
    });
    this.writable = new WritableStream<I>({
      write: (chunk) => {
        transform(chunk, chain);
      },
      close: () => {
        finish(chain);
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
```

<small>[Implementation with tests: https://github.com/etler/conductor-stream](https://github.com/etler/conductor-stream)</small>

Using a conductor stream we can produce a framework which we will define as a **Stream Weaver**. A weaver can expose a simplified abstraction framework around conductor streams to enable easier to implement design patterns for business logic. One such framework could be a component based framework that implements a custom `jsx` factory function that outputs element tags onto an underlying component scoped conductor stream as well as Child Components. Child component `jsx` calls can return an additional conductor stream to enable recursively chaining conductor streams to an arbitrary depth with the low level sequencer ensuring flattened and sequential output.

As the child component chains are also streams, this enables the parent component to continue to process the subsequent element tags and also enqueue them onto the iterator chain. Furthermore the parent component is unblocked to continue processing additional Child Component it encounters and chain those conductor streams as well. As the child components are returning streams, this allows the parent process to complete its execution without blocking while also allowing the child component streams to process in parallel allowing fully parallelized asyncronous processing of all components at any level of arbitrary depth.

### Patterns

#### Asyncronous Data Lookups

As the streams are asyncronous, they can await on external data sources they can use to populate rendered output. This has the caveat that any non streaming asyncronous requests would block the sequential output stream if the output stream has caught up with its output. In the case of local in cluster data lookups, this blocking time would be minimal in practice, only adding milliseconds of latency in most practical cases. However this blocking time could be significant if it is blocking on an out of cluster network request and incur external network latency. These cases could be mitigated however by skipping over those components and resolving them through another method.

#### Fallback Component Conductors

As the underlying async iterator chain returns promises on the iterator output, this allows us to use promise patterns to orchestrate the stream. In order to prevent unecessarily long blocking of the sequential chain output during non streaming pre-processing steps such as a database call, a race promise can be used to prevent any component from taking an overly long time even if it blocks on a lengthy external subroutine. The fallback promise winning the race could then produce unblocking fallback component content that can be used to resolve the fallback component back to the completed output at a later point.

When a child component loses the race it could then be enqueued onto a top level sequencer that is wraps the main content chain as tail content allowing the losing component stream to be resolved at the end of the stream after all other components have finished. Once the client receives the losing streams, they can be resolved in place of the fallback components.

#### Error Components

When a component encounters an error, instead of terminating the full stream, the component stream could be wrapped with a promise with a catch handler that returns an error fallback component. This would cause those components to be blocked until they are completed, however, it would not be possible to remove any partial content that was already streamed from a component that errors afterwards. With proper granularity the unblocked recursive component parallism would still produce efficiency gains.

It would be possible to apply component boundary markers around component streams to denote error boundaries that would to allow a client to recover in the event that the component stream content produces an error by rolling back the streamed changes to the previously encountered error boundary.

#### Seamless Client and Server Integration

As this all works over streams, there is no longer a barrier between client and serverside rendering. This approach enables all component interchange to work in an identical fashion, as a network call is simply a high latency stream. Streams can work identally whether run within a single execution context or done across any higher level interface providing a fully isomorphic architecture.

## Cross Execution Context Conductor Orchestration

Complex applications require coordination across multiple execution contexts such as server to client communication as well as other execution context barriers. Conductor output can be serialized at stream boundaries to bridge cross context gaps, and deserialized in the target execution context to extend the pattern to multi system contexts. As these cross context transports are also streams, they can also be consumed and chained onto Conductors managed by Weavers.

### Hydration

In the context of server to client communication, Server Weavers generate a virtual representation that can be transformed into serialized representations based on their content container format. On clients, pre-established deserialization routines can use these serialized streams to establish a Client Weaver context. Specifically for browsers, the browser already natively implements a deserialization routine for HTML and as script tags allow for arbitrary code execution, they can be used to establish Client Weaver contexts. Alternative deserialization methods may be used to enable hydration in any execution context enabling any system to act as a client including other servers.

On a browser, the initial raw HTML render stream is consumed by the browser to enable immediate rendering of server rendered components. The HTML render stream can also stream in `<script>` tags to allow browser clients to establish the client side execution context to initialize hydration, bundle resolution and fallback component reconciliation.

#### Server Weaver Execution Context
The Server Renderer Stream Weaver is responsible for rendering Virtual Component representations and establishing Client Weaver execution context initialization and any other execution context routines that may be desired. It should be noted that while a Client Weaver in most cases will be a Browser, this is not strictly the case and virtual representations of the various conductor outputs may be made generic enough so it could be serialized to establish context in any form of Client including other Servers.

* Hydration Conductor (Chains Hydration Representation)
* Component Conductor (Isomorphic Virtual Component Representation)
* Fallback Component Conductor (Chains Fallback Components)
* Bundle Conductor (Establishes Bundle Resolution for Code Module and Asset Bundles)

#### Server Output Stream Browser Serializer
In the case of a Brower Client, Browser specific serializers can be used to transform the virtual stream representations into serialized HTML that can be natively deserialized by a Browser. To establish the site wrapper and execution context, Hydration representations can be serialized into `<html>`, `<head>`, `<body>`, and `<script>` tags with the script tags used to initialize the execution context of a Client Weaver. Virtual Components can be serialized into standard HTML and streamed in natively and rendered immediately. At the end of the HTML component content, subsequent script tags can be serialized to perform additional specific tasks such as fallback reconciliation and asset bundle resolution.

* Hydration Stream HTML Serializer (Conversion to HTML Wrapper Context and Script and Metadata Tag Management)
* Component Stream HTML Serializer (Conversion to HTML)
* Fallback Component Stream HTML Serializer (Conversion to HTML)
* Bundle Representation HTML Serializer (Converts to HTML Script Tags and Loading Strategies)

#### Browser Stream Deserializer
Browser Stream Deserialization is actually simply standard browser HTML stream parsing and rendering and no special implementation is needed (or possible). The serialized content from the Server Weaver Serialization comes in the form of HTML tags, and hydration, reconciliation, and bundling is performed via the execution of serialized script tags from the Server serialization stream.

* Browser HTML Deserialization (Natively parsed by the Browser and Displayed Immediately)
* Hydration Stream Content Script Deserialization (Establishes Weaver Script Execution Context and Primary Conductor)
* Fallback Component Script Deserialization (Chains Reconciliation Conductors onto the Weaver Conductor)
* Bundle Script Deserialization (Chains Bundle Representations onto the Weaver Conductor to Ensure Dependency Execution Context Availability)

#### Browser Client Weaver Execution Context
After the Browser Client Weaver is initialized and has established the primary Conductor and processed the Hydration Conduction setup, it can stablize into an event loop, leaving an Interaction Conductor permanently unclosed at the end of the conductor chain to accept and evaluate DOM interaction events. These events can be transformed to trigger additional conductors to perform State, Component, and Lifecycle stream  to update the application state and DOM state, and trigger any component lifecycle events needed. As the Interaction Conductor is conducting conductors onto the consumptions side of iteration, it can leave itself unclosed to continue to chain user events for evaluation as soon as the chained conductors have finished evaluation.

* Interaction Conductor (Unresolved Tail Conductor That Evaluates Chained Interation Events to Conducts State Conductors Onto the Consumption Stream while remaining unclosed at the end of the chain)
* State Conductor (State Action Reducer That Updates Application State and Chains Subscribed Component Conductors)
* Component Conductors (Isomorphic Virtual Component Representation that Renders a Component and triggers a Lifecycle Conductor)
* Component Stream DOM Serializer (Conversion to DOM instance)
* Bundle Conductor (Realtime Bundle Resolution when needed)
* Lifecycle Conductor (Triggers component hydration, mounting, painting, and other lifecycle events)
* Reconciliation Conductor (Reconciles Fallback Components with rendered delayed components)

#### Client Output Stream Serializer
As the client weaver also produces a consumption stream, that consumption stream can also be consumed elsewhere. The stream could be written back to a server for seamless state syncronization and server database update pipelines with another serialization stream to be consumed by ther server.

* Event Stream Serializer (Conversion of Events to JSON or other Message Format for Consumption by a Remote Consumer)

#### Server Input Stream Deserializer
* Event Stream Deserializer (Conversion of Event JSON to Events)
* Event Conductor (Conducts Actions Based on Events)
* Event Transaction Serializer (Execution of Events into Transactions such as Persistent Storage)

### Session Weaver Execution Context
An ongoing session weaver can be recieve serialized server stream updates with a Message Conductor to push serverside messaging events to established client weaver Message Conductor Stream connections to provide real time updates.

* Messaging Conductor (Conducts Messages based on actions triggered from an external source)
* Messaging Serializer (Converts Messages to JSON or other Message Format for Consumption by a Remote Client Consumer)
* Messaging Deserializer (Recieves Messages on the Client from the Session Weaver and Conducts them as Events on the Event Tail Chain)

### Merging Parallel Conductor Chains

Parallel Conductor Chains could be consumed using a Merge Stream to enable specialized conductors with independent concerns to open multiple open chains to process different kinds of data at the same time. This enables fore-planning for different kinds of decoupled operations that can be combined at the merge point. This could be used to enable multiple modes of input, for example you can maintain an open Interaction Conductor for UI Events while also maintaining a Fallback Conductor to pull slow component renders out of the main stream, as well as a Message Conductor to communicate with a remote Server Session Weaver to receive asyncronous server side push messages.

## Syncronous Consumption of Parallel Streams

Streamed Components are still components they essentially fallback to being a standard asyncronous component allowing existing patterns to still work, however, maybe we can do better?

With a natively streaming first framework architecture, it potentially opens up the opportunity to also apply additional streaming patterns to other areas as well, as guaranteed sequential stream order allows the necessary stream dependencies to be resolved in the proper order.

### Guaranteed Consumption Order

You can essentialy treat the iterator chain as an execution queue, ensuring execution order of blocking commands. The render conductor can chain to a component lifecycle conductor which chains to a an UI event stream interaction conductor which chains to a state conductor which chains back to a lifecycle conductor which can chain additional render streams and so forth. Placeholder conductors can be chained for execution even if they don't get used, allowing you to chain any amount of interaction conductors at points in the plan where they are valid for consumption, and new UI events can be chained onto the last interaction conductor on the stream.

You are basically writing out a plan in real time and letting execution order happen at consumption time letting you write out the plan in parallel and at multiple depth levels.

### Enabling Asyncronous Stream Planning in Syncronous Patterns

Since streams can be chained to the sequencer in any execution context at any time, weavers can implement synchronous handlers that allow business logic to be written using familiar procedural code. This is actually preferable as it produces more predictable plan construction when chaining additional streams. Business logic developers implementing code in synchronous handlers need not be exposed to the underlying streaming implementation details and can be given wrapper objects that encapsulate the business logic domain from the orchestration tier.

This approach inverts the typical streaming framework pattern where developers must learn complex async coordination patterns. Instead, advanced streaming capabilities are provided transparently while developers work with predictable, synchronous interfaces.

## Parallel Recursive Agent Swarms

The same patterns can be used to enable parallel and recursive execution of non context generating streaming sub agents. The common current approach to enable streaming agents to spawn sub agents to perform a more specific task is to use a blocking tool call to introduce new content into the output stream. While the tool call can still be streamed in, it would still block the main agent from generating additional content. In the case that the generated sub agent content is needed in the parent agent context window, this is a necessity. However, there are many instances where the parent agent does not need the context from a sub agent's execution.

In those cases the sequential parallel streams enabled by the relay pattern can allow a main agent to spawn a child section sub agent to generate new content while the parent agent continues to generate additional content and spawn additional child agents. As this can be done recursively, this allows for massively parallelized agent swarms to simultaneously generate content at multiple levels of context and specificity at the same time.

After the main agent spawns the first child agent, it will have enqueued additional content that will be ready to be stream immediately as soon as the first child agent finishes and the stream chain swaps back to the main agent. As the main agent may have also spawned a second parallel child agent while the first child agent was generating, it's also possible that subsequent child agents will also have finished generating content by the time the first child agent has completed allowing the full enqueued output stream content to be streamed at the maximum rate allowed. As AI content generation has a much lower throughput than traditionally rendered components, this potentially enables massive performance gains by allowing work to be parallelized without sacrificing streaming output.

### Patterns

#### Context Management

Sub agents don't necessarily have to lose newly generated context from the parent agent. Content generated by a parent agent could be duplicated onto a parallel stream and passed to the child agent ensuring it has the full context as the parent, as well as passing in the original parent context traditionally. Parent content directives may also include a wrapper around specific sub agent context content that can specifically instruct the sub agent on what it should do.

#### Specialized Prompt Specificity

A major issue with existing AI prompting patterns is that it requires adding a large amount of specific instructions into a single context window to enable complex behavior. However this has a tendency to overwhelm the agents and degrade its ability to perform any one task. The recursive parallel approach effectively makes this a non problem as the sub agents can be provided with specialized prompts with greater specificity to enable it to excel at a specific task, while the parent agents can be provided with more focused prompts to perform orchestration tasks, freeing up valuable context window space to enable more advanced behavior for more specific sub tasks.

#### AI Model Performance Fine Tuning

AI Models may be tailored to the task that best suit their performance characteristics. A less capable but fast AI model could be used at the top level to do simple high level templating to initialize broad parallelization of the answer generation early in the AI content generation flow.

#### Multi Modal AI and Component Stream Composition

A Weaver framework does not have to choose between employing components, or AI, or any other kind of content. AI and traditional rendering can be combined to enable a best of both words solution and providing powerful deep integration of AI generated content and AI orchestrated content rendering by swapping between having agents choose what directives to produce and mixing the recursive composition with both AI and traditional rendering, removing any boundaries between AI generated content and traditionally rendered content and client managed AI streams and framework rendered components and server rendered content.

## Further Considerations

### Stack Trace Conductors

Since conductor streams can be chained to the sequencer alongside content conductors, a Stack Trace Conductors can conceivably be integrated directly into the execution plan to provide stack boundaries for debugging capabilities. Stack Trace Conductors could track execution plan state by chaining debugging metadata through the sequencer that can be reduced to determine the current location in the stream plan, enabling visibility into conductor nesting. This approach would provide execution plan introspection that traditional stack traces cannot offer, as the sequential consumption pattern ensures execution stack position is consumed in the same deterministic order as content execution.

### Stream Robustness

Local conductor streams operate in predictable execution environments without the failure modes inherent to network streams, eliminating concerns about connection drops, timeouts, and network partitions that commonly trigger failures in traditional streaming contexts. For conductor streams that interact with fragile external resource streams, error boundaries can be placed around individual conductors to isolate failures and prevent catastrophic stream termination. This granular error isolation ensures that a single conductor failure cannot terminate the entire execution plan, while the sequential consumption pattern guarantees that error recovery mechanisms are processed in deterministic order alongside content streams.

### Cross-execution Context Coordination

Applications often require complex coordination between different execution contexts. This can include separate processes, threads, runtimes, or network boundaries, creating performance bottlenecks and race conditions during state synchronization and component interactions. The Stream Weaver architecture can also be applied in these situations to eliminate these coordination complexities by implementing execution context specific conductor streams that orchestrate updates through the same sequential consumption pattern regardless of execution boundaries. For example, React Native's JavaScript and native platform coordination can be solved by implementing native components as conductor streams that chain seamlessly with JavaScript component streams, ensuring deterministic update ordering across execution boundaries while maintaining parallelism within each context. This approach transforms cross-context coordination from complex orchestration problems into unified streaming coordination architectures where execution context differences become implementation details rather than architectural barriers.

### Deterministic Ordering of Stream Consumption to Enable Caching Strategies

The Stream Weaver architecture enables deterministic consumption ordering which can unlock advanced caching strategies impossible with non-deterministic streaming approaches. This can be achieved by replacing race-based coordination patterns with deterministic blocking strategies to find a tradeoff between immediate consumption unblocking and determinism.

It should be re-iterated, that any consumption side blocking would not prevent production side parallelism and when a consumption blocking component completes, any downchain components that have completed in that time would be fully unblocked to be streamed.

This could be achieved by distinguishing between components that should first paint block and components that should always produce a suspense. This could simply be denoted by having async components default to being paint blocking while suspense components always get enqueued after the HTML paint stream in a deterministic order. Fast components such as in cluster db data dependent components could be treated as paint blocking as they are fast, while any network blocking components could be denoted as non blocking.

To balance determinism with performance flexibility, it would be possible to split the suspense component stream into a second stream that is established after client Weaver initialization to be processed in parallel, allowing that secondary stream to provide non-deterministic ordering for added performance while the html paint stream maintains deterministic order for caching.

## Conclusion: Orchestrating Applied Stream Sequencing

Stream sequencing allows anything to be planned out and consumed like a syncronous operation because it makes the consumption sequential, allowing standard easy to understand sequential patterns to be applied to a stream chain that can be dynamically and recursively built without compromising parallelism.

The chain can simply focus on conducting the plan and the plan can be developed in real time by multiple encapsulated sub routines, agents, or any other content producing method with an interface exposed to inject those newly generated plans in place. This allows the plan to be generated in parallel at any depth with guaranteed sequential ordering to ensure dependencies are resolved in the order needed.

## Appendix

### Related Work

* Sam Thorogood, ["Async Generators for User Input"](https://samthor.au/2020/async-generators-input/), April 2020 Blog.<br/>
  Retrieved July 18, 2025 from https://samthor.au/2020/async-generators-input/
  * An implementation of an async event generator with an unresolved tail promise and an internal queue while researching prior art to check if the pattern had been implemented prior. While this pattern uses unresolved tail promises generated after enqueuing, it does not implement an iterator chain of iterators.
