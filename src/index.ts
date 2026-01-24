// Core SSR
export { StreamWeaver } from "./StreamWeaver";

// Client
export { ClientWeaver } from "./client/ClientWeaver";

// Registry
export { WeaverRegistry } from "./registry/WeaverRegistry";

// Components
export { Suspense } from "./components";
export type { SuspenseProps } from "./components";

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
  createSuspense,
  defineReducer,
  PENDING,
} from "./signals";

export type {
  Signal,
  StateSignal,
  LogicSignal,
  ComputedSignal,
  ActionSignal,
  HandlerSignal,
  ComponentSignal,
  NodeSignal,
  SuspenseSignal,
  ReducerSignal,
  ReferenceSignal,
  MutatorSignal,
  AnySignal,
  LogicFunction,
  ExtractLogicFunction,
  SignalValueType,
  SignalsToReadOnlyInterfaces,
  SignalsToActionInterfaces,
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  SignalsToWritableInterfaces,
  DropFirst,
  First,
  Mutable,
  IsTypedLogic,
  ValidateHandlerDeps,
  ValidateComputedDeps,
  ValidateActionDeps,
  MaybePending,
  CreateLogicOptions,
  Serializable,
} from "./signals";

// Signal interfaces for logic modules
export type { SignalInterface, WritableSignalInterface } from "./logic/signalInterfaces";

// SSR utilities
export { setSSRModuleLoader, clearSSRModuleLoader } from "./ssr";
export type { ModuleLoader } from "./ssr";

// Server logic execution (M13)
export { serializeSignalChain, executeFromChain, executeRemote } from "./logic/remoteExecution";
export type { SignalChain, SerializedSignal } from "./logic/remoteExecution";
export { preExecuteServerLogic } from "./logic/preExecuteServerLogic";
export { registerSignalsInTree } from "./registry/registerSignals";

// Reducer execution
export { executeReducer } from "./logic/executeReducer";

// Worker execution (M16)
export { WorkerPool } from "./worker";
export { executeInWorker } from "./logic/workerExecution";

// Polyfills (side-effect import)
import "./polyfills/readableStreamFrom";
