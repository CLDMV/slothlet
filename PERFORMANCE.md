# 🚀 Slothlet Performance Analysis

> **Comprehensive benchmarks comparing eager vs lazy loading strategies**

This document provides detailed performance analysis of Slothlet's loading modes based on real-world benchmarks. All tests are reproducible using `npm run test:performance`.

## 📊 Executive Summary

> [!NOTE] > **Performance Winner Depends on Your Use Case**
>
> | Metric             | Lazy Mode           | Eager Mode   | Winner       | Improvement       |
> | ------------------ | ------------------- | ------------ | ------------ | ----------------- |
> | **Startup Time**   | 564.17μs            | 2.45ms       | 🎯 **Lazy**  | **4.3x faster**   |
> | **Function Calls** | 0.72μs              | 0.65μs       | 🚀 **Eager** | **1.1x faster**   |
> | **Memory Usage**   | On-demand           | Full upfront | 🎯 **Lazy**  | Scales with usage |
> | **Predictability** | Variable first-call | Consistent   | 🚀 **Eager** | No surprises      |

### Key Takeaways

> [!TIP] > **Choose your loading strategy based on your specific needs:**
>
> - ✅ **Lazy mode excels at startup** - 4.3x faster initialization
> - ✅ **Eager mode excels at runtime** - 1.1x faster function calls
> - ✅ **Materialization cost is minimal** - ~310μs one-time overhead per module
> - ✅ **Both modes are production-ready** with different optimization targets

---

## 🔬 Detailed Benchmark Results

### Startup Performance Comparison

```text
📊 Startup Time Analysis
========================
Eager Mode:  2.45ms (avg) | 1.59ms (min) | 16.30ms (max)
Lazy Mode:   564.17μs (avg) | 239.50μs (min) | 12.96ms (max)

Winner: Lazy mode (4.3x faster)
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
Eager Calls:       0.65μs (avg) | 0.30μs (min) | 29.20μs (max)
Lazy Subsequent:   0.72μs (avg) | 0.50μs (min) | 12.10μs (max)
Lazy First Call:   310.30μs (materialization overhead)

Winner: Eager mode (1.1x faster after materialization)
```

**Why Eager Function Calls Win:**

- ✅ Direct function references (no proxy overhead)
- ✅ No materialization checks required
- ✅ Optimized V8 compilation paths
- ✅ Consistent performance characteristics

### Materialization Analysis

```text
📊 Lazy Mode Materialization Breakdown
======================================
Module Type                    | First Call | Subsequent | Benefit
-------------------------------|------------|------------|--------
math/math.mjs (nested)         | 330.55μs   | 0.79μs     | 418.5x
string/string.mjs (flattened)  | 190.05μs   | 0.58μs     | 328.0x
funcmod/funcmod.mjs (callable) | 232.95μs   | 0.96μs     | 242.7x
nested/date/date.mjs (deep)    | 322.90μs   | 0.55μs     | 586.9x

Average materialization cost: ~310μs per module
```

**Materialization Insights:**

- ✅ One-time cost per module (not per function call)
- ✅ Deeper nesting = higher initial cost, same final performance
- ✅ Complex modules show bigger relative improvements
- ✅ Post-materialization performance approaches eager mode

---

## 🎯 Performance Recommendations

### Choose **Lazy Mode** When:

🎯 **Fast startup is critical**

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
| **Startup**        | 564.17μs ⚡     | 2.45ms 🐌       |
| **Function Calls** | 0.72μs 🐌       | 0.65μs ⚡       |
| **First Access**   | ~310μs overhead | Instant         |
| **Memory**         | On-demand ⚡    | Full upfront 🐌 |
| **Predictability** | Variable 🐌     | Consistent ⚡   |

### Real-World Scenarios

**Lazy Mode Wins:**

```javascript
// Scenario: CLI tool using 2 out of 20 modules
Startup: 564μs vs 2450μs = 4.3x faster
Memory: ~10% usage vs 100% = 90% savings
Total time: 564μs + (2 × 310μs) = 1184μs vs 2450μs
```

**Eager Mode Wins:**

```javascript
// Scenario: API server using 18 out of 20 modules
Function calls: 0.65μs vs 0.72μs per call
Over 1M calls: 650ms vs 720ms = 70ms savings
Predictable latency: No materialization surprises
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
   Eager: 2.45ms (avg) | Range: 1.59ms - 16.30ms
   Lazy:  564.17μs (avg) | Range: 239.50μs - 12.96ms
   Winner: Lazy mode (4.3x faster)

⚡ FUNCTION CALL PERFORMANCE:
   Eager:             0.65μs (avg)
   Lazy (first):      310.30μs (materialization)
   Lazy (subsequent): 0.72μs (avg)
   Winner: Eager mode (1.1x faster after materialization)

🎯 COMPLEX MODULE PERFORMANCE:
   Eager:             0.60μs (avg)
   Lazy (first):      322.90μs (materialization)
   Lazy (subsequent): 0.55μs (avg)
   Winner: Lazy mode (1.09x faster after materialization)

🔄 MULTI-MODULE ACCESS PATTERNS:

   Nested Math Module (math/math.mjs):
     Eager:             0.74μs
     Lazy (subsequent): 0.79μs
     Winner: Eager (1.07x faster)

   String Module (string/string.mjs):
     Eager:             0.69μs
     Lazy (subsequent): 0.58μs
     Winner: Lazy (1.19x faster)

   Callable Function Module (funcmod/funcmod.mjs):
     Eager:             0.54μs
     Lazy (subsequent): 0.96μs
     Winner: Eager (1.78x faster)
```

### Performance Variance Analysis

> [!WARNING] > **Performance can vary significantly due to JIT compiler effects and system conditions.**
>
> The data below shows variance between different test run orders. Use these benchmarks as general guidance rather than absolute guarantees.

```text
📈 BENCHMARK RELIABILITY ANALYSIS
=================================

🚀 STARTUP TIME CONSISTENCY:
   Eager Mode:
     • Test Order 1: 2.29ms
     • Test Order 2: 2.61ms
     • Variance: 13.6% ✅ STABLE

   Lazy Mode:
     • Test Order 1: 804.51μs
     • Test Order 2: 323.83μs
     • Variance: 148.4% ❌ HIGH VARIANCE

⚡ FUNCTION CALL CONSISTENCY:
   Eager Mode:
     • Test Order 1: 0.46μs
     • Test Order 2: 0.85μs
     • Variance: 87.3% ❌ HIGH VARIANCE

   Lazy Mode:
     • Test Order 1: 0.68μs
     • Test Order 2: 0.76μs
     • Variance: 11.6% ✅ STABLE

💡 RELIABILITY INSIGHTS:
   • Both modes show some variance due to JIT compiler effects
   • Results are consistent enough for general performance guidance
   • Real-world performance may vary based on specific usage patterns
```

---

## 📏 Raw Performance Data

```text
Benchmark Results (Latest Aggregated Run)
==========================================
• Eager startup:       2.45ms
• Lazy startup:        564.17μs
• Eager calls:         0.65μs
• Lazy calls:          0.72μs
• Materialization:     310.30μs (average per module)

Performance Ratios:
• Startup ratio:       4.3x faster (lazy)
• Call ratio:          1.1x faster (eager)
• Materialization:     ~430x improvement (310μs → 0.72μs)
```

### Individual Module Performance

```text
🔍 PER-MODULE MATERIALIZATION BREAKDOWN
=======================================

math/math.mjs (nested structure):
  First Call:    330.55μs (materialization)
  Subsequent:    0.79μs (materialized)
  Benefit:       418.5x faster after materialization

string/string.mjs (flattened):
  First Call:    190.05μs (materialization)
  Subsequent:    0.58μs (materialized)
  Benefit:       328.0x faster after materialization

funcmod/funcmod.mjs (callable):
  First Call:    232.95μs (materialization)
  Subsequent:    0.96μs (materialized)
  Benefit:       242.7x faster after materialization

nested/date/date.mjs (deep nesting):
  First Call:    322.90μs (materialization)
  Subsequent:    0.55μs (materialized)
  Benefit:       586.9x faster after materialization
```

---

## 🚀 Getting Started

### Running Benchmarks

```bash
# Set development environment (loads from src/ instead of dist/)
set NODE_ENV=development
set NODE_OPTIONS=--conditions=development

# Run the comprehensive performance test suite
node tests/performance-benchmark-aggregated.mjs

# Run individual performance tests
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

**📊 Performance analysis updated: September 1, 2025**  
**🔬 Based on slothlet v2.0 with bidirectional benchmarking methodology**
