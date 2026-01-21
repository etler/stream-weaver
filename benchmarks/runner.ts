/**
 * SSR Benchmark Runner
 *
 * Runs benchmarks against all framework servers and collects TTFB and full render metrics.
 *
 * Usage:
 *   npm run bench                    # Run benchmarks (default 50 iterations)
 *   npm run bench -- --warmup        # Include warmup phase
 *   npm run bench -- --runs=100      # Custom iteration count
 *   npm run bench -- --only=react    # Benchmark specific framework
 */

import { spawn, type ChildProcess } from "node:child_process";
import { measureRequest, calculateStats, formatStats, formatComparison } from "./shared/measure.ts";
import { SERVERS, type BenchmarkResult, type BenchmarkStats } from "./shared/types.ts";

const DEFAULT_RUNS = 50;
const WARMUP_RUNS = 10;

interface BenchmarkOptions {
  runs: number;
  warmup: boolean;
  only?: string;
}

function parseArgs(): BenchmarkOptions {
  const args = process.argv.slice(2);
  const options: BenchmarkOptions = {
    runs: DEFAULT_RUNS,
    warmup: false,
  };

  for (const arg of args) {
    if (arg === "--warmup") {
      options.warmup = true;
    } else if (arg.startsWith("--runs=")) {
      const [, value] = arg.split("=");
      options.runs = parseInt(value, 10);
    } else if (arg.startsWith("--only=")) {
      const [, value] = arg.split("=");
      options.only = value;
    }
  }

  return options;
}

async function waitForServer(port: number, maxAttempts = 30): Promise<boolean> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const response = await fetch(`http://localhost:${port}/`);
      if (response.ok) {
        return true;
      }
    } catch {
      // Server not ready yet
    }
    await sleep(100);
  }
  return false;
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function startServer(command: string): Promise<ChildProcess> {
  const child = spawn("npm", ["run", command], {
    cwd: process.cwd(),
    stdio: ["ignore", "pipe", "pipe"],
    detached: false,
  });

  // Capture output for debugging (stdout/stderr are Readable due to stdio: ["ignore", "pipe", "pipe"])
  child.stdout.on("data", (data: Buffer) => {
    const msg = data.toString().trim();
    if (msg !== "") {
      console.log(`  [server] ${msg}`);
    }
  });

  child.stderr.on("data", (data: Buffer) => {
    const msg = data.toString().trim();
    if (msg !== "") {
      console.error(`  [server error] ${msg}`);
    }
  });

  return child;
}

async function stopServer(child: ChildProcess): Promise<void> {
  return new Promise((resolve) => {
    child.on("exit", () => {
      resolve();
    });
    child.kill("SIGTERM");

    // Force kill after timeout
    setTimeout(() => {
      if (!child.killed) {
        child.kill("SIGKILL");
      }
      resolve();
    }, 3000);
  });
}

async function runBenchmark(framework: string, port: number, runs: number, warmup: boolean): Promise<BenchmarkStats> {
  const url = `http://localhost:${port}/`;

  // Warmup phase
  if (warmup) {
    console.log(`  Warming up (${WARMUP_RUNS} requests)...`);
    for (let iteration = 0; iteration < WARMUP_RUNS; iteration++) {
      await measureRequest(url, framework);
    }
  }

  // Measurement phase
  console.log(`  Running ${runs} iterations...`);
  const results: BenchmarkResult[] = [];

  for (let iteration = 0; iteration < runs; iteration++) {
    const result = await measureRequest(url, framework);
    results.push(result);

    // Progress indicator
    if ((iteration + 1) % 10 === 0 || iteration === runs - 1) {
      process.stdout.write(`\r  Progress: ${iteration + 1}/${runs}`);
    }
  }
  console.log(""); // New line after progress

  return calculateStats(results);
}

async function main(): Promise<void> {
  const options = parseArgs();
  const servers =
    options.only !== undefined && options.only !== ""
      ? SERVERS.filter((server) => server.name === options.only)
      : SERVERS;

  if (servers.length === 0) {
    console.error(`Unknown framework: ${options.only}`);
    console.error(`Available: ${SERVERS.map((server) => server.name).join(", ")}`);
    process.exit(1);
  }

  console.log("=".repeat(60));
  console.log("SSR STREAMING BENCHMARK");
  console.log("=".repeat(60));
  console.log(`Runs per framework: ${options.runs}`);
  console.log(`Warmup: ${options.warmup ? "enabled" : "disabled"}`);
  console.log(`Frameworks: ${servers.map((server) => server.name).join(", ")}`);
  console.log("=".repeat(60));

  const allStats: BenchmarkStats[] = [];

  for (const server of servers) {
    console.log(`\n[${server.name}] Starting server on port ${server.port}...`);

    const child = await startServer(server.command);

    // Wait for server to be ready
    const ready = await waitForServer(server.port);
    if (!ready) {
      console.error(`  Failed to start ${server.name} server`);
      await stopServer(child);
      continue;
    }

    console.log(`  Server ready, starting benchmark...`);

    try {
      const stats = await runBenchmark(server.name, server.port, options.runs, options.warmup);
      allStats.push(stats);
      console.log(formatStats(stats));
    } catch (error: unknown) {
      console.error(`  Benchmark failed for ${server.name}:`, error);
    }

    // Stop the server
    console.log(`  Stopping server...`);
    await stopServer(child);
    await sleep(500); // Brief pause between servers
  }

  // Print comparison
  if (allStats.length > 1) {
    console.log(formatComparison(allStats));
  }

  // Export results as JSON
  const jsonPath = "benchmark-results.json";
  const jsonOutput = {
    timestamp: new Date().toISOString(),
    options: {
      runs: options.runs,
      warmup: options.warmup,
    },
    results: allStats,
  };

  const { writeFile } = await import("node:fs/promises");
  await writeFile(jsonPath, JSON.stringify(jsonOutput, null, 2));

  console.log(`\nResults saved to ${jsonPath}`);
}

main().catch((error: unknown) => {
  console.error("Benchmark runner failed:", error);
  process.exit(1);
});
