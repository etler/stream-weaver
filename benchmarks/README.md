# SSR Streaming Benchmarks

Compares SSR streaming performance between Stream Weaver and other frameworks:
- **Stream Weaver** - Full streaming SSR with direct serialization fast path
- **React** (renderToReadableStream) - Full streaming SSR
- **Vue** (renderToWebStream) - Full streaming SSR with h() function
- **SolidJS** (renderToStringAsync + ssrElement) - Full SSR with hydration markers
- **Qwik** (component$ + Vite build) - Full SSR with resumability markers
- **Template** (control) - Plain template strings, no framework overhead

## Framework Implementation Details

| Framework | Implementation | SSR Functions Used | Output Size |
|-----------|---------------|-------------------|-------------|
| Template | Control baseline | Plain template strings | 31.4 KB |
| Stream Weaver | Full SSR | `StreamWeaver`, `jsx()`, `serializeElement()` | 25.3 KB |
| React | Full SSR | `renderToReadableStream()`, `jsx()` | 25.3 KB |
| Vue | Full SSR | `renderToWebStream()`, `h()` | 25.3 KB |
| SolidJS | Full SSR | `renderToStringAsync()`, `ssrElement()`, `ssr`, `defineComponent()` | 27.5 KB |
| Qwik | Full SSR + Build | `component$()`, `renderToString()`, Vite build | 39.0 KB |

### Why Qwik Output is Larger

Qwik's SSR output includes extensive resumability markers:
- `q:container`, `q:version`, `q:render` attributes
- `q:id` and `q:key` on every element for resumption tracking
- `<!--qv-->` comment markers for component boundaries
- `<!--t=N-->` markers for text nodes

These markers enable Qwik's unique "resumability" - the client can resume execution without re-rendering, but they add ~14KB of overhead to the HTML output.

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
npm run bench -- --only=qwik
npm run bench -- --only=template
```

### Combined options

```bash
npm run bench -- --warmup --runs=100 --only=stream-weaver
```

## Bun Runtime Support

You can run benchmarks using the Bun runtime instead of Node.js for comparison.

### Install Bun

```bash
# macOS/Linux
curl -fsSL https://bun.sh/install | bash

# Windows (via npm)
npm install -g bun
```

### Run benchmarks with Bun

```bash
npm run bench:bun                    # Run all benchmarks with Bun
npm run bench:bun -- --warmup        # With warmup phase
npm run bench:bun -- --only=react    # Single framework
```

### Run individual servers with Bun

```bash
npm run server:bun:stream-weaver  # http://localhost:3001
npm run server:bun:react          # http://localhost:3002
npm run server:bun:solid          # http://localhost:3003
npm run server:bun:qwik           # http://localhost:3004
npm run server:bun:vue            # http://localhost:3005
npm run server:bun:template       # http://localhost:3006
```

Results are saved to `benchmark-results-bun.json` when using Bun runtime.

## Running Individual Servers

You can run servers individually for manual testing:

```bash
npm run server:stream-weaver  # http://localhost:3001
npm run server:react          # http://localhost:3002
npm run server:solid          # http://localhost:3003
npm run server:qwik           # http://localhost:3004 (includes Vite build)
npm run server:vue            # http://localhost:3005
npm run server:template       # http://localhost:3006
```

## Metrics

- **TTFB (Time to First Byte)**: Time from request start to receiving first chunk
- **Full Render Time**: Time from request start to receiving all chunks
- **Bytes per Render**: Total HTML bytes generated

## Output

Results are printed to console and saved to `benchmark-results.json`.

Example output:
```
============================================================
COMPARISON (sorted by median full render time)
============================================================

Framework         | TTFB (ms) | Full (ms) | vs Baseline
------------------------------------------------------------
template          |      0.27 |      0.27 | baseline
solid             |      0.29 |      0.29 | 6%
vue               |      0.40 |      0.40 | 46%
stream-weaver     |      0.62 |      0.63 | 128%
qwik              |      0.84 |      0.84 | 206%
react             |      1.43 |      1.43 | 419%
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

Each benchmark server is in its own folder with all necessary files:

```
benchmarks/
├── package.json           # Benchmark dependencies
├── runner.ts              # Main benchmark orchestrator
├── shared/
│   ├── types.ts           # Shared types and component data
│   └── measure.ts         # TTFB/render time measurement
└── servers/
    ├── stream-weaver/
    │   └── server.ts      # Stream Weaver SSR server
    ├── react/
    │   └── server.tsx     # React SSR server
    ├── solid/
    │   └── server.ts      # SolidJS SSR server
    ├── qwik/
    │   ├── server.ts      # Qwik SSR server (with build)
    │   ├── vite.config.ts # Vite config for Qwik build
    │   └── src/
    │       ├── root.tsx       # App component using component$
    │       └── entry.ssr.tsx  # SSR entry point
    ├── vue/
    │   └── server.ts      # Vue SSR server
    └── template/
        └── server.ts      # Template string control server
```
