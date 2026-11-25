# 🚀 Slothlet Performance Analysis

> **Comprehensive benchmarks comparing eager vs lazy loading strategies**

This document provides detailed performance analysis of Slothlet's loading modes based on real-world benchmarks. All tests are reproducible using `npm run test:performance`.

## 📊 Executive Summary

Measured on v3.0.0; the v4.0.0 numbers are in the next section.

> [!NOTE]
> **Performance Winner Depends on Your Use Case**
>
> | Metric              | Lazy Mode           | Eager Mode   | Winner       | Improvement     |
> | ------------------- | ------------------- | ------------ | ------------ | --------------- |
> | **Startup Time**    | 15.41ms             | 34.28ms      | 🎯 **Lazy**  | **2.2x faster** |
> | **Function Calls**  | 9.99μs              | 9.46μs       | ≈ **Equal**  | **Within 6%**   |
> | **Realistic Usage** | 7.75μs              | 8.26μs       | ≈ **Equal**  | **Within 7%**   |
> | **Memory Usage**    | On-demand           | Full upfront | 🎯 **Lazy**  | Scales with use |
> | **Predictability**  | Variable first-call | Consistent   | 🚀 **Eager** | No surprises    |

### Key Takeaways

> [!TIP]
> **Choose your loading strategy based on your specific needs:**
>
> - ✅ **Lazy mode excels at startup** - 2.2x faster initialization
> - ✅ **Both modes equal at runtime** - Post-materialization performance identical (within measurement noise)
> - ✅ **Materialization cost is one-time** - ~107–788μs per module, only on first access
> - ✅ **Both modes are production-ready** with different optimization targets

---

## 📈 v4.0.0 compared with v3.24.0 and v3.0.0

v4.0.0 is slower than v3 on every workload measured. Creating an instance takes about twice as long as in v3.24.0 and three and a half times as long as in v3.0.0. A call through the api costs about 1.5–2 µs more than in v3.24.0 (1.3–1.7x) and 3–4 µs more than in v3.0.0. Shutdown takes about 1.2–1.4 ms, where v3.0.0 did almost nothing on shutdown. The added cost comes from what v4 does on every call and every instance: each `run()` / `scope()` and each call is kept apart from every other flow in every permission mode, a run reads a snapshot of the instance, and the async runtime installs a process-wide hook (see [MIGRATION.md](./MIGRATION.md#process-wide-hooks-while-an-instance-exists)). For most apps a few microseconds per call and a few milliseconds per instance are small next to the work the calls do; if a hot loop calls a tiny function millions of times, measure it.

Both tables come from `npm run test:performance:compare` at the v4.0.0 release commit, run in a container limited to 4 CPUs and 8 GiB, the same for both versions in a table: Node v26.13.1, Ubuntu 24.04.5 LTS (linux 7.0.0-43-generic, x64), AMD Ryzen Threadripper 9970X 32-Cores (64 logical processors, 251 GB RAM, shared with other jobs: load average about 4 throughout). 8 rounds per version, each a fresh process; iterations per round: startup 50, function calls 200, nested 200, per-module 100, realistic 500 (41 distinct calls). Both versions run their built `dist/` with their own shipped defaults. Each cell is the median over rounds, with the interquartile range in brackets. The two tables come from two separate runs, so compare within a table, not across them.

The v3.0.0 run is included because the eager-versus-lazy figures in the rest of this document were measured on v3.0.0. It passes the api folder as `dir`, the option's name in v3.0.0.

### v3.24.0 → v4.0.0

| Workload                                                    | v3.24.0                      | v4.0.0                       | Change       |
| ----------------------------------------------------------- | ---------------------------- | ---------------------------- | ------------ |
| Startup, eager (create + shutdown)                          | 18.90ms (18.11ms–20.88ms)    | 33.59ms (32.45ms–36.05ms)    | 1.78x slower |
| Startup, lazy (create + shutdown)                           | 8.45ms (7.17ms–10.41ms)      | 17.76ms (15.97ms–19.56ms)    | 2.10x slower |
| Startup, eager (create only)                                | 18.22ms (17.44ms–20.12ms)    | 32.16ms (31.12ms–34.53ms)    | 1.77x slower |
| Startup, lazy (create only)                                 | 7.96ms (6.67ms–9.85ms)       | 16.48ms (14.62ms–18.40ms)    | 2.07x slower |
| Shutdown, eager                                             | 680.38μs (669.81μs–759.18μs) | 1.43ms (1.33ms–1.48ms)       | 2.09x slower |
| Shutdown, lazy                                              | 506.66μs (478.36μs–561.30μs) | 1.29ms (1.18ms–1.34ms)       | 2.55x slower |
| Function call `math.add`, eager                             | 4.16μs (3.21μs–5.38μs)       | 5.93μs (4.61μs–7.70μs)       | 1.42x slower |
| Function call `math.add`, lazy first call (materialization) | 694.07μs (105.60μs–1.29ms)   | 946.82μs (185.95μs–1.72ms)   | 1.36x slower |
| Function call `math.add`, lazy subsequent                   | 5.56μs (4.19μs–7.09μs)       | 7.54μs (5.75μs–9.08μs)       | 1.36x slower |
| Nested `nested.date.today`, eager                           | 4.17μs (3.48μs–4.60μs)       | 5.88μs (5.05μs–8.43μs)       | 1.41x slower |
| Nested `nested.date.today`, lazy first call                 | 2.10ms (2.06ms–2.16ms)       | 3.29ms (3.24ms–3.41ms)       | 1.56x slower |
| Nested `nested.date.today`, lazy subsequent                 | 4.88μs (4.08μs–5.63μs)       | 6.51μs (6.05μs–7.02μs)       | 1.33x slower |
| `math/math.mjs`, eager                                      | 3.82μs (3.44μs–4.24μs)       | 5.19μs (4.50μs–6.13μs)       | 1.36x slower |
| `math/math.mjs`, lazy first call                            | 59.15μs (51.64μs–65.66μs)    | 91.20μs (82.67μs–96.63μs)    | 1.54x slower |
| `math/math.mjs`, lazy subsequent                            | 4.25μs (3.26μs–5.23μs)       | 5.58μs (5.12μs–6.23μs)       | 1.31x slower |
| `string/string.mjs`, eager                                  | 3.87μs (2.79μs–4.21μs)       | 5.15μs (4.39μs–5.98μs)       | 1.33x slower |
| `string/string.mjs`, lazy first call                        | 461.16μs (375.29μs–520.21μs) | 675.82μs (640.92μs–735.89μs) | 1.47x slower |
| `string/string.mjs`, lazy subsequent                        | 3.77μs (2.82μs–4.57μs)       | 5.10μs (4.56μs–5.83μs)       | 1.35x slower |
| `funcmod/funcmod.mjs`, eager                                | 1.89μs (1.71μs–2.30μs)       | 3.10μs (2.76μs–3.35μs)       | 1.64x slower |
| `funcmod/funcmod.mjs`, lazy first call                      | 465.73μs (433.63μs–479.13μs) | 726.40μs (718.59μs–738.44μs) | 1.56x slower |
| `funcmod/funcmod.mjs`, lazy subsequent                      | 1.93μs (1.75μs–2.07μs)       | 3.17μs (2.96μs–3.32μs)       | 1.64x slower |
| Realistic usage, eager                                      | 3.51μs (2.87μs–4.17μs)       | 5.26μs (4.77μs–5.75μs)       | 1.50x slower |
| Realistic usage, lazy                                       | 3.68μs (3.14μs–4.11μs)       | 6.32μs (5.41μs–6.46μs)       | 1.72x slower |

### v3.0.0 → v4.0.0

| Workload                                                    | v3.0.0                       | v4.0.0                       | Change         |
| ----------------------------------------------------------- | ---------------------------- | ---------------------------- | -------------- |
| Startup, eager (create + shutdown)                          | 9.02ms (8.68ms–9.69ms)       | 32.48ms (30.86ms–33.97ms)    | 3.60x slower   |
| Startup, lazy (create + shutdown)                           | 4.38ms (3.69ms–5.13ms)       | 16.36ms (14.59ms–19.11ms)    | 3.73x slower   |
| Startup, eager (create only)                                | 9.02ms (8.67ms–9.68ms)       | 31.12ms (29.63ms–32.46ms)    | 3.45x slower   |
| Startup, lazy (create only)                                 | 4.37ms (3.68ms–5.12ms)       | 15.21ms (13.41ms–18.02ms)    | 3.48x slower   |
| Shutdown, eager                                             | 9.37μs (8.28μs–9.79μs)       | 1.32ms (1.23ms–1.37ms)       | 141.13x slower |
| Shutdown, lazy                                              | 8.68μs (7.15μs–9.06μs)       | 1.15ms (1.11ms–1.19ms)       | 132.80x slower |
| Function call `math.add`, eager                             | 2.22μs (1.59μs–2.61μs)       | 6.24μs (4.62μs–7.40μs)       | 2.81x slower   |
| Function call `math.add`, lazy first call (materialization) | 289.34μs (67.93μs–571.04μs)  | 817.84μs (181.73μs–1.66ms)   | 2.83x slower   |
| Function call `math.add`, lazy subsequent                   | 2.97μs (2.27μs–4.22μs)       | 6.68μs (5.45μs–8.29μs)       | 2.25x slower   |
| Nested `nested.date.today`, eager                           | 2.99μs (2.85μs–3.10μs)       | 6.36μs (4.96μs–7.60μs)       | 2.13x slower   |
| Nested `nested.date.today`, lazy first call                 | 1.23ms (1.17ms–1.41ms)       | 3.19ms (3.09ms–3.28ms)       | 2.59x slower   |
| Nested `nested.date.today`, lazy subsequent                 | 2.52μs (2.42μs–2.89μs)       | 6.37μs (5.65μs–6.60μs)       | 2.53x slower   |
| `math/math.mjs`, eager                                      | 1.85μs (1.69μs–2.15μs)       | 4.94μs (4.43μs–5.93μs)       | 2.66x slower   |
| `math/math.mjs`, lazy first call                            | 27.89μs (25.97μs–29.62μs)    | 71.91μs (69.08μs–81.61μs)    | 2.58x slower   |
| `math/math.mjs`, lazy subsequent                            | 2.33μs (2.16μs–2.64μs)       | 5.55μs (5.17μs–5.90μs)       | 2.38x slower   |
| `string/string.mjs`, eager                                  | 1.67μs (1.29μs–2.05μs)       | 4.85μs (4.39μs–5.96μs)       | 2.90x slower   |
| `string/string.mjs`, lazy first call                        | 245.23μs (239.41μs–262.69μs) | 660.34μs (586.62μs–700.04μs) | 2.69x slower   |
| `string/string.mjs`, lazy subsequent                        | 1.80μs (1.69μs–2.43μs)       | 4.97μs (4.73μs–5.66μs)       | 2.76x slower   |
| `funcmod/funcmod.mjs`, eager                                | 0.68μs (0.65μs–0.73μs)       | 2.77μs (2.55μs–2.94μs)       | 4.06x slower   |
| `funcmod/funcmod.mjs`, lazy first call                      | 287.02μs (281.00μs–315.42μs) | 654.84μs (643.20μs–674.68μs) | 2.28x slower   |
| `funcmod/funcmod.mjs`, lazy subsequent                      | 0.95μs (0.90μs–0.95μs)       | 2.96μs (2.87μs–3.17μs)       | 3.13x slower   |
| Realistic usage, eager                                      | 2.13μs (1.73μs–2.19μs)       | 5.49μs (4.62μs–5.60μs)       | 2.57x slower   |
| Realistic usage, lazy                                       | 2.17μs (2.09μs–2.34μs)       | 5.35μs (5.18μs–6.09μs)       | 2.46x slower   |

The eager-versus-lazy analysis below was measured on v3.0.0 with `tests/performance/performance-benchmark-aggregated.mjs` and has not been re-run for v4. The trade-off it describes (lazy starts faster, both modes call at the same speed once materialized) still holds in the tables above.

---

## 🔬 Detailed Benchmark Results

### Startup Performance Comparison

```text
📊 Startup Time Analysis (Aggregated - February 21, 2026)
======================================
Eager Mode:  34.28ms (avg)
Lazy Mode:   15.41ms (avg)

Winner: Lazy mode (2.2x faster)
```

**Why Lazy Startup Wins:**

- ✅ No upfront module loading and compilation
- ✅ Deferred file system operations
- ✅ Minimal initial memory allocation
- ✅ Scales with actual usage, not potential usage

### Function Call Performance Comparison

```text
📊 Function Call Analysis (Aggregated - February 21, 2026)
===============================================
Eager Calls:       9.46μs (avg)
Lazy Subsequent:   9.99μs (avg)
Lazy First Call:   538μs (materialization overhead, avg across modules)

Winner: Equal (within 6% measurement noise)
```

**Why Performance is Equal:**

- ✅ **Fixed `__slothletPath` assignment** - Eager mode pre-assigns paths during loading
- ✅ **No runtime property definition** - Eliminated `Object.defineProperty` overhead in wrapper
- ✅ **Identical code paths** - Post-materialization, both modes execute the same functions
- ✅ **6% difference is measurement noise** - Single-digit microsecond timing inherently variable

### Realistic API Usage Performance

```text
📊 Realistic Usage (500 iterations, 41 unique API calls)
=========================================================
Eager Mode:  8.26μs (avg)
Lazy Mode:   7.75μs (avg)

Winner: Lazy mode (1.07x faster, within measurement noise)
```

**Performance Parity Achieved:**

- ✅ Tests diverse API usage patterns from actual test suite
- ✅ 41 unique function calls across all modules
- ✅ Both modes perform identically in real-world scenarios
- ✅ Differences within statistical noise at single-digit microsecond scale

### Materialization Analysis

```text
📊 Lazy Mode Materialization Breakdown (Aggregated - February 21, 2026)
====================================================
Module Type                    | First Call | Subsequent | Benefit
-------------------------------|------------|------------|--------
math/math.mjs (nested)         | ~107μs     | 6.37μs     | 17x
string/string.mjs (flattened)  | ~788μs     | 6.60μs     | 119x
funcmod/funcmod.mjs (callable) | ~774μs     | 4.79μs     | 162x

Average materialization cost: ~538μs per module (one-time)
```

**Materialization Insights:**

- ✅ One-time cost per module (not per function call)
- ✅ Deeper nesting = higher initial cost, same final performance
- ✅ Complex modules show bigger relative improvements
- ✅ Post-materialization performance equals eager mode

---

## 🎯 Performance Recommendations

### Choose **Lazy Mode** When:

🎯 **Fast startup is critical** (2.2x faster)

- Serverless functions with cold starts
- CLI tools that need instant responsiveness
- Development environments with frequent restarts

🎯 **Partial API usage expected**

- Only 20–50% of API surface area used
- Conditional feature loading
- Plugin-based architectures

🎯 **Memory efficiency matters**

- Large APIs with many unused endpoints
- Resource-constrained environments
- Microservices with many instances

### Choose **Eager Mode** When:

🚀 **Predictable behavior is required**

- Production systems requiring consistent latency
- Applications sensitive to timing variations
- When first-call materialization delays are unacceptable

🚀 **Full API usage expected**

- Using 80%+ of available modules
- Batch processing systems
- Long-running applications where startup time is amortized

🚀 **Simpler mental model preferred**

- All modules loaded upfront
- No materialization surprises
- Traditional synchronous initialization

**Note:** Function call performance is equal between modes post-materialization (within 6% measurement noise).

---

## ⚖️ Trade-off Analysis

### Performance Characteristics

| Aspect              | Lazy Mode       | Eager Mode      |
| ------------------- | --------------- | --------------- |
| **Startup**         | 15.41ms ⚡      | 34.28ms 🐌      |
| **Function Calls**  | 9.99μs ≈        | 9.46μs ≈        |
| **Realistic Usage** | 7.75μs ≈        | 8.26μs ≈        |
| **First Access**    | ~538μs overhead | Instant         |
| **Memory**          | On-demand ⚡    | Full upfront 🐌 |
| **Predictability**  | Variable 🐌     | Consistent ⚡   |

**Legend:** ⚡ Winner | 🐌 Slower | ≈ Equal (within measurement noise)

### Real-World Scenarios

**Lazy Mode Wins:**

```javascript
// Scenario: CLI tool using 2 out of 20 modules
Startup: 15.41ms vs 34.28ms = 2.2x faster ⚡
Memory: ~10% usage vs 100% = 90% savings ⚡
Total time: 15.41ms + (2 × 0.54ms) = 16.5ms vs 34.28ms
Function calls: 7.75μs vs 8.26μs = Equal (within 7%)
```

**Eager Mode Wins (Predictability):**

```javascript
// Scenario: Production API where consistent latency is critical
Startup: 34.28ms (one-time cost, amortized over lifetime)
Function calls: 9.46μs = Equal to lazy (within 6%)
First access: Instant (no materialization delay) ⚡
Predictability: No timing surprises ⚡
```

**Both Modes Equal:**

```javascript
// Function call performance after lazy materialization
Lazy:  9.99μs per call
Eager: 9.46μs per call
Difference: ~6% (within measurement noise)
Conclusion: Performance parity achieved ✅
```

---

## 🔧 Benchmark Methodology

### Test Environment

- **Node.js**: v24.13.1 (development conditions)
- **Platform**: Pop!\_OS 24.04 LTS (Linux, kernel 6.17.9)
- **CPU**: Intel® Xeon® E3-1270 v6 @ 3.80 GHz, 8 Logical Processors
- **RAM**: ~64 GB DDR4 @ 2400 MT/s
- **Test Suite**: 200+ iterations per measurement for statistical accuracy
- **API Directory**: `api_tests/api_test` (25+ modules)

### Module Categories Tested

**Root Modules (immediate load in lazy mode):**

- `root-function.mjs` → `rootFunction`
- `root-math.mjs` → `rootMath`
- `rootstring.mjs` → `rootstring`
- `config.mjs` → `config`

**Nested Modules (on-demand materialization in lazy mode):**

- `math/math.mjs` → `math`
- `string/string.mjs` → `string`
- `funcmod/funcmod.mjs` → `funcmod`
- `nested/date/date.mjs` → `nested.date`
- `util/*` → `util.*`

### Bidirectional Testing

Our benchmarks use a bidirectional approach to account for JIT compiler effects:

1. **Lazy-First Test**: Run lazy mode first, then eager mode
2. **Eager-First Test**: Run eager mode first, then lazy mode
3. **Aggregated Results**: Average results from both test orders

This methodology reveals:

- **High variance detection**: Identifies unreliable measurements
- **JIT warmup effects**: Shows compiler optimization impacts
- **Caching interference**: Detects cross-test contamination

### Comparing v3 and v4

`npm run test:performance:compare` runs the same workloads against v3.24.0 and against the current checkout on one machine, back to back. Run it once with `-- --setup` first: that installs `@cldmv/slothlet@3.24.0` from the npm registry into `tmp/perf-compare/v3` (or the folder given with `--v3-dir`) and extracts the `api_tests/api_test` fixtures and `api-test-config.jsonc` from the `v3.24.0` tag next to it. Each version loads its own copy of the fixture tree, because the fixtures import `@cldmv/slothlet/runtime` and must resolve to the build being measured. v3 runs its published `dist/`; v4 runs this checkout's `dist/` when one exists (run `npm run build` first) and otherwise `src/` through the `slothlet-dev` condition, which the report states. The workloads are the ones above: startup (create plus shutdown, with each half also reported), `math.add` calls, the nested `nested.date.today` module, the three per-module probes and realistic usage over the 41 config calls, drawn with a fixed seed so both versions make the same calls. Every run is a fresh Node process loading one build, and rounds alternate which version goes first and which mode goes first. The report gives the median over rounds with the interquartile range, the Node version, OS, CPU, RAM, the load average at start and end, and the iteration counts, and it lists any probe whose result differs between versions. It writes a JSON file and a markdown table to `tmp/perf-compare/results/`. By default each version runs with its own shipped defaults; `--match-v3-defaults` turns off v4's routine cascades (`routines: { auto: false, stack: false }`). `--quick` only proves the harness runs; its numbers mean nothing.

Both versions run the `api_tests/api_test` fixtures with the `replace` collision mode (the one the test suites use), because the fixtures collide on purpose (`math.mjs` against `math/`, `exportDefault`'s default export against its named `extra`) and the expected values in `api-test-config.jsonc` are the `replace` outcome. Under the default `merge` mode `api.math.add(2, 3)` returns 1005 and `api.exportDefault.extra()` returns "extra method", which is correct behaviour but not what the config expects.

### Verification Steps

- ✅ Function results identical between modes
- ✅ Function references become identical post-materialization
- ✅ 200+ iterations for statistical significance
- ✅ Fresh instances to avoid caching artifacts
- ✅ Bidirectional testing to account for order effects

---

## 📊 Detailed Performance Results

### Comprehensive Benchmark Data

```text
📊 AGGREGATED PERFORMANCE RESULTS (February 21, 2026)
================================

🚀 STARTUP PERFORMANCE:
   Eager: 34.28ms (avg)
   Lazy:  15.41ms (avg)
   Winner: Lazy mode (2.2x faster)

⚡ FUNCTION CALL PERFORMANCE:
   Eager:             9.46μs (avg)
   Lazy (first):      538μs (materialization)
   Lazy (subsequent): 9.99μs (avg)
   Winner: Equal (within 6% measurement noise)

🎯 COMPLEX MODULE PERFORMANCE:
   Eager:             8.76μs (avg)
   Lazy (first):      1.58ms (materialization)
   Lazy (subsequent): 12.48μs (avg)
   Winner: Equal (within measurement noise)

🔄 MULTI-MODULE ACCESS PATTERNS:

   Nested Math Module (math/math.mjs):
     Eager:             6.80μs
     Lazy (subsequent): 6.37μs
     Winner: Lazy (1.07x faster)

   String Module (string/string.mjs):
     Eager:             8.86μs
     Lazy (subsequent): 6.60μs
     Winner: Lazy (1.34x faster)

   Callable Function Module (funcmod/funcmod.mjs):
     Eager:             4.21μs
     Lazy (subsequent): 4.79μs
     Winner: Eager (1.14x faster)

🌐 REALISTIC API USAGE (⭐ HIGH WEIGHT - 500 iterations, 41 unique calls):
   Eager: 8.26μs (avg)
   Lazy:  7.75μs (avg)
   Winner: Lazy (1.07x faster)
```

### Per-Module Materialization Breakdown (Aggregated)

```text
📊 LAZY MODE MATERIALIZATION (Lazy-First / Eager-First / Avg)
=============================================================

math/math.mjs (nested structure):
  Lazy-first run:    131.74μs (materialization)
  Eager-first run:   83.02μs (materialization)
  Avg:               ~107μs
  Subsequent:        6.37μs (materialized)
  Benefit:           ~17x faster after materialization

string/string.mjs (flattened):
  Lazy-first run:    995.56μs (materialization)
  Eager-first run:   580.96μs (materialization)
  Avg:               ~788μs
  Subsequent:        6.60μs (materialized)
  Benefit:           ~119x faster after materialization

funcmod/funcmod.mjs (callable):
  Lazy-first run:    1.01ms (materialization)
  Eager-first run:   537.77μs (materialization)
  Avg:               ~774μs
  Subsequent:        4.79μs (materialized)
  Benefit:           ~162x faster after materialization
```

### Performance Variance Analysis

> [!WARNING]
> **Performance can vary significantly due to JIT compiler effects and system conditions.**
>
> These benchmarks represent a single test run. For production decisions, run multiple tests with your specific API structure and usage patterns.

```text
📈 BENCHMARK NOTES
==================

💡 MEASUREMENT CONSIDERATIONS:
   • JIT compiler effects can cause variance between runs
   • System load and background processes affect timing
   • First-run vs subsequent-run performance differs
   • Results are indicative, not absolute guarantees
   • Your mileage may vary based on actual usage patterns
```

---

## 📏 Raw Performance Data

```text
Benchmark Results (Aggregated - February 21, 2026)
==================================================
• Eager startup:       34.28ms
• Lazy startup:        15.41ms
• Eager calls:         9.46μs
• Lazy calls:          9.99μs
• Materialization:     ~538μs (average per module, aggregated)

Performance Ratios:
• Startup ratio:       2.2x faster (lazy)
• Call ratio:          Equal (within 6% measurement noise)
• Materialization:     ~57x improvement (538μs → 9.99μs)
```

---

## 🚀 Getting Started

### Running Benchmarks

```bash
# Run the comprehensive performance test suite
npm run test:performance
```

### Quick Performance Test

#### ESM (ES Modules)

```javascript
import slothlet from "@cldmv/slothlet";

console.time("eager-startup");
const eagerApi = await slothlet({ mode: "eager", base: "./api_tests/api_test" });
console.timeEnd("eager-startup");

console.time("lazy-startup");
const lazyApi = await slothlet({ mode: "lazy", base: "./api_tests/api_test" });
console.timeEnd("lazy-startup");

// Test your specific usage patterns
console.time("eager-calls");
for (let i = 0; i < 1000; i++) {
	eagerApi.math.add(2, 3);
}
console.timeEnd("eager-calls");

console.time("lazy-calls");
for (let i = 0; i < 1000; i++) {
	await lazyApi.math.add(2, 3);
}
console.timeEnd("lazy-calls");
```

#### CommonJS (CJS)

```javascript
const slothlet = require("@cldmv/slothlet");

async function performanceTest() {
	console.time("eager-startup");
	const eagerApi = await slothlet({ mode: "eager", base: "./api_tests/api_test" });
	console.timeEnd("eager-startup");

	console.time("lazy-startup");
	const lazyApi = await slothlet({ mode: "lazy", base: "./api_tests/api_test" });
	console.timeEnd("lazy-startup");

	// Test your specific usage patterns
	console.time("eager-calls");
	for (let i = 0; i < 1000; i++) {
		eagerApi.math.add(2, 3);
	}
	console.timeEnd("eager-calls");

	console.time("lazy-calls");
	for (let i = 0; i < 1000; i++) {
		await lazyApi.math.add(2, 3);
	}
	console.timeEnd("lazy-calls");
}

performanceTest().catch(console.error);
```

---

## 💡 Performance Tips

### For Lazy Mode Optimization

- ✅ **Organize frequently-used modules as root-level files** (loaded immediately)
- ✅ **Keep materialization costs low** with simple module exports
- ✅ **Consider pre-warming critical modules** if first-call latency matters
- ✅ **Profile actual usage patterns** to validate lazy mode benefits
- ✅ **Use shallow nesting** when possible for faster materialization

### For Eager Mode Optimization

- ✅ **Optimize module loading order** for faster startup
- ✅ **Use tree-shaking** to reduce bundle size in build processes
- ✅ **Profile memory usage** in production environments
- ✅ **Prefer eager for high-frequency call paths** (> 1000 calls/second)
- ✅ **Consider eager in memory-abundant environments**

### General Performance Optimization

- ✅ **Avoid deep nesting** when possible (increases materialization time)
- ✅ **Use meaningful module names** for better debugging and profiling
- ✅ **Profile your specific workload** rather than relying solely on benchmarks
- ✅ **Monitor real-world performance metrics** in production
- ✅ **Consider hybrid approaches** (eager for core, lazy for optional features)

### Development vs Production Considerations

**Development Mode:**

- Loads from `src/` directory
- More detailed error messages
- Higher startup overhead
- Use lazy mode for faster iteration

**Production Mode:**

- Loads from `dist/` directory
- Optimized transpiled code
- Lower overhead across the board
- Consider eager mode for predictable performance

---

## 🔍 Statistical Notes

### Measurement Accuracy

- **Microsecond precision**: Inherent variance in sub-millisecond measurements
- **JIT compiler effects**: First runs may show different performance characteristics
- **System load impact**: Background processes can affect timing
- **Memory pressure**: Available system memory affects performance

### Benchmark Limitations

- **Synthetic workloads**: May not reflect real-world usage patterns
- **Single-threaded**: Node.js single-threaded nature affects results
- **Platform-specific**: Results may vary on different operating systems
- **Node.js version**: Performance characteristics change between Node.js versions

### Recommendations for Your Application

1. **Run your own benchmarks** with your actual API structure
2. **Test with your expected usage patterns** (module access frequency)
3. **Measure in your target deployment environment**
4. **Consider both startup and runtime performance** for your use case
5. **Profile memory usage** if running in constrained environments

---

**📊 Performance analysis updated: February 21, 2026** **🔬 Based on slothlet v3.0.0** **📈 All metrics from `tests/performance/performance-benchmark-aggregated.mjs`**
