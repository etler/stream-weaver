/**
 * Example: Streaming and Reducer Signals
 *
 * Demonstrates two approaches to handling streams:
 * - Server: Consume stream in createComputed - blocks until complete, returns final result
 * - Client: Use createReducer - updates incrementally as each value arrives
 *
 * This shows the key difference:
 * - createComputed: Single result after completion (blocking)
 * - createReducer: Incremental updates as items arrive (reactive)
 *
 * USE CASES:
 * - Server: Initial data loading during SSR
 * - Client: WebSocket messages, Server-sent events, Streaming API responses (e.g., AI chat)
 */
import { createComputed, createReducer, createClientLogic, createLogic } from "stream-weaver";

// --- Server Stream (runs during SSR, blocks until complete) ---

// Logic that consumes the stream and returns the final result
// createLogic is isomorphic - it executes on both server and client
const serverResultLogic = createLogic(import("../logic/consumeServerStream"));

// This computed blocks during SSR until the stream completes
// Returns the final accumulated result [0,1,2,3,4,5]
// Providing [] as init so the check doesn't fail
const serverCounts = createComputed(serverResultLogic, [], []);

// --- Client Stream (runs after hydration, updates incrementally) ---

// Use createClientLogic so the stream is only created on the client
// On the server, this returns null and we show the initial value
const clientStreamLogic = createClientLogic(import("../logic/countingStream"));

// Computed signal that creates the ReadableStream when executed
// This will only run on the client due to createClientLogic
const clientCountingStream = createComputed(clientStreamLogic, []);

// Reducer that accumulates all values into an array
const appendLogic = createLogic(import("../logic/append"));

// Client reducer signal - shows [] during SSR, then accumulates [0, 1, 2...] on client
// Updates incrementally as each value arrives (non-blocking)
const clientCounts = createReducer(clientCountingStream, appendLogic, [] as number[]);

/**
 * Root component for the demo
 */
export function StreamExample(): JSX.Element {
  return (
    <div style="padding: 2rem; background: #f1f5f9; min-height: 100vh; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      <h1 style="text-align: center; color: #333; margin-bottom: 0.5rem;">Streaming Demo</h1>
      <p style="text-align: center; color: #666; max-width: 700px; margin: 0 auto 2rem auto;">
        Comparing two approaches to handling streams: blocking (server) vs incremental (client).
      </p>

      <div style="background: #e0f2fe; padding: 1rem; border-radius: 8px; margin-bottom: 2rem; max-width: 700px; margin-left: auto; margin-right: auto;">
        <strong>Two Approaches:</strong>
        <ul style="margin: 0.5rem 0 0 0; padding-left: 1.5rem; font-size: 0.9rem;">
          <li>
            <strong>Server (createComputed):</strong> Consumes entire stream, returns final result - blocks SSR until
            complete
          </li>
          <li>
            <strong>Client (createReducer):</strong> Updates incrementally as each item arrives - UI stays responsive
          </li>
          <li>Both use the same underlying async iterable (ReadableStream)</li>
          <li>
            <code>createReducer</code> is reactive; <code>createComputed</code> is one-shot
          </li>
        </ul>
      </div>

      <div style="max-width: 700px; margin: 0 auto; display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem;">
        {/* Server Stream Display */}
        <div style="background: #e8f5e9; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <h2 style="margin: 0 0 0.5rem 0; color: #2e7d32; font-size: 1.2rem;">Server: createComputed</h2>
          <p style="margin: 0 0 1rem 0; font-size: 0.85rem; color: #555;">Consumes stream, returns final array</p>
          <pre style="margin: 0; font-size: 1rem; color: #2e7d32; background: white; padding: 1rem; border-radius: 4px; overflow-x: auto;">
            {serverCounts}
          </pre>
          <div style="margin-top: 1rem; padding: 0.75rem; background: #c8e6c9; border-radius: 4px; font-size: 0.85rem;">
            <strong>Blocking SSR:</strong> Stream completes during server render. Page loads with [0,1,2,3,4,5] already
            in HTML.
          </div>
        </div>

        {/* Client Stream Display */}
        <div style="background: #e3f2fd; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <h2 style="margin: 0 0 0.5rem 0; color: #1565c0; font-size: 1.2rem;">Client: createReducer</h2>
          <p style="margin: 0 0 1rem 0; font-size: 0.85rem; color: #555;">Updates incrementally as items arrive</p>
          <pre style="margin: 0; font-size: 1rem; color: #1565c0; background: white; padding: 1rem; border-radius: 4px; overflow-x: auto;">
            {clientCounts}
          </pre>
          <div style="margin-top: 1rem; padding: 0.75rem; background: #bbdefb; border-radius: 4px; font-size: 0.85rem;">
            <strong>Incremental updates:</strong> Starts empty [], then appends each value as it arrives. Watch it
            build: [0] → [0,1] → [0,1,2]...
          </div>
        </div>
      </div>

      <div style="max-width: 700px; margin: 2rem auto; padding: 1rem; background: #fef3c7; border-radius: 8px; font-size: 0.9rem;">
        <strong>💡 Key Difference:</strong> Server uses <code>createComputed</code> with async logic that consumes the
        entire stream (blocks SSR, returns final result). Client uses <code>createReducer</code> which updates the UI
        incrementally as each item arrives (non-blocking, reactive). Same stream, different consumption patterns.
      </div>
    </div>
  );
}
