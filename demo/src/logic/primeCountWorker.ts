/**
 * Worker logic for counting prime numbers up to n
 * CPU-intensive for large numbers, good for demonstrating worker offloading
 */

function isPrime(num: number): boolean {
  if (num < 2) return false;
  if (num === 2) return true;
  if (num % 2 === 0) return false;
  for (let i = 3; i * i <= num; i += 2) {
    if (num % i === 0) return false;
  }
  return true;
}

export default function primeCountWorker(limit: number): string {
  const start = performance.now();

  let count = 0;
  for (let i = 2; i <= limit; i++) {
    if (isPrime(i)) count++;
  }

  const elapsed = performance.now() - start;

  return `Primes found: ${count.toLocaleString()}\nComputed in: ${elapsed.toFixed(2)}ms`;
}
