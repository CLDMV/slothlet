# Performance Benchmarks

This folder contains versioned performance benchmark results for Slothlet, collected on the same hardware to enable meaningful cross-version comparison.

## Benchmark Files

| File | Description |
|------|-------------|
| [v3.0.0.md](./v3.0.0.md) | Baseline — first stable v3 release |
| [v3.1.0.md](./v3.1.0.md) | Added `api.slothlet.env` snapshot |
| [v3.2.0.md](./v3.2.0.md) | Added API Path Versioning (dispatcher proxy, version metadata) |
| [v3.2.3.md](./v3.2.3.md) | Latest v3.2 patch (publish workflow fix) |
| [v3.3.0.md](./v3.3.0.md) | Added Permission System — includes with/without comparison |
| [cross-version-summary.md](./cross-version-summary.md) | Side-by-side comparison table across all versions |

## How Benchmarks Are Run

All benchmarks use the same test script (`tests/performance/performance-benchmark.mjs`) with the same fixture directory (`api_tests/api_test`). Each version is checked out at its tag, the benchmark runs, and results are captured.

```sh
node tests/performance/performance-benchmark.mjs
```

**Test configuration:**
- 10 startup iterations (averaged)
- 100 function call iterations (averaged)
- 100 complex module iterations
- 50 per-module pattern iterations

**Test modules:**
- `math/math.mjs` — nested module (auto-flattened)
- `string/string.mjs` — nested module (auto-flattened)
- `funcmod/funcmod.mjs` — callable function module
- `nested/date/date.mjs` — deeply nested module

## Key Metrics

| Metric | What It Measures |
|--------|-----------------|
| **Eager Startup** | Time to initialize with all modules loaded upfront |
| **Lazy Startup** | Time to initialize with deferred module loading |
| **Eager Calls** | Average function call latency in eager mode |
| **Lazy Calls** | Average function call latency after lazy materialization |
| **Materialization** | One-time cost to materialize a lazy module on first access |

## Interpreting Results

- **Startup times** include module discovery, file loading, proxy creation, and API tree construction.
- **Call times** are single-digit to low-double-digit microseconds — differences under ~5μs are measurement noise.
- **Materialization** is a one-time cost per module; subsequent calls are at full speed.
- Benchmarks run sequentially in a single Node.js process. GC pressure, V8 JIT warm-up, and system load introduce variance between runs.
