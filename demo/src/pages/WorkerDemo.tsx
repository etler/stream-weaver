/**
 * Worker Demo
 * Demonstrates CPU-intensive computations offloaded to worker threads
 *
 * Features:
 * - Server-side blocking worker: Fibonacci computation runs during SSR
 * - Client-side deferred worker: Prime counting runs without blocking UI
 */
import {
  createSignal,
  createHandler,
  createComputed,
  createLogic,
  createWorkerLogic,
  Suspense,
} from "stream-weaver";

// --- Fibonacci (Server-side blocking worker) ---
// This computation runs during SSR in a Node.js worker thread
// The result is included in the initial HTML
const fibInput = createSignal(35);
const fibLogic = createWorkerLogic(import("../logic/fibonacciWorker"));
const fibResult = createComputed(fibLogic, [fibInput], "Computing...");

// Handler to increment fib input
const incrementFibLogic = createLogic(import("../logic/incrementFibInput"));
const incrementFib = createHandler(incrementFibLogic, [fibInput]);

// Handler to decrement fib input
const decrementFibLogic = createLogic(import("../logic/decrement"));
const decrementFib = createHandler(decrementFibLogic, [fibInput]);

// --- Prime counting (Client-side deferred worker) ---
// This computation runs on the client with timeout: 0 (non-blocking)
// Shows loading state initially, updates when computation completes
const primeLimit = createSignal(50000);
const primeLogic = createWorkerLogic(import("../logic/primeCountWorker"));
const deferredPrimeLogic = createLogic({ src: primeLogic.src }, { context: "worker", timeout: 0 });
const primeResult = createComputed(deferredPrimeLogic, [primeLimit], null);

// Handler to increment prime limit
const incrementPrimeLimitLogic = createLogic(import("../logic/incrementPrimeLimit"));
const incrementPrimeLimit = createHandler(incrementPrimeLimitLogic, [primeLimit]);

function FibonacciSection(): JSX.Element {
  return (
    <div style="background: #e3f2fd; padding: 1.5rem; border-radius: 12px; margin-bottom: 1.5rem;">
      <h2 style="margin: 0 0 1rem 0; color: #1565c0;">
        Blocking Worker (Server-Side)
      </h2>
      <p style="color: #666; margin: 0 0 1rem 0;">
        Fibonacci computation runs in a Node.js worker thread during SSR.
        The result is computed before the page loads.
      </p>

      <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 1rem;">
        <span style="font-size: 1.1rem;">fib(</span>
        <button
          onClick={decrementFib}
          style="padding: 0.5rem 1rem; font-size: 1rem; cursor: pointer; background: #1976d2; color: white; border: none; border-radius: 6px;"
        >
          -1
        </button>
        <span style="font-size: 1.5rem; font-weight: bold; color: #1565c0; min-width: 60px; text-align: center;">
          {fibInput}
        </span>
        <button
          onClick={incrementFib}
          style="padding: 0.5rem 1rem; font-size: 1rem; cursor: pointer; background: #1976d2; color: white; border: none; border-radius: 6px;"
        >
          +1
        </button>
        <span style="font-size: 1.1rem;">)</span>
      </div>

      <pre style="background: white; padding: 1rem; border-radius: 8px; font-family: monospace; margin: 0; white-space: pre-wrap;">
        {fibResult}
      </pre>

      <div style="margin-top: 1rem; padding: 0.75rem; background: #bbdefb; border-radius: 6px; font-size: 0.9rem;">
        <strong>Note:</strong> Changing the input triggers a blocking worker execution.
        The UI will wait for the Fibonacci calculation to complete. Try increasing to 40+ to see the delay.
      </div>
    </div>
  );
}

function PrimeCountDisplay(): JSX.Element {
  return (
    <pre style="background: white; padding: 1rem; border-radius: 8px; font-family: monospace; margin: 0; white-space: pre-wrap;">
      {primeResult}
    </pre>
  );
}

function PrimeLoadingFallback(): JSX.Element {
  return (
    <div style="background: white; padding: 1rem; border-radius: 8px; font-family: monospace; text-align: center;">
      <div style="color: #ff9800; font-size: 1.2rem;">Computing primes...</div>
      <div style="color: #999; margin-top: 0.5rem;">Worker thread is running in the background</div>
    </div>
  );
}

function PrimeSection(): JSX.Element {
  return (
    <div style="background: #e8f5e9; padding: 1.5rem; border-radius: 12px;">
      <h2 style="margin: 0 0 1rem 0; color: #2e7d32;">
        Non-Blocking Worker (Client-Side Deferred)
      </h2>
      <p style="color: #666; margin: 0 0 1rem 0;">
        Prime counting runs in a Web Worker with timeout: 0 (deferred).
        The UI stays responsive while computation happens in the background.
      </p>

      <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 1rem;">
        <span style="font-size: 1.1rem;">Count primes up to</span>
        <span style="font-size: 1.5rem; font-weight: bold; color: #2e7d32;">{primeLimit}</span>
        <button
          onClick={incrementPrimeLimit}
          style="padding: 0.5rem 1rem; font-size: 1rem; cursor: pointer; background: #43a047; color: white; border: none; border-radius: 6px;"
        >
          +10,000
        </button>
      </div>

      <Suspense fallback={<PrimeLoadingFallback />}>
        <PrimeCountDisplay />
      </Suspense>

      <div style="margin-top: 1rem; padding: 0.75rem; background: #c8e6c9; border-radius: 6px; font-size: 0.9rem;">
        <strong>Note:</strong> Click "+10,000" to increase the limit. The computation
        runs in a Web Worker, so the UI stays responsive. Watch the Suspense fallback
        show while computing.
      </div>
    </div>
  );
}

export function WorkerExample(): JSX.Element {
  return (
    <div style="padding: 2rem; max-width: 700px; margin: 0 auto;">
      <h1 style="text-align: center; color: #333; margin-bottom: 0.5rem;">
        Worker Thread Demo
      </h1>
      <p style="text-align: center; color: #666; margin: 0 0 2rem 0;">
        CPU-intensive computations offloaded to worker threads
      </p>

      <FibonacciSection />
      <PrimeSection />

      <div style="background: #f5f5f5; padding: 1rem; border-radius: 8px; margin-top: 1.5rem;">
        <h3 style="margin: 0 0 0.5rem 0;">How it works</h3>
        <ul style="margin: 0; padding-left: 1.5rem; color: #666;">
          <li>
            <strong>Blocking (blue):</strong> Uses <code>createWorkerLogic()</code> without timeout.
            Computation completes before the page renders (SSR) or before the handler returns (client).
          </li>
          <li style="margin-top: 0.5rem;">
            <strong>Deferred (green):</strong> Uses <code>timeout: 0</code> option.
            Returns immediately with a pending state, updates when worker finishes.
            Wrapped in <code>&lt;Suspense&gt;</code> to show loading UI.
          </li>
        </ul>
      </div>
    </div>
  );
}
