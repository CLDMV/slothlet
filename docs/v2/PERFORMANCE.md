# 🚀 Slothlet Performance Analysis

> **Comprehensive benchmarks comparing eager vs lazy loading strategies**

This document provides detailed performance analysis of Slothlet's loading modes based on real-world benchmarks. All tests are reproducible using `npm run test:performance`.

## 📊 Executive Summary

> [!NOTE]
> **Performance Winner Depends on Your Use Case**
>
> | Metric              | Lazy Mode           | Eager Mode   | Winner       | Improvement     |
> | ------------------- | ------------------- | ------------ | ------------ | --------------- |
> | **Startup Time**    | 7.92ms              | 27.92ms      | 🎯 **Lazy**  | **3.5x faster** |
> | **Function Calls**  | 1.14μs              | 1.23μs       | ≈ **Equal**  | **Within 8%**   |
> | **Realistic Usage** | 1.14μs              | 1.23μs       | ≈ **Equal**  | **Within 8%**   |
> | **Memory Usage**    | On-demand           | Full upfront | 🎯 **Lazy**  | Scales with use |
> | **Predictability**  | Variable first-call | Consistent   | 🚀 **Eager** | No surprises    |

### Key Takeaways

> [!TIP]
> **Choose your loading strategy based on your specific needs:**
>
> - ✅ **Lazy mode excels at startup** - 3.5x faster initialization
> - ✅ **Both modes equal at runtime** - Post-materialization performance identical (within measurement noise)
> - ✅ **Materialization cost is one-time** - ~650-970μs per module, only on first access
> - ✅ **Both modes are production-ready** with different optimization targets

---

## 🔬 Detailed Benchmark Results

### Startup Performance Comparison

```text
📊 Startup Time Analysis (Aggregated - January 13, 2026)
======================================
Eager Mode:  27.92ms (avg) | 26.06ms (min) | 36.06ms (max)
Lazy Mode:   7.92ms (avg) | 6.87ms (min) | 36.19ms (max)

Winner: Lazy mode (3.5x faster)
```

**Why Lazy Startup Wins:**

- ✅ No upfront module loading and compilation
- ✅ Deferred file system operations
- ✅ Minimal initial memory allocation
- ✅ Scales with actual usage, not potential usage

### Function Call Performance Comparison

```text
📊 Function Call Analysis (Aggregated - January 13, 2026)
===============================================
Eager Calls:       1.23μs (avg) | 0.70μs (min) | 49.80μs (max)
Lazy Subsequent:   1.14μs (avg) | 0.70μs (min) | 29.20μs (max)
Lazy First Call:   650-970μs (materialization overhead, varies by module)

Winner: Equal (within 8% measurement noise)
```

**Why Performance is Now Equal:**

- ✅ **Fixed \_\_slothletPath assignment** - Eager mode now pre-assigns paths during loading
- ✅ **No runtime property definition** - Eliminated Object.defineProperty overhead in wrapper
- ✅ **Identical code paths** - Post-materialization, both modes execute the same functions
- ✅ **8% difference is measurement noise** - Sub-microsecond timing inherently variable

### Realistic API Usage Performance

```text
📊 Realistic Usage (500 iterations, 41 unique API calls)
=========================================================
Eager Mode:  1.23μs (avg) | 0.60μs (min) | 16.80μs (max)
Lazy Mode:   1.14μs (avg) | 0.50μs (min) | 16.80μs (max)

Winner: Equal (within 8% measurement noise)
```

**Performance Parity Achieved:**

- ✅ Tests diverse API usage patterns from actual test suite
- ✅ 41 unique function calls across all modules
- ✅ Both modes perform identically in real-world scenarios
- ✅ Differences within statistical noise at sub-microsecond scale

### Materialization Analysis

```text
📊 Lazy Mode Materialization Breakdown
====================================================
Module Type                    | First Call | Subsequent | Benefit
-------------------------------|------------|------------|--------
math/math.mjs (nested)         | ~650μs     | 1.1μs      | 590x
string/string.mjs (flattened)  | ~750μs     | 1.0μs      | 750x
funcmod/funcmod.mjs (callable) | ~970μs     | 0.9μs      | 1078x

Average materialization cost: ~790μs per module (one-time)
```

**Materialization Insights:**

- ✅ One-time cost per module (not per function call)
- ✅ Deeper nesting = higher initial cost, same final performance
- ✅ Complex modules show bigger relative improvements
- ✅ Post-materialization performance equals eager mode

---

## 🎯 Performance Recommendations

### Choose **Lazy Mode** When:

🎯 **Fast startup is critical** (3.5x faster)

- Serverless functions with cold starts
- CLI tools that need instant responsiveness
- Development environments with frequent restarts

🎯 **Memory efficiency matters**

- Large APIs with many unused endpoints
- Resource-constrained environments
- Microservices using subset functionality

🎯 **Usage patterns are sparse**

### Choose **Lazy Mode** When:

🎯 **Fast startup is critical** (3.5x faster)

- Serverless functions with cold starts
- CLI tools that need instant responsiveness
- Development environments with frequent restarts

🎯 **Partial API usage expected**

- Only 20-50% of API surface area used
- Conditional feature loading
- Plugin-based architectures

🎯 **Memory efficiency matters**

- Resource-constrained environments
- Multi-tenant applications
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

**Note:** Function call performance is now equal between modes (within 8% measurement noise).

---

## ⚖️ Trade-off Analysis

### Performance Characteristics

| Aspect              | Lazy Mode       | Eager Mode      |
| ------------------- | --------------- | --------------- |
| **Startup**         | 7.92ms ⚡       | 27.92ms 🐌      |
| **Function Calls**  | 1.14μs ≈        | 1.23μs ≈        |
| **Realistic Usage** | 1.14μs ≈        | 1.23μs ≈        |
| **First Access**    | ~790μs overhead | Instant         |
| **Memory**          | On-demand ⚡    | Full upfront 🐌 |
| **Predictability**  | Variable 🐌     | Consistent ⚡   |

**Legend:** ⚡ Winner | 🐌 Slower | ≈ Equal (within measurement noise)

### Real-World Scenarios

**Lazy Mode Wins:**

```javascript
// Scenario: CLI tool using 2 out of 20 modules
Startup: 7.92ms vs 27.92ms = 3.5x faster ⚡
Memory: ~10% usage vs 100% = 90% savings ⚡
Total time: 7.92ms + (2 × 0.79ms) = 9.5ms vs 27.92ms
Function calls: 1.14μs vs 1.23μs = Equal (within 8%)
```

**Eager Mode Wins (Predictability):**

```javascript
// Scenario: Production API where consistent latency is critical
Startup: 27.92ms (one-time cost, amortized over lifetime)
Function calls: 1.23μs = Equal to lazy (within 8%)
First access: Instant (no materialization delay) ⚡
Predictability: No timing surprises ⚡
```

**Both Modes Equal:**

```javascript
// Function call performance after lazy materialization
Lazy:  1.14μs per call
Eager: 1.23μs per call
Difference: 8% (within measurement noise at sub-microsecond scale)
Conclusion: Performance parity achieved ✅
```

---

## 🔧 Benchmark Methodology

### Test Environment

- **Node.js**: v22+ (development conditions)
- **Platform**: Windows 11
- **CPU**: 13th Gen Intel® Core™ i9-13900KS, 3200 MHz, 24 Cores / 32 Logical Processors
- **RAM**: 128 GB DDR5-5600
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
   Eager: 27.92ms (avg) | Range: 26.06ms - 36.06ms
   Lazy:  7.92ms (avg) | Range: 6.87ms - 36.19ms
   Winner: Lazy mode (3.5x faster)

⚡ FUNCTION CALL PERFORMANCE:
   Eager:             1.23μs (avg)
   Lazy (first):      790μs (materialization)
   Lazy (subsequent): 1.14μs (avg)
   Winner: Equal (within 8% measurement noise)

🎯 COMPLEX MODULE PERFORMANCE:
   Eager:             1.30μs (avg)
   Lazy (first):      850μs (materialization)
   Lazy (subsequent): 1.25μs (avg)
   Winner: Equal (within 4% measurement noise)

🔄 MULTI-MODULE ACCESS PATTERNS:

   Nested Math Module (math/math.mjs):
     Eager:             1.30μs
     Lazy (subsequent): 1.29μs
     Winner: Equal (within measurement noise)

   String Module (string/string.mjs):
     Eager:             1.17μs
     Lazy (subsequent): 1.02μs
     Winner: Equal (within measurement noise)

   Callable Function Module (funcmod/funcmod.mjs):
     Eager:             1.05μs
     Lazy (subsequent): 0.88μs
     Winner: Equal (within measurement noise)
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
Benchmark Results (Aggregated - January 13, 2026)
==================================================
• Eager startup:       27.92ms
• Lazy startup:        7.92ms
• Eager calls:         1.23μs
• Lazy calls:          1.14μs
• Materialization:     790μs (average per module)

Performance Ratios:
• Startup ratio:       3.5x faster (lazy)
• Call ratio:          Equal (within 8% measurement noise)
• Materialization:     ~693x improvement (790μs → 1.14μs)
```

### Individual Module Performance

```text
🔍 PER-MODULE MATERIALIZATION BREAKDOWN
=======================================

math/math.mjs (nested structure):
  First Call:    ~650μs (materialization)
  Subsequent:    1.20μs (materialized)
  Benefit:       540x faster after materialization

string/string.mjs (flattened):
  First Call:    ~750μs (materialization)
  Subsequent:    1.10μs (materialized)
  Benefit:       680x faster after materialization

funcmod/funcmod.mjs (callable):
  First Call:    ~970μs (materialization)
  Subsequent:    1.00μs (materialized)
  Benefit:       970x faster after materialization
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

**📊 Performance analysis updated: January 13, 2026**  
**🔬 Based on slothlet v2.12.0 with \_\_slothletPath performance fix**  
**📈 All metrics from `tests/performance/performance-benchmark-aggregated.mjs`**
