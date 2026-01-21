# SSR Streaming Benchmarks

Compares SSR streaming performance between Stream Weaver and other frameworks:
- **React** (renderToReadableStream) - Full streaming SSR
- **Vue** (renderToWebStream) - Full streaming SSR with h() function
- **SolidJS** - Template strings (requires compilation for actual SSR)
- **Qwik** - Template strings (requires compilation for actual SSR)

## Important Notes

**Fair Comparison:** Only Stream Weaver, React, and Vue use actual framework SSR rendering.
SolidJS and Qwik require build-time compilation to transform JSX into optimized template
strings. Without compilation, their benchmarks use plain string templates which gives
artificially fast results but doesn't represent real framework performance.

## Setup

```bash
cd benchmarks
npm install
```

## Running Benchmarks

### Full benchmark suite

```bash
npm run bench
```

### With warmup phase

```bash
npm run bench -- --warmup
```

### Custom iteration count

```bash
npm run bench -- --runs=100
```

### Single framework

```bash
npm run bench -- --only=react
```

### Combined options

```bash
npm run bench -- --warmup --runs=100 --only=stream-weaver
```

## Running Individual Servers

You can run servers individually for manual testing:

```bash
npm run server:stream-weaver  # http://localhost:3001
npm run server:react          # http://localhost:3002
npm run server:solid          # http://localhost:3003
npm run server:qwik           # http://localhost:3004
npm run server:vue            # http://localhost:3005
```

## Metrics

- **TTFB (Time to First Byte)**: Time from request start to receiving first chunk
- **Full Render Time**: Time from request start to receiving all chunks
- **Bytes per Render**: Total HTML bytes generated

## Output

Results are printed to console and saved to `benchmark-results.json`.

Example output:
```
=== STREAM-WEAVER ===
Runs: 50
Bytes per render: 12.34 KB

TTFB (Time to First Byte):
  Min:    0.50 ms
  Max:    2.10 ms
  Avg:    0.85 ms
  Median: 0.78 ms
  P95:    1.45 ms

Full Render Time:
  Min:    1.20 ms
  Max:    3.50 ms
  Avg:    1.80 ms
  Median: 1.65 ms
  P95:    2.80 ms
```

## Test Component

All frameworks render the same component structure:
- HTML document with head/body
- Header with title
- Metadata section
- List of 100 items, each with:
  - Name
  - Description
  - 3 tags
- Footer

This provides a realistic benchmark of streaming SSR with moderate complexity.

## Architecture

Each benchmark server is minimal and only calls the framework's streaming render function directly:

```
benchmarks/
├── package.json           # Benchmark dependencies
├── runner.ts              # Main benchmark orchestrator
├── shared/
│   ├── types.ts           # Shared types and component data
│   └── measure.ts         # TTFB/render time measurement
└── servers/
    ├── stream-weaver.ts   # Stream Weaver server
    ├── react.tsx          # React server
    ├── solid.tsx          # SolidJS server
    ├── qwik.tsx           # Qwik server
    └── vue.ts             # Vue server
```
