# 🚀 Slothlet Performance Analysis

> **Comprehensive benchmarks comparing eager vs lazy loading strategies**

This document provides detailed performance analysis of Slothlet's loading modes based on real-world benchmarks. All tests are reproducible using `npm run test:performance`.

## 📊 Executive Summary

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

| Aspect              | Lazy Mode        | Eager Mode       |
| ------------------- | ---------------- | ---------------- |
| **Startup**         | 15.41ms ⚡       | 34.28ms 🐌       |
| **Function Calls**  | 9.99μs ≈         | 9.46μs ≈         |
| **Realistic Usage** | 7.75μs ≈         | 8.26μs ≈         |
| **First Access**    | ~538μs overhead  | Instant          |
| **Memory**          | On-demand ⚡     | Full upfront 🐌  |
| **Predictability**  | Variable 🐌      | Consistent ⚡    |

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
- **Platform**: Pop!_OS 24.04 LTS (Linux, kernel 6.17.9)
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
const eagerApi = await slothlet({ mode: "eager", dir: "./api_tests/api_test" });
console.timeEnd("eager-startup");

console.time("lazy-startup");
const lazyApi = await slothlet({ mode: "lazy", dir: "./api_tests/api_test" });
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
	const eagerApi = await slothlet({ mode: "eager", dir: "./api_tests/api_test" });
	console.timeEnd("eager-startup");

	console.time("lazy-startup");
	const lazyApi = await slothlet({ mode: "lazy", dir: "./api_tests/api_test" });
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

**📊 Performance analysis updated: February 21, 2026**  
**🔬 Based on slothlet v3.0.0**  
**📈 All metrics from `tests/performance/performance-benchmark-aggregated.mjs`**
