/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/performance/performance-benchmark.mjs
 *	@Date: 2026-01-10T17:42:21-08:00 (1768095741)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-08 19:29:18 -07:00 (1773023358)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * Performance Benchmark Test for Slothlet
 *
 * This test compares performance metrics between eager and lazy loading modes:
 * - Startup time (API initialization)
 * - First access time (lazy materialization vs eager baseline)
 * - Subsequent access times (materialized vs eager baseline)
 *
 * Run with: node tests/performance-benchmark.mjs
 */

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { performance } from "perf_hooks";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const API_DIR = join(__dirname, "../../api_tests/api_test");

const START_UP_TEST_COUNT = 10; // Number of iterations for startup time test
const BENCHMARK_ITERATIONS = 100; // Number of iterations for benchmark tests
const BENCHMARK_ITERATIONS_COMPLEX = 100; // Number of iterations for complex benchmark tests
const BENCHMARK_ITERATIONS_MULTI = 50; // Number of iterations for multi benchmark tests

// Must NOT be a static top-level import — triggers devcheckPromise before respawn can act.
let slothlet;

/**
 * Measures execution time of an async function
 * @param {Function} fn - Async function to measure
 * @returns {Promise<{result: any, time: number}>}
 */
async function measureTime(fn) {
	const start = performance.now();
	const result = await fn();
	const end = performance.now();
	return { result, time: end - start };
}

/**
 * Runs a function multiple times and returns statistics
 * @param {Function} fn - Function to run
 * @param {number} iterations - Number of iterations
 * @returns {Promise<{min: number, max: number, avg: number, median: number}>}
 */
async function benchmarkFunction(fn, iterations = 10) {
	const times = [];

	for (let i = 0; i < iterations; i++) {
		const { time } = await measureTime(fn);
		times.push(time);
	}

	times.sort((a, b) => a - b);

	return {
		min: Math.min(...times),
		max: Math.max(...times),
		avg: times.reduce((a, b) => a + b, 0) / times.length,
		median: times[Math.floor(times.length / 2)]
	};
}

/**
 * Formats time in appropriate units
 * @param {number} ms - Time in milliseconds
 * @returns {string}
 */
function formatTime(ms) {
	if (ms < 1) {
		return `${(ms * 1000).toFixed(2)}μs`;
	} else if (ms < 1000) {
		return `${ms.toFixed(2)}ms`;
	} else {
		return `${(ms / 1000).toFixed(2)}s`;
	}
}

/**
 * Calculates performance improvement ratio
 * @param {number} baseline - Baseline time
 * @param {number} comparison - Comparison time
 * @returns {string}
 */
function calculateImprovement(baseline, comparison) {
	const ratio = baseline / comparison;
	if (ratio > 1) {
		return `${ratio.toFixed(1)}x faster`;
	} else {
		return `${(1 / ratio).toFixed(1)}x slower`;
	}
}

/**
 * Normalizes condition lookups for NODE_OPTIONS and execArgv.
 * @param {string[]} args - Arguments to inspect.
 * @param {string} condition - Condition name to look for.
 * @returns {boolean}
 * @example
 * hasCondition(["--conditions=slothlet-dev"], "slothlet-dev");
 */
function hasCondition(args, condition) {
	return args.some((arg) => {
		if (!arg.startsWith("--conditions=")) {
			return false;
		}
		const conditions = arg.slice("--conditions=".length).split(/[|,]/u);
		return conditions.includes(condition);
	});
}

/**
 * Ensures dev-only export conditions are enabled for this run.
 * @returns {boolean} True if a child process was spawned.
 * @description
 * Re-executes the script with required NODE_OPTIONS conditions.
 * @example
 * if (ensureDevEnvFlags()) return;
 */
function ensureDevEnvFlags() {
	const distPath = join(__dirname, "../../dist");
	if (existsSync(distPath)) {
		return false;
	}

	process.env.NODE_ENV = "development";

	const slothletCondition = "slothlet-dev";
	const requiredConditions = [slothletCondition];
	const nextExecArgv = [...process.execArgv];
	const envConditions = (process.env.NODE_OPTIONS ?? "")
		.split(/\s+/u)
		.filter(Boolean)
		.filter((token) => token !== "--conditions=development|production");

	let needsRespawn = process.env.NODE_ENV !== "development";

	for (const condition of requiredConditions) {
		const flag = `--conditions=${condition}`;
		const inExecArgv = hasCondition(nextExecArgv, condition);
		const inNodeOptions = envConditions.some((token) => token === flag);
		if (!inExecArgv && !inNodeOptions) {
			nextExecArgv.push(flag);
			needsRespawn = true;
		}
		if (!envConditions.includes(flag)) {
			envConditions.push(flag);
		}
	}

	process.env.NODE_OPTIONS = envConditions.join(" ");

	if (!needsRespawn) {
		return false;
	}

	const child = spawn(process.argv[0], [...nextExecArgv, ...process.argv.slice(1)], {
		env: { ...process.env, NODE_ENV: "development", NODE_OPTIONS: process.env.NODE_OPTIONS },
		stdio: "inherit"
	});

	child.on("exit", (code, signal) => {
		if (signal) {
			process.kill(process.pid, signal);
			return;
		}
		process.exit(code ?? 0);
	});

	return true;
}

/**
 * Main benchmark entry point.
 * @returns {Promise<void>}
 */
async function main() {
	if (ensureDevEnvFlags()) {
		return;
	}

	const mod = await import("@cldmv/slothlet");
	slothlet = mod?.default ?? mod?.slothlet ?? mod;

	if (typeof slothlet !== "function") {
		throw new Error("slothlet entrypoint did not export a callable function");
	}

	console.log("🚀 Slothlet Performance Benchmark\n");
	console.log(`Testing with API directory: ${API_DIR}\n`);

	// Force unique instances by using different parameters
	let instanceCounter = 0;

	// Debug: Show which modules are root vs nested
	console.log("🔍 DEBUG: Module Structure Analysis");
	console.log("====================================");
	console.log("• Root modules (loaded immediately in lazy mode):");
	console.log("  - root-function.mjs → rootFunction");
	console.log("  - root-math.mjs → rootMath");
	console.log("  - rootstring.mjs → rootstring");
	console.log("  - config.mjs → config");
	console.log("• Nested modules (materialized on-demand in lazy mode):");
	console.log("  - math/math.mjs → math");
	console.log("  - string/string.mjs → string");
	console.log("  - funcmod/funcmod.mjs → funcmod");
	console.log("  - nested/date/date.mjs → nested.date");
	console.log("  - util/* → util.*");
	console.log("• Testing ONLY nested modules to measure true materialization!\n");

	// Test 1: Startup Time Comparison
	console.log("📊 Test 1: Startup Time Comparison");
	console.log("=====================================");

	// Test eager startup multiple times with unique instances
	const eagerStartupTimes = [];
	for (let i = 0; i < START_UP_TEST_COUNT; i++) {
		const { time } = await measureTime(async () => {
			return await slothlet({ dir: API_DIR, lazy: false, context: { instance: `eager-${++instanceCounter}` } });
		});
		eagerStartupTimes.push(time);
	}

	// Test lazy startup multiple times with unique instances
	const lazyStartupTimes = [];
	for (let i = 0; i < START_UP_TEST_COUNT; i++) {
		const { time } = await measureTime(async () => {
			return await slothlet({ dir: API_DIR, lazy: true, context: { instance: `lazy-${++instanceCounter}` } });
		});
		lazyStartupTimes.push(time);
	}

	const eagerStartupAvg = eagerStartupTimes.reduce((a, b) => a + b, 0) / eagerStartupTimes.length;
	const lazyStartupAvg = lazyStartupTimes.reduce((a, b) => a + b, 0) / lazyStartupTimes.length;

	console.log(
		`Eager Mode Startup:  ${formatTime(eagerStartupAvg)} (avg) | ${formatTime(Math.min(...eagerStartupTimes))} (min) | ${formatTime(
			Math.max(...eagerStartupTimes)
		)} (max)`
	);
	console.log(
		`Lazy Mode Startup:   ${formatTime(lazyStartupAvg)} (avg) | ${formatTime(Math.min(...lazyStartupTimes))} (min) | ${formatTime(
			Math.max(...lazyStartupTimes)
		)} (max)`
	);
	console.log(
		`Startup Winner:      ${lazyStartupAvg < eagerStartupAvg ? "Lazy" : "Eager"} mode (${calculateImprovement(
			Math.max(eagerStartupAvg, lazyStartupAvg),
			Math.min(eagerStartupAvg, lazyStartupAvg)
		)})\n`
	);

	// Test 2: Function Call Performance (Controlled Comparison)
	console.log("📊 Test 2: Function Call Performance (Controlled Comparison) (" + BENCHMARK_ITERATIONS + " iterations)");
	console.log("===========================================================");

	// Create fresh eager API for baseline
	const eagerApiForCalls = await slothlet({ dir: API_DIR, lazy: false, context: { instance: `calls-eager-${++instanceCounter}` } });

	// Create fresh lazy API to ensure NO modules are materialized yet
	const lazyApiForCalls = await slothlet({ dir: API_DIR, lazy: true, context: { instance: `calls-lazy-${++instanceCounter}` } });

	// FIRST: Measure lazy first call (materialization)
	console.log("Measuring lazy first call (materialization)...");
	const lazyFirstCall = await measureTime(async () => {
		return lazyApiForCalls.math.add(2, 3); // First access to math module
	});
	console.log(`Lazy First Call: ${formatTime(lazyFirstCall.time)} (materialization)`);

	// SECOND: Now both APIs should have the same underlying functions
	// Let's test the EXACT same function call pattern
	console.log("Measuring eager calls (baseline)...");
	const eagerCalls = await benchmarkFunction(async () => {
		return eagerApiForCalls.math.add(2, 3); // Same call as lazy
	}, BENCHMARK_ITERATIONS);

	console.log("Measuring lazy subsequent calls (post-materialization)...");
	const lazySubsequentCalls = await benchmarkFunction(async () => {
		return lazyApiForCalls.math.add(2, 3); // EXACT same call as eager and first lazy
	}, BENCHMARK_ITERATIONS);

	// THIRD: Let's also test if the results are the same
	const eagerResult = eagerApiForCalls.math.add(2, 3);
	const lazyResult = lazyApiForCalls.math.add(2, 3);
	console.log(`Result verification - Eager: ${eagerResult}, Lazy: ${lazyResult}, Same: ${eagerResult === lazyResult}`);

	console.log(
		`Eager Mode Calls:         ${formatTime(eagerCalls.avg)} (avg) | ${formatTime(eagerCalls.min)} (min) | ${formatTime(
			eagerCalls.max
		)} (max)`
	);
	console.log(
		`Lazy Subsequent Calls:    ${formatTime(lazySubsequentCalls.avg)} (avg) | ${formatTime(lazySubsequentCalls.min)} (min) | ${formatTime(
			lazySubsequentCalls.max
		)} (max)`
	);

	// Debugging: Let's inspect the actual function references
	console.log("\n🔍 DEBUGGING: Function Reference Analysis");
	console.log("==========================================");
	console.log(`Eager math.add function: ${typeof eagerApiForCalls.math.add} | ${eagerApiForCalls.math.add.name || "anonymous"}`);
	console.log(`Lazy math.add function:  ${typeof lazyApiForCalls.math.add} | ${lazyApiForCalls.math.add.name || "anonymous"}`);
	console.log(`Functions are identical: ${eagerApiForCalls.math.add === lazyApiForCalls.math.add}`);
	console.log(`Eager math object: ${eagerApiForCalls.math.constructor.name}`);
	console.log(`Lazy math object:  ${lazyApiForCalls.math.constructor.name}`);

	// Performance analysis
	console.log(`\n📊 Performance Comparison:`);
	console.log(`First Call vs Eager:      ${calculateImprovement(eagerCalls.avg, lazyFirstCall.time)}`);
	console.log(`Subsequent vs Eager:      ${calculateImprovement(eagerCalls.avg, lazySubsequentCalls.avg)}`);
	console.log(`Subsequent vs First:      ${calculateImprovement(lazyFirstCall.time, lazySubsequentCalls.avg)}`);

	// This should be close to 1.0x if they're truly the same after materialization
	const postMaterializationRatio = eagerCalls.avg / lazySubsequentCalls.avg;
	console.log(`Post-materialization ratio: ${postMaterializationRatio.toFixed(2)}x (should be ~1.0x if identical)`);

	if (Math.abs(postMaterializationRatio - 1.0) > 0.5) {
		console.log("⚠️  WARNING: Post-materialization performance differs significantly from eager mode!");
		console.log("   This suggests either:");
		console.log("   - The functions are not actually identical after materialization");
		console.log("   - There's measurement error or system noise");
		console.log("   - Different optimization paths in V8");
	}

	// Test 3: Complex Module Access (Fresh Instance)
	console.log("📊 Test 3: Complex Module Access (Fresh Instance) (" + BENCHMARK_ITERATIONS_COMPLEX + " iterations)");
	console.log("=================================================");

	// Create fresh eager API for nested calls
	const eagerApiForNested = await slothlet({ dir: API_DIR, lazy: false, context: { instance: `nested-eager-${++instanceCounter}` } });

	// Test nested module access
	const eagerNested = await benchmarkFunction(async () => {
		return eagerApiForNested.nested.date.today(); // nested/date/date.mjs
	}, BENCHMARK_ITERATIONS_COMPLEX);

	// Create completely fresh lazy API for nested test (no previous materializations)
	const lazyApiForNested = await slothlet({ dir: API_DIR, lazy: true, context: { instance: `nested-lazy-${++instanceCounter}` } });

	const lazyNestedFirst = await measureTime(async () => {
		return lazyApiForNested.nested.date.today(); // First access to nested.date module
	});

	const lazyNestedSubsequent = await benchmarkFunction(async () => {
		return lazyApiForNested.nested.date.today(); // Should be materialized now
	}, BENCHMARK_ITERATIONS_COMPLEX);

	console.log(`Eager Nested Calls:       ${formatTime(eagerNested.avg)} (avg)`);
	console.log(`Lazy Nested First:        ${formatTime(lazyNestedFirst.time)} (materialization)`);
	console.log(`Lazy Nested Subsequent:   ${formatTime(lazyNestedSubsequent.avg)} (avg)`);
	console.log(`Nested Subsequent vs Eager: ${calculateImprovement(eagerNested.avg, lazyNestedSubsequent.avg)}`);
	console.log(`Nested Subsequent vs First: ${calculateImprovement(lazyNestedFirst.time, lazyNestedSubsequent.avg)}\n`);

	// Test 4: Multiple Module Access Patterns (Fresh APIs per test)
	console.log("📊 Test 4: Multiple Module Access Patterns (Fresh APIs per test) (" + BENCHMARK_ITERATIONS_MULTI + " iterations per test)");
	console.log("=================================================================");

	// Test different module types with completely fresh instances each time
	const moduleTests = [
		{
			name: "Nested Math Module (math/math.mjs)",
			eagerContext: `math-eager-${++instanceCounter}`,
			lazyContext: `math-lazy-${++instanceCounter}`,
			call: (api) => api.math.multiply(4, 5) // Different function to avoid caching
		},
		{
			name: "String Module (string/string.mjs)",
			eagerContext: `string-eager-${++instanceCounter}`,
			lazyContext: `string-lazy-${++instanceCounter}`,
			call: (api) => api.string.upper("test")
		},
		{
			name: "Callable Function Module (funcmod/funcmod.mjs)",
			eagerContext: `funcmod-eager-${++instanceCounter}`,
			lazyContext: `funcmod-lazy-${++instanceCounter}`,
			call: (api) => api.funcmod("hello")
		}
	];

	for (const test of moduleTests) {
		console.log(`\n${test.name}:`);

		// Create fresh eager API
		const freshEagerApi = await slothlet({ dir: API_DIR, lazy: false, context: { instance: test.eagerContext } });
		const eagerResult = await benchmarkFunction(() => test.call(freshEagerApi), BENCHMARK_ITERATIONS_MULTI);

		// Create fresh lazy API (no modules materialized)
		const freshLazyApi = await slothlet({ dir: API_DIR, lazy: true, context: { instance: test.lazyContext } });

		// First lazy call (should trigger materialization)
		const lazyFirstResult = await measureTime(() => test.call(freshLazyApi));

		// Subsequent lazy calls (should use materialized function)
		const lazySubsequentResult = await benchmarkFunction(() => test.call(freshLazyApi), BENCHMARK_ITERATIONS_MULTI);

		console.log(`  Eager:      ${formatTime(eagerResult.avg)} (avg)`);
		console.log(`  Lazy First: ${formatTime(lazyFirstResult.time)} (materialization)`);
		console.log(`  Lazy Sub:   ${formatTime(lazySubsequentResult.avg)} (avg, materialized)`);
		console.log(`  First vs Eager: ${calculateImprovement(eagerResult.avg, lazyFirstResult.time)}`);
		console.log(`  Sub vs Eager:   ${calculateImprovement(eagerResult.avg, lazySubsequentResult.avg)}`);
		console.log(`  Materialization Benefit: ${calculateImprovement(lazyFirstResult.time, lazySubsequentResult.avg)}`);
	}

	// Note: Skipping cleanup to avoid shutdown issues in testing

	console.log("\n🎯 PERFORMANCE ANALYSIS & RECOMMENDATIONS");
	console.log("==========================================");

	// Determine overall winners and recommendations
	const startupWinner = lazyStartupAvg < eagerStartupAvg ? "Lazy" : "Eager";
	const callWinner = eagerCalls.avg < lazySubsequentCalls.avg ? "Eager" : "Lazy";

	console.log("📊 BENCHMARK RESULTS SUMMARY:");
	console.log(`• Startup Performance:     ${startupWinner} mode wins`);
	console.log(`• Function Call Performance: ${callWinner} mode wins`);
	console.log(`• Materialization Overhead: ${formatTime(lazyFirstCall.time)} (one-time cost per module)`);

	console.log("\n🔍 DETAILED ANALYSIS:");

	if (lazyStartupAvg < eagerStartupAvg) {
		console.log(`✅ Lazy startup is ${calculateImprovement(eagerStartupAvg, lazyStartupAvg)} because:`);
		console.log("   - No upfront module loading and compilation");
		console.log("   - Deferred file system operations");
		console.log("   - Minimal initial memory allocation");
	} else {
		console.log(`❌ Eager startup is ${calculateImprovement(lazyStartupAvg, eagerStartupAvg)} because:`);
		console.log("   - Parallel module loading optimization");
		console.log("   - Cached compilation results");
	}

	console.log();

	if (eagerCalls.avg < lazySubsequentCalls.avg) {
		console.log(`✅ Eager function calls are ${calculateImprovement(lazySubsequentCalls.avg, eagerCalls.avg)} because:`);
		console.log("   - Direct function references (no proxy overhead)");
		console.log("   - No materialization checks required");
		console.log("   - Optimized V8 compilation paths");
	} else {
		console.log(`❌ Lazy function calls are ${calculateImprovement(eagerCalls.avg, lazySubsequentCalls.avg)} because:`);
		console.log("   - Post-materialization optimization");
		console.log("   - Reduced memory pressure improves cache locality");
	}

	console.log("\n📋 USAGE RECOMMENDATIONS:");
	console.log();

	console.log("🚀 CHOOSE EAGER MODE WHEN:");
	console.log("   • You use most/all modules in your API");
	console.log("   • Function call performance is critical");
	console.log("   • Memory usage is not a constraint");
	console.log("   • Startup time is acceptable");
	console.log("   • You prefer predictable performance characteristics");

	console.log();

	console.log("🎯 CHOOSE LAZY MODE WHEN:");
	console.log("   • You only use a subset of available modules");
	console.log("   • Fast startup time is critical");
	console.log("   • Memory efficiency is important");
	console.log("   • You can tolerate one-time materialization overhead");
	console.log("   • You have a large API with many unused endpoints");

	console.log();

	console.log("⚖️  TRADE-OFF SUMMARY:");
	console.log(`   • Startup:     Lazy wins (${formatTime(lazyStartupAvg)} vs ${formatTime(eagerStartupAvg)})`);
	console.log(
		`   • Calls:       ${callWinner} wins (${formatTime(Math.min(eagerCalls.avg, lazySubsequentCalls.avg))} vs ${formatTime(
			Math.max(eagerCalls.avg, lazySubsequentCalls.avg)
		)})`
	);
	console.log(`   • Memory:      Lazy wins (only loads used modules)`);
	console.log(`   • Consistency: Eager wins (no materialization surprises)`);

	console.log("\n💡 PERFORMANCE NOTES:");
	console.log("   • These benchmarks represent micro-optimizations");
	console.log("   • Real-world performance depends on your specific usage patterns");
	console.log("   • Consider profiling your actual application workload");
	console.log("   • The difference may be negligible for most applications");

	console.log(`\n📏 Raw Numbers (for documentation):`);
	console.log(`   • Eager startup: ${formatTime(eagerStartupAvg)}`);
	console.log(`   • Lazy startup:  ${formatTime(lazyStartupAvg)}`);
	console.log(`   • Eager calls:   ${formatTime(eagerCalls.avg)}`);
	console.log(`   • Lazy calls:    ${formatTime(lazySubsequentCalls.avg)}`);
	console.log(`   • Materialization: ${formatTime(lazyFirstCall.time)}`);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
