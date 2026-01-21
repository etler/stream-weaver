import type { BenchmarkResult, BenchmarkStats } from "./types.ts";

export async function measureRequest(url: string, framework: string): Promise<BenchmarkResult> {
  const start = performance.now();
  let ttfbTime = 0;
  let totalBytes = 0;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const { body } = response;
  if (body === null) {
    throw new Error("No response body");
  }

  const reader = body.getReader();
  let firstChunk = true;
  let result = await reader.read();

  while (!result.done) {
    if (firstChunk) {
      ttfbTime = performance.now() - start;
      firstChunk = false;
    }
    totalBytes += result.value.length;
    result = await reader.read();
  }

  const fullRenderTime = performance.now() - start;

  return {
    framework,
    ttfb: ttfbTime,
    fullRender: fullRenderTime,
    bytes: totalBytes,
  };
}

export function calculateStats(results: BenchmarkResult[]): BenchmarkStats {
  if (results.length === 0) {
    throw new Error("No results to calculate stats from");
  }

  const [first] = results;
  const ttfbValues = results.map((result) => result.ttfb).sort((left, right) => left - right);
  const fullRenderValues = results.map((result) => result.fullRender).sort((left, right) => left - right);
  const totalBytes = results.reduce((sum, result) => sum + result.bytes, 0);

  return {
    framework: first.framework,
    runs: results.length,
    ttfb: {
      min: ttfbValues[0],
      max: ttfbValues[ttfbValues.length - 1],
      avg: ttfbValues.reduce((left, right) => left + right, 0) / ttfbValues.length,
      median: percentile(ttfbValues, 50),
      p95: percentile(ttfbValues, 95),
    },
    fullRender: {
      min: fullRenderValues[0],
      max: fullRenderValues[fullRenderValues.length - 1],
      avg: fullRenderValues.reduce((left, right) => left + right, 0) / fullRenderValues.length,
      median: percentile(fullRenderValues, 50),
      p95: percentile(fullRenderValues, 95),
    },
    bytesPerRender: totalBytes / results.length,
  };
}

function percentile(sortedValues: number[], pct: number): number {
  const index = (pct / 100) * (sortedValues.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index - lower;

  if (upper >= sortedValues.length) {
    return sortedValues[sortedValues.length - 1];
  }

  return sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight;
}

export function formatStats(stats: BenchmarkStats): string {
  const lines = [
    `\n=== ${stats.framework.toUpperCase()} ===`,
    `Runs: ${stats.runs}`,
    `Bytes per render: ${(stats.bytesPerRender / 1024).toFixed(2)} KB`,
    ``,
    `TTFB (Time to First Byte):`,
    `  Min:    ${stats.ttfb.min.toFixed(2)} ms`,
    `  Max:    ${stats.ttfb.max.toFixed(2)} ms`,
    `  Avg:    ${stats.ttfb.avg.toFixed(2)} ms`,
    `  Median: ${stats.ttfb.median.toFixed(2)} ms`,
    `  P95:    ${stats.ttfb.p95.toFixed(2)} ms`,
    ``,
    `Full Render Time:`,
    `  Min:    ${stats.fullRender.min.toFixed(2)} ms`,
    `  Max:    ${stats.fullRender.max.toFixed(2)} ms`,
    `  Avg:    ${stats.fullRender.avg.toFixed(2)} ms`,
    `  Median: ${stats.fullRender.median.toFixed(2)} ms`,
    `  P95:    ${stats.fullRender.p95.toFixed(2)} ms`,
  ];

  return lines.join("\n");
}

export function formatComparison(allStats: BenchmarkStats[]): string {
  if (allStats.length === 0) {
    return "No results to compare";
  }

  // Sort by median full render time
  const sorted = [...allStats].sort((left, right) => left.fullRender.median - right.fullRender.median);
  const [baseline] = sorted;

  const lines = [
    `\n${"=".repeat(60)}`,
    "COMPARISON (sorted by median full render time)",
    "=".repeat(60),
    "",
    "Framework         | TTFB (ms) | Full (ms) | vs Baseline",
    "-".repeat(60),
  ];

  for (const stats of sorted) {
    const fullDiff =
      stats === baseline
        ? "baseline"
        : `${((stats.fullRender.median / baseline.fullRender.median - 1) * 100).toFixed(0)}%`;

    lines.push(
      `${stats.framework.padEnd(17)} | ${stats.ttfb.median.toFixed(2).padStart(9)} | ${stats.fullRender.median.toFixed(2).padStart(9)} | ${fullDiff}`,
    );
  }

  lines.push("");

  return lines.join("\n");
}
