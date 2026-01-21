// Core SSR
export { StreamWeaver } from "./StreamWeaver";

// Client
export { ClientWeaver } from "./client/ClientWeaver";

// Registry
export { WeaverRegistry } from "./registry/WeaverRegistry";

// Signals
export {
  createSignal,
  createLogic,
  createClientLogic,
  createComputed,
  createAction,
  createHandler,
  createComponent,
  createNode,
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

// Polyfills (side-effect import)
import "./polyfills/readableStreamFrom";
