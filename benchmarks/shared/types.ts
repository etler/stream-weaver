export interface BenchmarkResult {
  framework: string;
  ttfb: number; // Time to first byte in ms
  fullRender: number; // Full render time in ms
  bytes: number; // Total bytes rendered
}

export interface BenchmarkStats {
  framework: string;
  runs: number;
  ttfb: {
    min: number;
    max: number;
    avg: number;
    median: number;
    p95: number;
  };
  fullRender: {
    min: number;
    max: number;
    avg: number;
    median: number;
    p95: number;
  };
  bytesPerRender: number;
}

export interface ServerConfig {
  name: string;
  port: number;
  command: string;
}

export const SERVERS: ServerConfig[] = [
  { name: "stream-weaver", port: 3001, command: "server:stream-weaver" },
  { name: "react", port: 3002, command: "server:react" },
  { name: "solid", port: 3003, command: "server:solid" },
  { name: "qwik", port: 3004, command: "server:qwik" },
  { name: "vue", port: 3005, command: "server:vue" },
];

// Shared component data for all frameworks to render the same content
export const COMPONENT_DATA = {
  title: "SSR Benchmark Test Page",
  items: Array.from({ length: 100 }, (_unused, index) => ({
    id: index + 1,
    name: `Item ${index + 1}`,
    description: `This is the description for item number ${index + 1}. It contains some text to simulate real content.`,
    tags: [`tag-${index % 5}`, `category-${index % 3}`, `type-${index % 7}`],
  })),
  metadata: {
    author: "Benchmark Suite",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
  },
};
