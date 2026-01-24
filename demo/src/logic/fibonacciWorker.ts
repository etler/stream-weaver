/**
 * Worker logic for computing Fibonacci numbers
 * Intentionally uses recursive approach to be CPU-intensive for demo purposes
 */

function fib(n: number): number {
  if (n <= 1) return n;
  return fib(n - 1) + fib(n - 2);
}

export default function fibonacciWorker(n: number): string {
  const start = performance.now();
  const result = fib(n);
  const elapsed = performance.now() - start;

  return `Result: ${result.toLocaleString()}\nComputed in: ${elapsed.toFixed(2)}ms`;
}
