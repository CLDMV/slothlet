# 🚀 Slothlet Performance Analysis

> **Comprehensive benchmarks comparing eager vs lazy loading strategies**

This document provides detailed performance analysis of Slothlet's loading modes based on real-world benchmarks. All tests are reproducible using `npm run test:performance`.

## 📊 Executive Summary

> [!NOTE] > **Performance Winner Depends on Your Use Case**
>
> | Metric             | Lazy Mode           | Eager Mode   | Winner       | Improvement       |
> | ------------------ | ------------------- | ------------ | ------------ | ----------------- |
> | **Startup Time**   | 4.89ms              | 14.29ms      | 🎯 **Lazy**  | **2.9x faster**   |
> | **Function Calls** | 0.99μs              | 0.90μs       | 🚀 **Eager** | **1.1x faster**   |
> | **Memory Usage**   | On-demand           | Full upfront | 🎯 **Lazy**  | Scales with usage |
> | **Predictability** | Variable first-call | Consistent   | 🚀 **Eager** | No surprises      |

### Key Takeaways

> [!TIP] > **Choose your loading strategy based on your specific needs:**
>
> - ✅ **Lazy mode excels at startup** - 2.9x faster initialization
> - ✅ **Eager mode excels at runtime** - 1.1x faster function calls
> - ✅ **Materialization cost is minimal** - ~371μs one-time overhead per module
> - ✅ **Both modes are production-ready** with different optimization targets

---

## 🔬 Detailed Benchmark Results

### Startup Performance Comparison

```text
📊 Startup Time Analysis
========================
Eager Mode:  14.29ms (avg) | 11.82ms (min) | 41.17ms (max)
Lazy Mode:   4.89ms (avg) | 3.62ms (min) | 42.20ms (max)

Winner: Lazy mode (2.9x faster)
```

**Why Lazy Startup Wins:**

- ✅ No upfront module loading and compilation
- ✅ Deferred file system operations
- ✅ Minimal initial memory allocation
- ✅ Scales with actual usage, not potential usage

### Function Call Performance Comparison

```text
📊 Function Call Analysis (aggregated benchmark)
===============================================
Eager Calls:       0.90μs (avg) | 0.60μs (min) | 41.70μs (max)
Lazy Subsequent:   0.99μs (avg) | 0.60μs (min) | 43.70μs (max)
Lazy First Call:   371μs (materialization overhead)

Winner: Eager mode (1.1x faster)
```

**Why Eager Function Calls Win:**

- ✅ No proxy overhead after startup
- ✅ Direct function references without wrapping
- ✅ Consistent performance characteristics
- ✅ V8 can optimize more aggressively with stable references

### Materialization Analysis

```text
📊 Lazy Mode Materialization Breakdown
======================================
Module Type                    | First Call | Subsequent | Benefit
-------------------------------|------------|------------|--------
math/math.mjs (nested)         | 316.10μs   | 0.82μs     | 385.5x
string/string.mjs (flattened)  | 277.93μs   | 1.12μs     | 248.2x
funcmod/funcmod.mjs (callable) | 283.35μs   | 0.91μs     | 311.4x

Average materialization cost: ~371μs per module
```

**Materialization Insights:**

- ✅ One-time cost per module (not per function call)
- ✅ Deeper nesting = higher initial cost, same final performance
- ✅ Complex modules show bigger relative improvements
- ✅ Post-materialization performance approaches eager mode

---

## 🎯 Performance Recommendations

### Choose **Lazy Mode** When:

🎯 **Fast startup is critical** (2.9x faster)

- Serverless functions with cold starts
- CLI tools that need instant responsiveness
- Development environments with frequent restarts

🎯 **Memory efficiency matters**

- Large APIs with many unused endpoints
- Resource-constrained environments
- Microservices using subset functionality

🎯 **Usage patterns are sparse**

- Only 20-50% of API surface area used
- Conditional feature loading
- Plugin-based architectures

### Choose **Eager Mode** When:

🚀 **Function call performance is critical**

- High-throughput applications
- Real-time processing systems
- Performance-sensitive inner loops

🚀 **Predictable behavior is required**

- Production systems requiring consistent latency
- Applications sensitive to timing variations
- When materialization delays are unacceptable

🚀 **Full API usage expected**

- Using 80%+ of available modules
- Batch processing systems
- Long-running applications

---

## ⚖️ Trade-off Analysis

### Performance Characteristics

| Aspect             | Lazy Mode       | Eager Mode      |
| ------------------ | --------------- | --------------- |
| **Startup**        | 4.89ms ⚡       | 14.29ms 🐌      |
| **Function Calls** | 0.99μs 🐌       | 0.90μs ⚡       |
| **First Access**   | ~371μs overhead | Instant         |
| **Memory**         | On-demand ⚡    | Full upfront 🐌 |
| **Predictability** | Variable 🐌     | Consistent ⚡   |

### Real-World Scenarios

**Lazy Mode Wins:**

```javascript
// Scenario: CLI tool using 2 out of 20 modules
Startup: 4.89ms vs 14.29ms = 2.9x faster
Memory: ~10% usage vs 100% = 90% savings
Total time: 4.89ms + (2 × 0.371ms) = 5.63ms vs 14.29ms
```

**Eager Mode Wins:**

```javascript
// Scenario: High-throughput API using most modules
Consistent latency: No materialization surprises
Function calls: 0.90μs vs 0.99μs = 1.1x faster (eager)
Note: For call-intensive workloads, eager's predictability and speed win
```

---

## 🔧 Benchmark Methodology

### Test Environment

- **Node.js**: v22+ (development conditions)
- **Platform**: Windows 11
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
📊 AGGREGATED PERFORMANCE RESULTS
================================

🚀 STARTUP PERFORMANCE:
   Eager: 14.29ms (avg) | Range: 11.82ms - 41.17ms
   Lazy:  4.89ms (avg) | Range: 3.62ms - 42.20ms
   Winner: Lazy mode (2.9x faster)

⚡ FUNCTION CALL PERFORMANCE:
   Eager:             0.90μs (avg)
   Lazy (first):      371μs (materialization)
   Lazy (subsequent): 0.99μs (avg)
   Winner: Eager mode (1.1x faster)

🎯 COMPLEX MODULE PERFORMANCE:
   Eager:             0.91μs (avg)
   Lazy (first):      440μs (materialization)
   Lazy (subsequent): 0.98μs (avg)
   Winner: Eager mode (1.1x faster)

🔄 MULTI-MODULE ACCESS PATTERNS:

   Nested Math Module (math/math.mjs):
     Eager:             0.89μs
     Lazy (subsequent): 0.98μs
     Winner: Eager (1.1x faster)

   String Module (string/string.mjs):
     Eager:             1.08μs
     Lazy (subsequent): 1.26μs
     Winner: Eager (1.2x faster)

   Callable Function Module (funcmod/funcmod.mjs):
     Eager:             0.57μs
     Lazy (subsequent): 0.91μs
     Winner: Eager (1.6x faster)
```

### Performance Variance Analysis

> [!WARNING] > **Performance can vary significantly due to JIT compiler effects and system conditions.**
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
Benchmark Results (Latest Run - December 30, 2025)
===================================================
• Eager startup:       14.29ms
• Lazy startup:        4.89ms
• Eager calls:         0.90μs
• Lazy calls:          0.99μs
• Materialization:     371μs (average per module)

Performance Ratios:
• Startup ratio:       2.9x faster (lazy)
• Call ratio:          1.1x faster (eager)
• Materialization:     ~375x improvement (371μs → 0.99μs)
```

### Individual Module Performance

```text
🔍 PER-MODULE MATERIALIZATION BREAKDOWN
=======================================

math/math.mjs (nested structure):
  First Call:    316.10μs (materialization)
  Subsequent:    0.82μs (materialized)
  Benefit:       385.5x faster after materialization

string/string.mjs (flattened):
  First Call:    277.93μs (materialization)
  Subsequent:    1.12μs (materialized)
  Benefit:       248.2x faster after materialization

funcmod/funcmod.mjs (callable):
  First Call:    283.35μs (materialization)
  Subsequent:    0.91μs (materialized)
  Benefit:       311.4x faster after materialization
```

---

## 🚀 Getting Started

### Running Benchmarks

```bash
# Set development environment (loads from src/ instead of dist/)
set NODE_ENV=development
set NODE_OPTIONS=--conditions=development

# Run the comprehensive performance test suite
npm run test:performance

# Or run directly
node tests/performance-benchmark.mjs
```

### Quick Performance Test

#### ESM (ES Modules)

```javascript
import slothlet from "@cldmv/slothlet";

console.time("eager-startup");
const eagerApi = await slothlet({ lazy: false, dir: "./api_tests/api_test" });
console.timeEnd("eager-startup");

console.time("lazy-startup");
const lazyApi = await slothlet({ lazy: true, dir: "./api_tests/api_test" });
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
	const eagerApi = await slothlet({ lazy: false, dir: "./api_tests/api_test" });
	console.timeEnd("eager-startup");

	console.time("lazy-startup");
	const lazyApi = await slothlet({ lazy: true, dir: "./api_tests/api_test" });
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

**📊 Performance analysis updated: December 30, 2025**  
**🔬 Based on slothlet v2.8.0 with controlled performance testing methodology**
