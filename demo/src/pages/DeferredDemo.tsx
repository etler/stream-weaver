/**
 * Example: Deferred Logic Demo
 * Demonstrates the difference between instant, async, and deferred execution
 *
 * One counter, three buttons:
 * - Instant: Sync logic, updates immediately
 * - Async: Blocking async, waits 500ms before updating
 * - Deferred: Non-blocking async, returns immediately with PENDING
 */
import { createSignal, createHandler, createLogic } from "stream-weaver";

// --- Shared counter ---
const count = createSignal(0);

// --- Instant (sync) ---
const instantLogic = createLogic(import("../logic/increment"));
const instantIncrement = createHandler(instantLogic, [count]);

// --- Async (blocking) ---
const asyncLogic = createLogic(import("../logic/slowIncrement"));
const asyncIncrement = createHandler(asyncLogic, [count]);

// --- Deferred (non-blocking) ---
const deferredLogic = createLogic(import("../logic/slowIncrement"), { timeout: 0 });
const deferredIncrement = createHandler(deferredLogic, [count]);

export function DeferredDemoExample(): JSX.Element {
  return (
    <div style="padding: 2rem; max-width: 700px; margin: 0 auto;">
      <h1 style="text-align: center; color: #333;">Deferred Logic Demo</h1>
      <p style="text-align: center; color: #666; max-width: 500px; margin: 0 auto 2rem auto;">
        One counter, three ways to increment it. Watch how each execution mode behaves differently.
      </p>

      {/* Counter display */}
      <div style="text-align: center; margin: 2rem 0;">
        <div style="font-size: 6rem; font-weight: bold; color: #333; margin: 1rem 0;">
          {count}
        </div>
      </div>

      {/* Three buttons */}
      <div style="display: flex; gap: 1rem; justify-content: center; margin: 2rem 0;">
        <button
          onClick={asyncIncrement}
          style="padding: 1rem 1.5rem; font-size: 1rem; cursor: pointer; background: #ff9800; color: white; border: none; border-radius: 8px; min-width: 140px;"
        >
          +1 Async
        </button>
        <button
          onClick={instantIncrement}
          style="padding: 1rem 1.5rem; font-size: 1rem; cursor: pointer; background: #4caf50; color: white; border: none; border-radius: 8px; min-width: 140px;"
        >
          +1 Instant
        </button>
        <button
          onClick={deferredIncrement}
          style="padding: 1rem 1.5rem; font-size: 1rem; cursor: pointer; background: #2196f3; color: white; border: none; border-radius: 8px; min-width: 140px;"
        >
          +1 Deferred
        </button>
      </div>

      {/* Instructions */}
      <div style="background: #fff8e1; padding: 1rem; border-radius: 8px; margin: 2rem 0;">
        <strong>How to test:</strong>
        <ol style="margin: 0.5rem 0 0 0; padding-left: 1.5rem;">
          <li>Click "Instant" - counter updates immediately</li>
          <li>Click "Async" - counter updates after 1 second (UI blocks)</li>
          <li>Click "Deferred" - returns immediately, counter updates after 1 second</li>
          <li>Rapidly click "Async" then "Instant" - instant waits for async to finish</li>
          <li>Rapidly click "Deferred" then "Instant" - instant works immediately!</li>
        </ol>
      </div>

      {/* Explanation */}
      <div style="background: #f5f5f5; padding: 1rem; border-radius: 8px;">
        <h3 style="margin: 0 0 1rem 0;">What's happening?</h3>
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem;">
          <div>
            <strong style="color: #ff9800;">Async</strong>
            <p style="margin: 0.5rem 0 0 0; color: #666; font-size: 0.9rem;">
              Blocking async. Waits 1s before updating. Other handlers queue behind it.
            </p>
          </div>
          <div>
            <strong style="color: #4caf50;">Instant</strong>
            <p style="margin: 0.5rem 0 0 0; color: #666; font-size: 0.9rem;">
              Synchronous logic. Updates immediately, no delay.
            </p>
          </div>
          <div>
            <strong style="color: #2196f3;">Deferred</strong>
            <p style="margin: 0.5rem 0 0 0; color: #666; font-size: 0.9rem;">
              Non-blocking async (timeout: 0). Returns PENDING immediately, updates when done.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
