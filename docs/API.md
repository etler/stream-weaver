# Stream Weaver API Documentation

## 1. Introduction
- What is Stream Weaver
- Core philosophy (addressability, isomorphism, reactive + procedural)
- Key innovations (DelegateStream, recursive streaming, zero hydration)

## 2. Core Concepts

### 2.1 Signals
- Reactive state containers
- Universal addressability (IDs)
- Created anywhere (not hooks)
- Lazy registration (bind-time, not create-time)

### 2.2 Logic
- Addressable code references
- Isomorphic execution
- Module source + export key
- Lazy loading/resolution

### 2.3 Bind Points
- DOM anchors for reactive updates
- Comment marker implementation
- Bind point IDs vs Signal IDs

### 2.4 The Weaver
- Stream orchestrator
- Registry (signals + logic)
- Isomorphic (server + client)
- DelegateStream as execution engine

## 3. Primitive API

### 3.1 createSignal()
- Type signature
- Returns signal object
- ID allocation
- Usage examples

### 3.2 Signals as Values
- Reading signal values
- Writing signal values
- Subscription (implicit, implementation detail)

## 4. Composition API

### 4.1 createComputed()
- Logic + signal deps → signal
- Reactive (auto-executes)
- Type signature
- Usage examples

### 4.2 createAction()
- Logic + signal deps → side effects
- Imperative (manual execution)
- Type signature
- Usage examples

### 4.3 createComponent()
- Computed + DelegateStream
- Returns signal + emits events
- Type signature
- JSX integration

## 5. Component Model

### 5.1 Components as Signals
- Component = computed signal
- Props as signal dependencies
- Component updates when props change

### 5.2 Components as Streams
- DelegateStream integration
- Recursive component spawning
- Parallel execution, sequential output

### 5.3 JSX Integration
- JSX factory function
- Signal binding syntax `{signal}`
- Component instantiation `<Component />`

## 6. Stream Architecture

### 6.1 Server Weaver Pipeline
- Component execution
- Stream event types
- Registration events
- Bind marker events
- VDOM token events

### 6.2 Event Flow
- Component delegate spawning
- Recursive stream chaining
- Event ordering guarantees

### 6.3 Registry Management
- Signal registration
- Logic registration
- De-duplication (implementation detail)

## 7. Serialization

### 7.1 Server HTML Output
- Bind markers as HTML comments
- Registration scripts `<script>weaver.push({...})</script>`
- VDOM tokens to HTML
- Stream ordering

### 7.2 Wire Protocol
- Registration message format
- Bind marker format
- Signal definitions
- Logic definitions

### 7.3 Client Deserialization
- Inline script execution
- Registry rebuilding via `weaver.push()`

## 8. Client Runtime

### 8.1 Client Weaver Initialization
- Registry restoration
- Event listener setup (event delegation)

### 8.2 Reactivity
- Signal updates
- Computed re-execution
- Component re-rendering

### 8.3 Sync Messages
- Bind point update format
- HTML replacement
- Nested bind point rescanning

### 8.4 The Sink
- Initial bind point scanning/discovery
- Bind point → DOM Range mapping
- Receiving sync messages from Weaver
- HTML replacement mechanism (wholesale, no diffing)
- Rescanning replaced HTML for nested bind points

### 8.5 Event Handling
- Event delegation
- Action execution
- Signal mutations

## 9. Build Integration

### 9.1 Source Phase Imports
- Module addressability
- Server vs client paths
- Vite integration

### 9.2 Module Mapping
- Build manifest
- Path resolution
- Public URL generation

## 10. Patterns & Examples

### 10.1 Global State
- Module-level signals
- No context providers

### 10.2 Computed Values
- Derived state
- Multi-signal dependencies

### 10.3 Component Composition
- Resolver pattern
- Lazy loading
- Parallel rendering

### 10.4 Event Handling
- Actions with mutations
- Signal updates
- Component swapping
