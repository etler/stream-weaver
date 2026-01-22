/**
 * Example: Stream Signals
 *
 * Demonstrates the createStream function for reducing ReadableStreams:
 * - Creates a stream that counts from 0 to 10
 * - Uses a reducer to accumulate all values
 * - Updates the UI as each value arrives
 *
 * USE CASES:
 * - WebSocket messages
 * - Server-sent events
 * - Streaming API responses (e.g., AI chat)
 * - Real-time data feeds
 *
 * NOTE: A ReadableStream can only be consumed once (single reader).
 * If you need multiple derived values, use a reducer that produces
 * a combined result, or use stream.tee() to split the stream.
 */
import { createComputed, createStream, createClientLogic, createLogic } from "stream-weaver";

// --- Stream Setup ---

// Use createClientLogic so the stream is only created on the client
// On the server, this returns null and we show the initial value
const streamLogic = createClientLogic(import("../logic/countingStream"));

// Computed signal that creates the ReadableStream when executed
// This will only run on the client due to createClientLogic
const countingStream = createComputed(streamLogic, [], null);

// Reducer that accumulates all values into an array
const appendLogic = createLogic(import("../logic/append"));

// Stream signal that updates as each number arrives
// Init value of [] is shown during SSR, then accumulates [0, 1, 2...] on client
const allCounts = createStream(countingStream, appendLogic, [] as number[]);

/**
 * Root component for the demo
 */
export function StreamExample(): JSX.Element {
  return (
    <div style="padding: 2rem; background: #f1f5f9; min-height: 100vh; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      <h1 style="text-align: center; color: #333; margin-bottom: 0.5rem;">Stream Signals Demo</h1>
      <p style="text-align: center; color: #666; max-width: 500px; margin: 0 auto 2rem auto;">
        Stream signals reduce items from a ReadableStream into reactive values.
        This demo shows a counting stream from 0 to 10, updating every 500ms.
      </p>

      <div style="background: #e0f2fe; padding: 1rem; border-radius: 8px; margin-bottom: 2rem; max-width: 500px; margin-left: auto; margin-right: auto;">
        <strong>How it works:</strong>
        <ul style="margin: 0.5rem 0 0 0; padding-left: 1.5rem; font-size: 0.9rem;">
          <li><code>createClientLogic</code> ensures stream only runs on client</li>
          <li><code>createStream</code> reduces stream items via a reducer function</li>
          <li>The "append" reducer accumulates all values into an array</li>
        </ul>
      </div>

      <div style="max-width: 500px; margin: 0 auto;">
        {/* All Values Display */}
        <div style="background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <h2 style="margin: 0 0 1rem 0; color: #333; font-size: 1.2rem;">All Values (Accumulated)</h2>
          <pre style="margin: 0; font-size: 1rem; color: #666; background: #f8fafc; padding: 1rem; border-radius: 4px; overflow-x: auto;">
            {allCounts}
          </pre>
        </div>
      </div>

      <div style="max-width: 500px; margin: 2rem auto; padding: 1rem; background: #fef3c7; border-radius: 8px; font-size: 0.9rem;">
        <strong>Note:</strong> The stream starts when the page loads on the client.
        During SSR, the initial value ([]) is shown.
        Refresh the page to restart the counting sequence.
      </div>
    </div>
  );
}
