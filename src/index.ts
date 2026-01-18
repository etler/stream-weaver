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
  createComputed,
  createAction,
  createHandler,
  createComponent,
  createNode,
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
} from "./signals";

// Signal interfaces for logic modules
export type { SignalInterface, WritableSignalInterface } from "./logic/signalInterfaces";

// Polyfills (side-effect import)
import "./polyfills/readableStreamFrom";
