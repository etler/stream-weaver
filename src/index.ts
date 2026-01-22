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
  createSignal,
  createLogic,
  createClientLogic,
  createServerLogic,
  createComputed,
  createAction,
  createHandler,
  createComponent,
  createNode,
  createSuspense,
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
  AnySignal,
  LogicFunction,
  ExtractLogicFunction,
  SignalValueType,
  SignalsToReadOnlyInterfaces,
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

// Polyfills (side-effect import)
import "./polyfills/readableStreamFrom";
