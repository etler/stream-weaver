// Core SSR
export { StreamWeaver } from "./StreamWeaver";

// Client
export { ClientWeaver } from "./client/ClientWeaver";

// Registry
export { WeaverRegistry } from "./registry/WeaverRegistry";

// Components
export { Suspense, type SuspenseProps } from "./components";

// Signals
export {
  defineSignal,
  defineReference,
  defineMutator,
  defineLogic,
  defineClientLogic,
  defineServerLogic,
  defineWorkerLogic,
  defineComputed,
  defineAction,
  defineHandler,
  defineComponent,
  defineNode,
  defineSuspense,
  defineReducer,
  PENDING,
} from "./signals";

export type {
  Signal,
  StateSignal,
  ReferenceSignal,
  MutatorSignal,
  LogicSignal,
  ComputedSignal,
  ActionSignal,
  HandlerSignal,
  ComponentSignal,
  NodeSignal,
  SuspenseSignal,
  ReducerSignal,
  AnySignal,
  Serializable,
} from "./signals";

// Signal interfaces for logic modules
export type { SignalMutator } from "./logic/signalInterfaces";

// SSR utilities
export { setSSRModuleLoader, clearSSRModuleLoader } from "./ssr";
export type { ModuleLoader } from "./ssr";

// Server logic execution
export { serializeSignalChain, executeFromChain, executeRemote } from "./logic/remoteExecution";
export type { SignalChain, SerializedSignal } from "./logic/remoteExecution";
export { preExecuteServerLogic } from "./logic/preExecuteServerLogic";
export { registerSignalsInTree } from "./registry/registerSignals";

// Worker execution
export { WorkerPool } from "./worker";

// Polyfills (side-effect import)
import "./polyfills/readableStreamFrom";
