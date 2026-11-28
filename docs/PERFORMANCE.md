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

v4.0.0 is slower than v3 on every workload measured. Against v3.24.0, creating an instance is 1.63x slower in eager mode and 1.77x slower in lazy mode, shutdown is 1.89x (eager) and 2.23x (lazy) slower, a call through the api is 1.01x–1.61x slower (`math.add` eager 1.24x, realistic usage 1.61x eager and 1.48x lazy), and a lazy module's first call is 1.36x–1.62x slower. Against v3.0.0, creating an instance is 3.02x (eager) and 3.05x (lazy) slower, a call 1.88x–3.63x slower, a lazy first call 2.08x–2.62x slower, and shutdown 114x–117x slower (v3.0.0 did almost nothing on shutdown). The added cost comes from what v4 does on every call and every instance: each `run()` / `scope()` and each call is kept apart from every other flow in every permission mode, a run reads a snapshot of the instance, and the async runtime installs a process-wide hook (see [MIGRATION.md](./MIGRATION.md#process-wide-hooks-while-an-instance-exists)). For most apps a few microseconds per call and a few milliseconds per instance are small next to the work the calls do; if a hot loop calls a tiny function millions of times, measure it.

Measured 2026-11-25 with `npm run test:performance:compare` at the v4.0.0 release commit: each version ran alone (`--only`) in its own container limited to 8 CPUs and 16 GiB, one after another on the same host, and the results were merged with `--report` (see [Comparing v3 and v4](#comparing-v3-and-v4)). Node v26.13.1, Ubuntu 24.04.5 LTS (linux 7.0.0-43-generic, x64), AMD Ryzen Threadripper 9970X 32-Cores. 8 rounds per version, each a fresh process; iterations per round: startup 50, function calls 200, nested 200, per-module 100, realistic 500 (41 distinct calls). Every version runs its built `dist/` with its own shipped defaults; v3.0.0 gets the api folder as `dir`, its name for `base`. The host was shared with other work: its load average (1 min) was 8.17 at the start of the v3.0.0 run, 7.76 for v3.24.0 and 5.86 for v4.0.0. Each cell is the median over rounds, with the interquartile range in brackets.

| Workload                                                    | v3.0.0                       | v3.24.0                      | v4.0.0                       | v4 vs v3.0.0   | v4 vs v3.24.0 |
| ----------------------------------------------------------- | ---------------------------- | ---------------------------- | ---------------------------- | -------------- | ------------- |
| Startup, eager (create + shutdown)                          | 9.72ms (9.37ms–10.37ms)      | 18.69ms (17.31ms–20.92ms)    | 30.64ms (29.15ms–32.28ms)    | 3.15x slower   | 1.64x slower  |
| Startup, lazy (create + shutdown)                           | 4.92ms (4.05ms–5.70ms)       | 8.99ms (7.93ms–10.14ms)      | 16.17ms (13.92ms–18.25ms)    | 3.29x slower   | 1.80x slower  |
| Startup, eager (create only)                                | 9.71ms (9.36ms–10.35ms)      | 17.99ms (16.67ms–20.13ms)    | 29.37ms (27.85ms–30.86ms)    | 3.02x slower   | 1.63x slower  |
| Startup, lazy (create only)                                 | 4.91ms (4.04ms–5.69ms)       | 8.46ms (7.40ms–9.58ms)       | 14.97ms (12.66ms–17.12ms)    | 3.05x slower   | 1.77x slower  |
| Shutdown, eager                                             | 11.16μs (10.30μs–11.95μs)    | 694.26μs (655.77μs–784.02μs) | 1.31ms (1.30ms–1.38ms)       | 117.26x slower | 1.89x slower  |
| Shutdown, lazy                                              | 10.58μs (8.62μs–11.01μs)     | 541.86μs (519.64μs–562.07μs) | 1.21ms (1.15ms–1.22ms)       | 114.30x slower | 2.23x slower  |
| Function call `math.add`, eager                             | 2.58μs (1.75μs–2.85μs)       | 4.39μs (3.27μs–5.54μs)       | 5.46μs (4.17μs–6.57μs)       | 2.11x slower   | 1.24x slower  |
| Function call `math.add`, lazy first call (materialization) | 313.60μs (77.56μs–583.09μs)  | 588.41μs (101.11μs–1.25ms)   | 820.94μs (167.86μs–1.48ms)   | 2.62x slower   | 1.40x slower  |
| Function call `math.add`, lazy subsequent                   | 3.49μs (2.51μs–4.40μs)       | 5.64μs (4.35μs–7.22μs)       | 7.56μs (5.41μs–8.05μs)       | 2.17x slower   | 1.34x slower  |
| Nested `nested.date.today`, eager                           | 2.75μs (2.50μs–3.04μs)       | 4.22μs (3.49μs–4.97μs)       | 5.17μs (4.67μs–6.82μs)       | 1.88x slower   | 1.23x slower  |
| Nested `nested.date.today`, lazy first call                 | 1.42ms (1.29ms–1.48ms)       | 2.17ms (2.10ms–2.29ms)       | 2.97ms (2.96ms–3.01ms)       | 2.08x slower   | 1.37x slower  |
| Nested `nested.date.today`, lazy subsequent                 | 2.65μs (2.53μs–3.14μs)       | 5.14μs (4.47μs–5.36μs)       | 5.68μs (5.42μs–6.64μs)       | 2.14x slower   | 1.11x slower  |
| `math/math.mjs`, eager                                      | 1.87μs (1.63μs–2.25μs)       | 3.78μs (3.13μs–4.38μs)       | 4.65μs (3.96μs–13.35μs)      | 2.49x slower   | 1.23x slower  |
| `math/math.mjs`, lazy first call                            | 29.73μs (28.01μs–31.35μs)    | 53.85μs (49.51μs–57.70μs)    | 74.05μs (71.50μs–78.86μs)    | 2.49x slower   | 1.38x slower  |
| `math/math.mjs`, lazy subsequent                            | 2.47μs (2.24μs–2.71μs)       | 4.82μs (3.89μs–5.04μs)       | 4.88μs (4.60μs–5.90μs)       | 1.98x slower   | 1.01x slower  |
| `string/string.mjs`, eager                                  | 1.92μs (1.28μs–2.17μs)       | 4.10μs (2.91μs–4.30μs)       | 4.57μs (4.03μs–5.70μs)       | 2.38x slower   | 1.11x slower  |
| `string/string.mjs`, lazy first call                        | 261.51μs (247.77μs–318.12μs) | 393.91μs (361.07μs–449.11μs) | 636.20μs (586.45μs–647.86μs) | 2.43x slower   | 1.62x slower  |
| `string/string.mjs`, lazy subsequent                        | 2.15μs (1.94μs–2.51μs)       | 3.64μs (3.04μs–4.67μs)       | 4.99μs (4.28μs–5.43μs)       | 2.32x slower   | 1.37x slower  |
| `funcmod/funcmod.mjs`, eager                                | 0.73μs (0.71μs–0.76μs)       | 1.78μs (1.67μs–1.84μs)       | 2.65μs (2.58μs–2.77μs)       | 3.63x slower   | 1.48x slower  |
| `funcmod/funcmod.mjs`, lazy first call                      | 290.84μs (278.64μs–348.06μs) | 468.34μs (444.13μs–514.01μs) | 636.64μs (581.71μs–651.17μs) | 2.19x slower   | 1.36x slower  |
| `funcmod/funcmod.mjs`, lazy subsequent                      | 0.95μs (0.87μs–1.01μs)       | 1.96μs (1.90μs–2.09μs)       | 2.71μs (2.65μs–2.82μs)       | 2.85x slower   | 1.39x slower  |
| Realistic usage, eager                                      | 2.02μs (1.90μs–2.28μs)       | 3.30μs (2.93μs–4.29μs)       | 5.30μs (4.73μs–6.53μs)       | 2.62x slower   | 1.61x slower  |
| Realistic usage, lazy                                       | 2.23μs (2.15μs–2.39μs)       | 3.77μs (3.60μs–3.96μs)       | 5.59μs (4.85μs–5.77μs)       | 2.50x slower   | 1.48x slower  |

The eager-versus-lazy analysis below was measured on v3.0.0 with `tests/performance/performance-benchmark-aggregated.mjs` on a different machine and has not been re-run for v4. The trade-off it describes (lazy starts faster, both modes call at about the same speed once materialized) still holds in the table above.

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

`npm run test:performance:compare` runs the same workloads against v3.24.0 and against the current checkout on one machine, back to back. Run it once with `-- --setup` first: that installs `@cldmv/slothlet@3.24.0` from the npm registry into `tmp/perf-compare/v3.24.0` (or the folder given with `--v3-dir`) and extracts the `api_tests/api_test` fixtures and `api-test-config.jsonc` from the `v3.24.0` tag next to it (from the local tag, or from GitHub's archive of the tag when there is no git checkout). `--v3-version=<x.y.z>` measures another v3 release the same way; releases before 3.9.0 get the api folder as `dir`, their name for `base`. Each version loads its own copy of the fixture tree, because the fixtures import `@cldmv/slothlet/runtime` and must resolve to the build being measured. v3 runs its published `dist/`; v4 runs this checkout's `dist/` when one exists (run `npm run build` first) and otherwise `src/` through the `slothlet-dev` condition, which the report states. The workloads are the ones above: startup (create plus shutdown, with each half also reported), `math.add` calls, the nested `nested.date.today` module, the three per-module probes and realistic usage over the 41 config calls, drawn with a fixed seed so both versions make the same calls. Every run is a fresh Node process loading one build, and rounds alternate which version goes first and which mode goes first. The report gives the median over rounds with the interquartile range, the Node version, OS, CPU, RAM, the load average at start and end, and the iteration counts, and it lists any probe whose result differs between versions. It writes a JSON file and a markdown table to `tmp/perf-compare/results/`. By default each version runs with its own shipped defaults; `--match-v3-defaults` turns off v4's routine cascades (`routines: { auto: false, stack: false }`). `--quick` only proves the harness runs; its numbers mean nothing.

To give each version a machine or container of its own, run one version at a time with `--only=v3` or `--only=v4`, then merge the results with `--report`:

```bash
npm run build
npm run test:performance:compare -- --setup --v3-version=3.0.0
npm run test:performance:compare -- --only=v3 --v3-version=3.0.0 --out=tmp/perf/v3.0.0     # container 1
npm run test:performance:compare -- --setup
npm run test:performance:compare -- --only=v3 --out=tmp/perf/v3.24.0                      # container 2
npm run test:performance:compare -- --only=v4 --out=tmp/perf/v4                           # container 3
npm run test:performance:compare -- --report=tmp/perf/v3.0.0/<file>.json,tmp/perf/v3.24.0/<file>.json,tmp/perf/v4/<file>.json
```

The merged table has a column per version in the order given and compares the last with each earlier one. Each version's line states its own machine, CPU limit (read from the container's cgroup) and load average, so give every run the same machine and limits and run them one after another, not side by side.

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
