/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/performance/performance-benchmark-aggregated.mjs
 *	@Date: 2026-01-10T17:42:21-08:00 (1768095741)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-01 20:21:39 -08:00 (1772425299)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * Aggregated Performance Benchmark Test for Slothlet
 *
 * This test compares performance metrics between eager and lazy loading modes
 * with configurable test order to eliminate bias from execution order effects:
 * - Startup time (API initialization)
 * - First access time (lazy materialization vs eager baseline)
 * - Subsequent access times (materialized vs eager baseline)
 *
 * Run with: node tests/performance-benchmark-aggregated.mjs
 */

import { spawn } from "node:child_process";
import { performance } from "perf_hooks";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { existsSync } from "node:fs";
import { readFile } from "fs/promises";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
let API_DIR = join(__dirname, "../../api_tests/api_test");
let API_CONFIG_PATH = join(__dirname, "../vitests/setup/api-test-config.jsonc");

const START_UP_TEST_COUNT = 50; // Number of iterations for startup time test
const BENCHMARK_ITERATIONS = 200; // Number of iterations for benchmark tests
const BENCHMARK_ITERATIONS_COMPLEX = 200; // Number of iterations for complex benchmark tests
const BENCHMARK_ITERATIONS_MULTI = 100; // Number of iterations for multi benchmark tests
const BENCHMARK_ITERATIONS_REALISTIC = 500; // Number of iterations for realistic API usage test (HIGH WEIGHT)

let slothlet;

/**
 * Calls the math add function with fallbacks for root modules.
 * @param {object} api - Slothlet API instance.
 * @param {number} a - First addend.
 * @param {number} b - Second addend.
 * @returns {Promise<number>} Addition result.
 * @async
 * @private
 * @description
 * Falls back to root math when nested math is unavailable.
 * @example
 * await callMathAdd(api, 2, 3);
 */
async function callMathAdd(api, a, b) {
	let mathFn = api?.math?.add;
	if (typeof mathFn === "function") {
		try {
			return await mathFn(a, b);
		} catch (____error) {
			// Retry after materialization when lazy proxy throws.
		}
	}
	const mathMaterialize = api?.math?._materialize;
	if (typeof mathMaterialize === "function") {
		await mathMaterialize();
	}
	mathFn = api?.math?.add;
	if (typeof mathFn === "function") {
		try {
			return await mathFn(a, b);
		} catch (____error) {
			// Fallback to rootMath when math.add still fails.
		}
	}
	let rootFn = api?.rootMath?.add;
	if (typeof rootFn !== "function") {
		const rootMaterialize = api?.rootMath?._materialize;
		if (typeof rootMaterialize === "function") {
			await rootMaterialize();
		}
		rootFn = api?.rootMath?.add;
	}
	if (typeof rootFn !== "function") {
		try {
			return await executeApiCall(api, { path: ["rootMath", "add"], args: [a, b] });
		} catch (____error) {
			throw new Error("math.add is not a function");
		}
	}
	return await rootFn(a, b);
}

/**
 * Calls the nested date module today function.
 * @param {object} api - Slothlet API instance.
 * @returns {Promise<string>} Date string.
 * @async
 * @private
 * @description
 * Uses nested date module for complex access benchmarking.
 * @example
 * await callNestedDateToday(api);
 */
async function callNestedDateToday(api) {
	let fn = api?.nested?.date?.today;
	if (typeof fn === "function") {
		try {
			return await fn();
		} catch (____error) {
			// Retry after materialization when lazy proxy throws.
		}
	}
	const nestedMaterialize = api?.nested?._materialize;
	if (typeof nestedMaterialize === "function") {
		await nestedMaterialize();
	}
	const dateMaterialize = api?.nested?.date?._materialize;
	if (typeof dateMaterialize === "function") {
		await dateMaterialize();
	}
	fn = api?.nested?.date?.today;
	if (typeof fn !== "function") {
		throw new Error("nested.date.today is not a function");
	}
	return await fn();
}

/**
 * Calls the string upper function with root fallback.
 * @param {object} api - Slothlet API instance.
 * @param {string} value - Input string.
 * @returns {Promise<string>} Upper-cased string.
 * @async
 * @private
 * @description
 * Falls back to root string module when needed.
 * @example
 * await callStringUpper(api, "test");
 */
async function callStringUpper(api, value) {
	let fn = api?.string?.upper ?? api?.rootstring?.upper;
	if (typeof fn === "function") {
		try {
			return await fn(value);
		} catch (____error) {
			// Retry after materialization when lazy proxy throws.
		}
	}
	const stringMaterialize = api?.string?._materialize;
	if (typeof stringMaterialize === "function") {
		await stringMaterialize();
	}
	fn = api?.string?.upper ?? api?.rootstring?.upper;
	if (typeof fn !== "function") {
		throw new Error("string.upper is not a function");
	}
	return await fn(value);
}

/**
 * Calls the funcmod module.
 * @param {object} api - Slothlet API instance.
 * @param {number} a - First argument.
 * @param {number} b - Second argument.
 * @returns {Promise<unknown>} Result of funcmod.
 * @async
 * @private
 * @description
 * Invokes the callable funcmod module for mixed-module tests.
 * @example
 * await callFuncmod(api, 5, 6);
 */
async function callFuncmod(api, a, b) {
	let fn = api?.funcmod;
	if (typeof fn === "function") {
		try {
			return await fn(a, b);
		} catch (____error) {
			// Retry after materialization when lazy proxy throws.
		}
	}
	const funcmodMaterialize = api?.funcmod?._materialize;
	if (typeof funcmodMaterialize === "function") {
		await funcmodMaterialize();
	}
	fn = api?.funcmod;
	if (typeof fn !== "function") {
		throw new Error("funcmod is not a function");
	}
	return await fn(a, b);
}

/**
 * Checks if a condition flag exists in a list of args.
 * @param {string[]} args - Node args to inspect.
 * @param {string} condition - Condition value to match.
 * @returns {boolean} True when condition is present.
 * @private
 * @description
 * Normalizes condition lookups for NODE_OPTIONS and execArgv.
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
 * @private
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
 * Resolves API test paths based on active slothlet conditions.
 * @returns {{apiDir: string, apiConfigPath: string}} Resolved paths.
 * @private
 * @description
 * Switches API fixtures and config between v2 and v3.
 * @example
 * const { apiDir, apiConfigPath } = resolveApiPaths();
 */
function resolveApiPaths() {
	return {
		apiDir: join(__dirname, "../../api_tests/api_test"),
		apiConfigPath: join(__dirname, "../vitests/setup/api-test-config.jsonc")
	};
}

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
 * Displays order effect analysis
 * @param {object} eagerFirstResults - Results when eager ran first
 * @param {object} lazyFirstResults - Results when lazy ran first
 */
function displayOrderEffectAnalysis(eagerFirstResults, lazyFirstResults) {
	console.log("\n📈 ORDER EFFECT ANALYSIS:");
	console.log("What this measures: How much performance changes based on which mode runs first");
	console.log("Why it matters: Large variance indicates JIT compiler warmup effects or caching interference");

	// Startup order effects
	const eagerStartupWhenFirst = eagerFirstResults.startup.eager.avg;
	const eagerStartupWhenSecond = lazyFirstResults.startup.eager.avg;
	const eagerStartupDiff = Math.abs(eagerStartupWhenFirst - eagerStartupWhenSecond);
	const eagerStartupVariance = (eagerStartupDiff / Math.min(eagerStartupWhenFirst, eagerStartupWhenSecond)) * 100;

	const lazyStartupWhenFirst = lazyFirstResults.startup.lazy.avg;
	const lazyStartupWhenSecond = eagerFirstResults.startup.lazy.avg;
	const lazyStartupDiff = Math.abs(lazyStartupWhenFirst - lazyStartupWhenSecond);
	const lazyStartupVariance = (lazyStartupDiff / Math.min(lazyStartupWhenFirst, lazyStartupWhenSecond)) * 100;

	console.log("\n🚀 STARTUP TIME CONSISTENCY:");
	console.log(`   Eager Mode Performance:`);
	console.log(`     • When ran first:  ${formatTime(eagerStartupWhenFirst)}`);
	console.log(`     • When ran second: ${formatTime(eagerStartupWhenSecond)}`);
	console.log(`     • Difference:      ${formatTime(eagerStartupDiff)} (${eagerStartupVariance.toFixed(1)}% variance)`);
	console.log(`     ${eagerStartupVariance < 20 ? "✅ STABLE" : eagerStartupVariance < 50 ? "⚠️  MODERATE VARIANCE" : "❌ HIGH VARIANCE"}`);

	console.log(`   Lazy Mode Performance:`);
	console.log(`     • When ran first:  ${formatTime(lazyStartupWhenFirst)}`);
	console.log(`     • When ran second: ${formatTime(lazyStartupWhenSecond)}`);
	console.log(`     • Difference:      ${formatTime(lazyStartupDiff)} (${lazyStartupVariance.toFixed(1)}% variance)`);
	console.log(`     ${lazyStartupVariance < 20 ? "✅ STABLE" : lazyStartupVariance < 50 ? "⚠️  MODERATE VARIANCE" : "❌ HIGH VARIANCE"}`);

	// Function call order effects
	const eagerCallWhenFirst = eagerFirstResults.functionCalls.eager.avg;
	const eagerCallWhenSecond = lazyFirstResults.functionCalls.eager.avg;
	const eagerCallDiff = Math.abs(eagerCallWhenFirst - eagerCallWhenSecond);
	const eagerCallVariance = (eagerCallDiff / Math.min(eagerCallWhenFirst, eagerCallWhenSecond)) * 100;

	const lazyCallWhenFirst = lazyFirstResults.functionCalls.lazySubsequent.avg;
	const lazyCallWhenSecond = eagerFirstResults.functionCalls.lazySubsequent.avg;
	const lazyCallDiff = Math.abs(lazyCallWhenFirst - lazyCallWhenSecond);
	const lazyCallVariance = (lazyCallDiff / Math.min(lazyCallWhenFirst, lazyCallWhenSecond)) * 100;

	console.log("\n⚡ FUNCTION CALL CONSISTENCY:");
	console.log(`   Eager Mode Performance:`);
	console.log(`     • When ran first:  ${formatTime(eagerCallWhenFirst)}`);
	console.log(`     • When ran second: ${formatTime(eagerCallWhenSecond)}`);
	console.log(`     • Difference:      ${formatTime(eagerCallDiff)} (${eagerCallVariance.toFixed(1)}% variance)`);
	console.log(`     ${eagerCallVariance < 20 ? "✅ STABLE" : eagerCallVariance < 50 ? "⚠️  MODERATE VARIANCE" : "❌ HIGH VARIANCE"}`);

	console.log(`   Lazy Mode Performance:`);
	console.log(`     • When ran first:  ${formatTime(lazyCallWhenFirst)}`);
	console.log(`     • When ran second: ${formatTime(lazyCallWhenSecond)}`);
	console.log(`     • Difference:      ${formatTime(lazyCallDiff)} (${lazyCallVariance.toFixed(1)}% variance)`);
	console.log(`     ${lazyCallVariance < 20 ? "✅ STABLE" : lazyCallVariance < 50 ? "⚠️  MODERATE VARIANCE" : "❌ HIGH VARIANCE"}`);

	// Analysis insights
	console.log("\n🔍 PERFORMANCE RELIABILITY INSIGHTS:");

	const worstStartupVariance = Math.max(eagerStartupVariance, lazyStartupVariance);
	const worstCallVariance = Math.max(eagerCallVariance, lazyCallVariance);

	if (worstStartupVariance > 100) {
		console.log("   ❌ HIGH STARTUP VARIANCE: Results may be unreliable due to JIT compiler warmup effects");
	} else if (worstStartupVariance > 50) {
		console.log("   ⚠️  MODERATE STARTUP VARIANCE: Some JIT compiler effects present, results mostly reliable");
	} else {
		console.log("   ✅ STABLE STARTUP PERFORMANCE: Consistent results across test orders");
	}

	if (worstCallVariance > 50) {
		console.log("   ❌ HIGH FUNCTION CALL VARIANCE: Results may be unreliable, possible caching interference");
	} else if (worstCallVariance > 20) {
		console.log("   ⚠️  MODERATE FUNCTION CALL VARIANCE: Some order effects present, results mostly reliable");
	} else {
		console.log("   ✅ STABLE FUNCTION CALL PERFORMANCE: Consistent results across test orders");
	}

	// Explain what the variance means
	const avgStartupVariance = (eagerStartupVariance + lazyStartupVariance) / 2;
	const avgCallVariance = (eagerCallVariance + lazyCallVariance) / 2;

	console.log("\n💡 WHAT THIS MEANS:");
	if (avgStartupVariance > avgCallVariance * 2) {
		console.log("   • Startup times are much more variable than function calls");
		console.log("   • This is normal - startup involves more complex operations (file loading, compilation)");
		console.log("   • Focus on function call consistency for production performance predictions");
	} else {
		console.log("   • Both startup and function call performance are similarly variable");
		console.log("   • This suggests consistent benchmark conditions");
	}

	if (worstStartupVariance > 50 || worstCallVariance > 50) {
		console.log("   • ⚠️  High variance detected - consider running more iterations for reliable averages");
	} else {
		console.log("   • ✅ Low variance indicates reliable benchmark results");
	}
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
		min: times[0],
		max: times[times.length - 1],
		avg: times.reduce((sum, time) => sum + time, 0) / times.length,
		median: times[Math.floor(times.length / 2)]
	};
}

// === ISOLATED TEST FUNCTIONS FOR EACH MODE ===

/**
 * Isolated eager mode startup test
 * @returns {Promise<{min: number, max: number, avg: number, median: number}>}
 */
async function benchmarkEagerStartup() {
	return await benchmarkFunction(async () => {
		const api = await slothlet({ dir: API_DIR, mode: "eager" });
		await api.shutdown();
	}, START_UP_TEST_COUNT);
}

/**
 * Isolated lazy mode startup test
 * @returns {Promise<{min: number, max: number, avg: number, median: number}>}
 */
async function benchmarkLazyStartup() {
	return await benchmarkFunction(async () => {
		const api = await slothlet({ dir: API_DIR, mode: "lazy" });
		await api.shutdown();
	}, START_UP_TEST_COUNT);
}

/**
 * Isolated eager mode function call test
 * @returns {Promise<{min: number, max: number, avg: number, median: number}>}
 */
async function benchmarkEagerFunctionCalls() {
	const api = await slothlet({ dir: API_DIR, mode: "eager" });
	const result = await benchmarkFunction(async () => {
		return callMathAdd(api, 2, 3);
	}, BENCHMARK_ITERATIONS);
	await api.shutdown();
	return result;
}

/**
 * Isolated lazy mode function call test (both first and subsequent)
 * @returns {Promise<{lazyFirst: {result: any, time: number}, lazySubsequent: {min: number, max: number, avg: number, median: number}}>}
 */
async function benchmarkLazyFunctionCalls() {
	const api = await slothlet({ dir: API_DIR, mode: "lazy" });

	// First call (materialization)
	const lazyFirstCall = await measureTime(async () => {
		return callMathAdd(api, 2, 3);
	});

	// Subsequent calls
	const lazySubsequentCalls = await benchmarkFunction(async () => {
		return callMathAdd(api, 2, 3);
	}, BENCHMARK_ITERATIONS);

	await api.shutdown();
	return {
		lazyFirst: lazyFirstCall,
		lazySubsequent: lazySubsequentCalls
	};
}

/**
 * Isolated eager mode complex module test
 * @returns {Promise<{min: number, max: number, avg: number, median: number}>}
 */
async function benchmarkEagerComplexModules() {
	const api = await slothlet({ dir: API_DIR, mode: "eager" });
	const result = await benchmarkFunction(async () => {
		return callNestedDateToday(api);
	}, BENCHMARK_ITERATIONS_COMPLEX);
	await api.shutdown();
	return result;
}

/**
 * Isolated lazy mode complex module test
 * @returns {Promise<{lazyFirst: {result: any, time: number}, lazySubsequent: {min: number, max: number, avg: number, median: number}}>}
 */
async function benchmarkLazyComplexModules() {
	const api = await slothlet({ dir: API_DIR, mode: "lazy" });

	const lazyComplexFirst = await measureTime(async () => {
		return callNestedDateToday(api);
	});

	const lazyComplexSubsequent = await benchmarkFunction(async () => {
		return callNestedDateToday(api);
	}, BENCHMARK_ITERATIONS_COMPLEX);

	await api.shutdown();
	return {
		lazyFirst: lazyComplexFirst,
		lazySubsequent: lazyComplexSubsequent
	};
}

/**
 * Isolated eager mode multi-module test
 * @param {string} module - Module name to test
 * @param {Function} testFn - Test function to run
 * @returns {Promise<{min: number, max: number, avg: number, median: number}>}
 */
async function benchmarkEagerMultiModule(module, testFn) {
	const api = await slothlet({ dir: API_DIR, mode: "eager" });
	const result = await benchmarkFunction(async () => {
		return testFn(api);
	}, BENCHMARK_ITERATIONS_MULTI);
	await api.shutdown();
	return result;
}

/**
 * Isolated lazy mode multi-module test
 * @param {string} module - Module name to test
 * @param {Function} testFn - Test function to run
 * @returns {Promise<{lazyFirst: {result: any, time: number}, lazySubsequent: {min: number, max: number, avg: number, median: number}}>}
 */
async function benchmarkLazyMultiModule(module, testFn) {
	const api = await slothlet({ dir: API_DIR, mode: "lazy" });

	const lazyFirst = await measureTime(async () => {
		return testFn(api);
	});

	const lazySubsequent = await benchmarkFunction(async () => {
		return testFn(api);
	}, BENCHMARK_ITERATIONS_MULTI);

	await api.shutdown();
	return {
		lazyFirst,
		lazySubsequent
	};
}

/**
 * Loads and parses the API test configuration
 * @returns {Promise<object>} Parsed API config
 */
async function loadApiConfig() {
	const content = await readFile(API_CONFIG_PATH, "utf-8");
	// Remove JSONC comments for parsing
	const jsonContent = content.replace(/\/\/.*/gu, "").replace(/\/\*[\s\S]*?\*\//gu, "");
	return JSON.parse(jsonContent);
}

/**
 * Executes a single API call based on config
 * @param {object} api - Slothlet API instance
 * @param {object} call - Call configuration { path, args }
 * @returns {Promise<any>} Result of API call
 */
async function executeApiCall(api, call) {
	let target = api;
	for (const segment of call.path) {
		target = target[segment];
	}
	// Handle both sync and async functions
	const result = typeof target === "function" ? target(...call.args) : target;
	return result instanceof Promise ? await result : result;
}

/**
 * Benchmarks realistic API usage patterns from config file
 * @param {boolean} lazy - Whether to use lazy mode
 * @returns {Promise<object>} Benchmark results
 */
async function benchmarkRealisticApiUsage(lazy) {
	const config = await loadApiConfig();
	const api = await slothlet({ dir: API_DIR, mode: lazy ? "lazy" : "eager" });

	// Collect all calls from all sections
	const allCalls = [];
	for (const section of config.testConfig.apiTests) {
		for (const call of section.calls) {
			allCalls.push(call);
		}
	}

	// First pass: materialize all modules (for lazy mode)
	for (const call of allCalls) {
		try {
			await executeApiCall(api, call);
		} catch {
			// Ignore errors during warmup
		}
	}

	// Now benchmark the actual calls
	const times = [];
	for (let i = 0; i < BENCHMARK_ITERATIONS_REALISTIC; i++) {
		// Pick a random call from the set to simulate realistic usage
		const call = allCalls[Math.floor(Math.random() * allCalls.length)];
		const start = performance.now();
		try {
			await executeApiCall(api, call);
		} catch {
			// Count errors but don't fail the benchmark
		}
		const end = performance.now();
		times.push(end - start);
	}

	await api.shutdown();

	// Calculate statistics
	times.sort((a, b) => a - b);
	const avg = times.reduce((sum, time) => sum + time, 0) / times.length;
	const min = times[0];
	const max = times[times.length - 1];
	const median = times[Math.floor(times.length / 2)];

	return { avg, min, max, median, iterations: BENCHMARK_ITERATIONS_REALISTIC, totalCalls: allCalls.length };
}

/**
 * Format time for display
 * @param {number} timeMs - Time in milliseconds
 * @returns {string} Formatted time string
 */
function formatTime(timeMs) {
	if (timeMs < 1) {
		return `${(timeMs * 1000).toFixed(2)}μs`;
	} else {
		return `${timeMs.toFixed(2)}ms`;
	}
}

/**
 * Analyze module structure for debugging
 * @param {string} _ - API directory path (unused in simplified implementation)
 * @returns {Promise<{rootModules: string[], nestedModules: string[]}>}
 */
async function analyzeModuleStructure(_) {
	// This is a simplified analysis - in real implementation you'd scan the directory
	return {
		rootModules: ["root-function.mjs", "root-math.mjs", "rootstring.mjs", "config.mjs"],
		nestedModules: ["math/math.mjs", "string/string.mjs", "funcmod/funcmod.mjs", "nested/date/date.mjs", "util/*"]
	};
}

/**
 * Runs a complete performance benchmark set with configurable order
 * @param {boolean} eagerFirst - If true, run eager tests first; if false, run lazy tests first
 * @returns {Promise<object>} Benchmark results object
 */
async function runBenchmarkSet(eagerFirst = true) {
	const results = {
		eagerFirst,
		startup: {},
		functionCalls: {},
		complexModules: {},
		multiModules: {},
		realisticUsage: {} // New: realistic API usage patterns
	};

	console.log(`\n🔄 Running benchmark set (${eagerFirst ? "Eager First" : "Lazy First"})...`);

	// === STARTUP TIME COMPARISON ===
	console.log("\n📊 Test: Startup Time Comparison");
	console.log("=====================================");

	if (eagerFirst) {
		// Eager first, then lazy
		results.startup.eager = await benchmarkEagerStartup();
		results.startup.lazy = await benchmarkLazyStartup();
	} else {
		// Lazy first, then eager
		results.startup.lazy = await benchmarkLazyStartup();
		results.startup.eager = await benchmarkEagerStartup();
	}

	console.log(
		`Eager Mode Startup:  ${formatTime(results.startup.eager.avg)} (avg) | ${formatTime(results.startup.eager.min)} (min) | ${formatTime(
			results.startup.eager.max
		)} (max)`
	);
	console.log(
		`Lazy Mode Startup:   ${formatTime(results.startup.lazy.avg)} (avg) | ${formatTime(results.startup.lazy.min)} (min) | ${formatTime(
			results.startup.lazy.max
		)} (max)`
	);

	// === FUNCTION CALL PERFORMANCE ===
	console.log(`\n📊 Test: Function Call Performance (${BENCHMARK_ITERATIONS} iterations)`);
	console.log("===========================================================");

	if (eagerFirst) {
		// Eager first, then lazy
		results.functionCalls.eager = await benchmarkEagerFunctionCalls();

		console.log("Measuring lazy first call (materialization)...");
		console.log("Measuring lazy subsequent calls (post-materialization)...");
		const lazyResults = await benchmarkLazyFunctionCalls();
		results.functionCalls.lazyFirst = lazyResults.lazyFirst;
		results.functionCalls.lazySubsequent = lazyResults.lazySubsequent;
	} else {
		// Lazy first, then eager
		console.log("Measuring lazy first call (materialization)...");
		console.log("Measuring lazy subsequent calls (post-materialization)...");
		const lazyResults = await benchmarkLazyFunctionCalls();
		results.functionCalls.lazyFirst = lazyResults.lazyFirst;
		results.functionCalls.lazySubsequent = lazyResults.lazySubsequent;

		results.functionCalls.eager = await benchmarkEagerFunctionCalls();
	}

	console.log(`Lazy First Call: ${formatTime(results.functionCalls.lazyFirst.time)} (materialization)`);
	console.log(
		`Eager Mode Calls:         ${formatTime(results.functionCalls.eager.avg)} (avg) | ${formatTime(
			results.functionCalls.eager.min
		)} (min) | ${formatTime(results.functionCalls.eager.max)} (max)`
	);
	console.log(
		`Lazy Subsequent Calls:    ${formatTime(results.functionCalls.lazySubsequent.avg)} (avg) | ${formatTime(
			results.functionCalls.lazySubsequent.min
		)} (min) | ${formatTime(results.functionCalls.lazySubsequent.max)} (max)`
	);

	// === COMPLEX MODULE ACCESS ===
	console.log(`\n📊 Test: Complex Module Access (${BENCHMARK_ITERATIONS_COMPLEX} iterations)`);
	console.log("=================================================");

	if (eagerFirst) {
		// Eager first, then lazy
		results.complexModules.eager = await benchmarkEagerComplexModules();
		const lazyComplexResults = await benchmarkLazyComplexModules();
		results.complexModules.lazyFirst = lazyComplexResults.lazyFirst;
		results.complexModules.lazySubsequent = lazyComplexResults.lazySubsequent;
	} else {
		// Lazy first, then eager
		const lazyComplexResults = await benchmarkLazyComplexModules();
		results.complexModules.lazyFirst = lazyComplexResults.lazyFirst;
		results.complexModules.lazySubsequent = lazyComplexResults.lazySubsequent;
		results.complexModules.eager = await benchmarkEagerComplexModules();
	}

	console.log(`Eager Nested Calls:       ${formatTime(results.complexModules.eager.avg)} (avg)`);
	console.log(`Lazy Nested First:        ${formatTime(results.complexModules.lazyFirst.time)} (materialization)`);
	console.log(`Lazy Nested Subsequent:   ${formatTime(results.complexModules.lazySubsequent.avg)} (avg)`);

	// === MULTIPLE MODULE ACCESS PATTERNS ===
	console.log(`\n📊 Test: Multiple Module Access Patterns (${BENCHMARK_ITERATIONS_MULTI} iterations per test)`);
	console.log("=================================================================");

	const moduleTests = [
		{
			name: "Nested Math Module (math/math.mjs)",
			testFn: (api) => callMathAdd(api, 2, 3)
		},
		{
			name: "String Module (string/string.mjs)",
			testFn: (api) => callStringUpper(api, "test")
		},
		{
			name: "Callable Function Module (funcmod/funcmod.mjs)",
			testFn: (api) => callFuncmod(api, 5, 6)
		}
	];

	results.multiModules = {};

	for (const moduleTest of moduleTests) {
		console.log(`\n${moduleTest.name}:`);

		if (eagerFirst) {
			// Eager first, then lazy
			const eagerResult = await benchmarkEagerMultiModule(moduleTest.name, moduleTest.testFn);
			const lazyResult = await benchmarkLazyMultiModule(moduleTest.name, moduleTest.testFn);

			results.multiModules[moduleTest.name] = {
				eager: eagerResult,
				lazyFirst: lazyResult.lazyFirst,
				lazySubsequent: lazyResult.lazySubsequent
			};
		} else {
			// Lazy first, then eager
			const lazyResult = await benchmarkLazyMultiModule(moduleTest.name, moduleTest.testFn);
			const eagerResult = await benchmarkEagerMultiModule(moduleTest.name, moduleTest.testFn);

			results.multiModules[moduleTest.name] = {
				eager: eagerResult,
				lazyFirst: lazyResult.lazyFirst,
				lazySubsequent: lazyResult.lazySubsequent
			};
		}

		const eagerAvg = results.multiModules[moduleTest.name].eager.avg;
		const lazyFirstTime = results.multiModules[moduleTest.name].lazyFirst.time;
		const lazySubAvg = results.multiModules[moduleTest.name].lazySubsequent.avg;

		console.log(`  Eager:      ${formatTime(eagerAvg)} (avg)`);
		console.log(`  Lazy First: ${formatTime(lazyFirstTime)} (materialization)`);
		console.log(`  Lazy Sub:   ${formatTime(lazySubAvg)} (avg, materialized)`);
		console.log(`  First vs Eager: ${(lazyFirstTime / eagerAvg).toFixed(1)}x slower`);
		console.log(`  Sub vs Eager:   ${(lazySubAvg / eagerAvg).toFixed(1)}x ${lazySubAvg < eagerAvg ? "faster" : "slower"}`);
		console.log(`  Materialization Benefit: ${(lazyFirstTime / lazySubAvg).toFixed(1)}x faster`);
	}

	// === REALISTIC API USAGE PATTERNS (HIGH WEIGHT) ===
	console.log(`\n📊 Test: Realistic API Usage Patterns (${BENCHMARK_ITERATIONS_REALISTIC} iterations) - HIGH WEIGHT`);
	console.log("=".repeat(80));
	console.log("Testing with actual API calls from api-test-config.jsonc");
	console.log("This represents real-world usage with diverse function calls across the API");

	if (eagerFirst) {
		// Eager first, then lazy
		console.log("\nBenchmarking eager mode with realistic API calls...");
		results.realisticUsage.eager = await benchmarkRealisticApiUsage(false);
		console.log("\nBenchmarking lazy mode with realistic API calls...");
		results.realisticUsage.lazy = await benchmarkRealisticApiUsage(true);
	} else {
		// Lazy first, then eager
		console.log("\nBenchmarking lazy mode with realistic API calls...");
		results.realisticUsage.lazy = await benchmarkRealisticApiUsage(true);
		console.log("\nBenchmarking eager mode with realistic API calls...");
		results.realisticUsage.eager = await benchmarkRealisticApiUsage(false);
	}

	const eagerRealisticAvg = results.realisticUsage.eager.avg;
	const lazyRealisticAvg = results.realisticUsage.lazy.avg;
	const totalCallTypes = results.realisticUsage.eager.totalCalls;

	console.log(`\nRealistic Usage Results (${totalCallTypes} unique API call patterns):`);
	console.log(
		`  Eager Mode: ${formatTime(eagerRealisticAvg)} (avg) | ${formatTime(results.realisticUsage.eager.min)} (min) | ${formatTime(results.realisticUsage.eager.max)} (max)`
	);
	console.log(
		`  Lazy Mode:  ${formatTime(lazyRealisticAvg)} (avg) | ${formatTime(results.realisticUsage.lazy.min)} (min) | ${formatTime(results.realisticUsage.lazy.max)} (max)`
	);
	console.log(
		`  Winner: ${lazyRealisticAvg < eagerRealisticAvg ? "Lazy" : "Eager"} mode (${(Math.max(eagerRealisticAvg, lazyRealisticAvg) / Math.min(eagerRealisticAvg, lazyRealisticAvg)).toFixed(2)}x faster)`
	);
	console.log(`  Weight: ${BENCHMARK_ITERATIONS_REALISTIC} iterations (highest in benchmark suite)`);

	return results;
}

/**
 * Runs benchmarks for a single mode without cross-mode interaction.
 * @param {"eager"|"lazy"} mode - Mode to benchmark.
 * @returns {Promise<object>} Benchmark results for the selected mode.
 * @private
 * @description
 * Executes only eager or only lazy tests to avoid mode contamination.
 * @example
 * const results = await runSingleModeBenchmarks("eager");
 */
async function runSingleModeBenchmarks(mode) {
	const results = {
		mode,
		startup: {},
		functionCalls: {},
		complexModules: {},
		multiModules: {},
		realisticUsage: {}
	};

	if (mode === "eager") {
		results.startup.eager = await benchmarkEagerStartup();
		results.functionCalls.eager = await benchmarkEagerFunctionCalls();
		results.complexModules.eager = await benchmarkEagerComplexModules();
		results.multiModules = {};
		const moduleTests = [
			{ name: "Nested Math Module (math/math.mjs)", testFn: (api) => callMathAdd(api, 2, 3) },
			{ name: "String Module (string/string.mjs)", testFn: (api) => callStringUpper(api, "test") },
			{ name: "Callable Function Module (funcmod/funcmod.mjs)", testFn: (api) => callFuncmod(api, 5, 6) }
		];
		for (const moduleTest of moduleTests) {
			results.multiModules[moduleTest.name] = {
				eager: await benchmarkEagerMultiModule(moduleTest.name, moduleTest.testFn)
			};
		}
		results.realisticUsage.eager = await benchmarkRealisticApiUsage(false);
		return results;
	}

	results.startup.lazy = await benchmarkLazyStartup();
	const lazyCalls = await benchmarkLazyFunctionCalls();
	results.functionCalls.lazyFirst = lazyCalls.lazyFirst;
	results.functionCalls.lazySubsequent = lazyCalls.lazySubsequent;
	const lazyComplex = await benchmarkLazyComplexModules();
	results.complexModules.lazyFirst = lazyComplex.lazyFirst;
	results.complexModules.lazySubsequent = lazyComplex.lazySubsequent;
	results.multiModules = {};
	const moduleTests = [
		{ name: "Nested Math Module (math/math.mjs)", testFn: (api) => callMathAdd(api, 2, 3) },
		{ name: "String Module (string/string.mjs)", testFn: (api) => callStringUpper(api, "test") },
		{ name: "Callable Function Module (funcmod/funcmod.mjs)", testFn: (api) => callFuncmod(api, 5, 6) }
	];
	for (const moduleTest of moduleTests) {
		const lazyResult = await benchmarkLazyMultiModule(moduleTest.name, moduleTest.testFn);
		results.multiModules[moduleTest.name] = {
			lazyFirst: lazyResult.lazyFirst,
			lazySubsequent: lazyResult.lazySubsequent
		};
	}
	results.realisticUsage.lazy = await benchmarkRealisticApiUsage(true);
	return results;
}

/**
 * Aggregates results from multiple benchmark runs
 * @param {object[]} resultSets - Array of benchmark result objects
 * @returns {object} Aggregated results
 */
function aggregateResults(resultSets) {
	const aggregated = {
		startup: { eager: {}, lazy: {} },
		functionCalls: { eager: {}, lazyFirst: {}, lazySubsequent: {} },
		complexModules: { eager: {}, lazyFirst: {}, lazySubsequent: {} },
		multiModules: {},
		realisticUsage: { eager: {}, lazy: {} } // New: realistic usage patterns
	};

	// Helper function to aggregate benchmark stats
	function aggregateStats(statArrays) {
		const avgValues = statArrays.map((s) => s.avg);
		const minValues = statArrays.map((s) => s.min);
		const maxValues = statArrays.map((s) => s.max);

		return {
			avg: avgValues.reduce((sum, val) => sum + val, 0) / avgValues.length,
			min: Math.min(...minValues),
			max: Math.max(...maxValues),
			median: avgValues.sort((a, b) => a - b)[Math.floor(avgValues.length / 2)]
		};
	}

	// Helper function to aggregate time measurements
	function aggregateTimes(timeArrays) {
		return {
			time: timeArrays.reduce((sum, val) => sum + val, 0) / timeArrays.length
		};
	}

	// Aggregate startup results
	aggregated.startup.eager = aggregateStats(resultSets.map((r) => r.startup.eager));
	aggregated.startup.lazy = aggregateStats(resultSets.map((r) => r.startup.lazy));

	// Aggregate function call results
	aggregated.functionCalls.eager = aggregateStats(resultSets.map((r) => r.functionCalls.eager));
	aggregated.functionCalls.lazyFirst = aggregateTimes(resultSets.map((r) => r.functionCalls.lazyFirst.time));
	aggregated.functionCalls.lazySubsequent = aggregateStats(resultSets.map((r) => r.functionCalls.lazySubsequent));

	// Aggregate complex module results
	aggregated.complexModules.eager = aggregateStats(resultSets.map((r) => r.complexModules.eager));
	aggregated.complexModules.lazyFirst = aggregateTimes(resultSets.map((r) => r.complexModules.lazyFirst.time));
	aggregated.complexModules.lazySubsequent = aggregateStats(resultSets.map((r) => r.complexModules.lazySubsequent));

	// Aggregate multi-module results
	const firstResultSet = resultSets[0];
	if (firstResultSet && firstResultSet.multiModules) {
		for (const testName of Object.keys(firstResultSet.multiModules)) {
			aggregated.multiModules[testName] = {
				eager: aggregateStats(resultSets.map((r) => r.multiModules[testName].eager)),
				lazyFirst: aggregateTimes(resultSets.map((r) => r.multiModules[testName].lazyFirst.time)),
				lazySubsequent: aggregateStats(resultSets.map((r) => r.multiModules[testName].lazySubsequent))
			};
		}
	}

	// Aggregate realistic usage results
	if (firstResultSet && firstResultSet.realisticUsage) {
		aggregated.realisticUsage.eager = aggregateStats(resultSets.map((r) => r.realisticUsage.eager));
		aggregated.realisticUsage.lazy = aggregateStats(resultSets.map((r) => r.realisticUsage.lazy));
		aggregated.realisticUsage.totalCalls = firstResultSet.realisticUsage.eager.totalCalls;
		aggregated.realisticUsage.iterations = firstResultSet.realisticUsage.eager.iterations;
	}

	return aggregated;
}

/**
 * Displays detailed results from individual benchmark runs
 * @param {object} eagerFirstResults - Results when eager ran first
 * @param {object} lazyFirstResults - Results when lazy ran first
 */
function displayIndividualResults(eagerFirstResults, lazyFirstResults) {
	console.log("\n" + "=".repeat(80));
	console.log("📊 DETAILED INDIVIDUAL RESULTS BY TEST ORDER");
	console.log("=".repeat(80));

	// Startup comparison
	console.log("\n🚀 STARTUP PERFORMANCE:");
	console.log("   When Eager Ran First:");
	console.log(`     Eager: ${formatTime(eagerFirstResults.startup.eager.avg)} (avg)`);
	console.log(`     Lazy:  ${formatTime(eagerFirstResults.startup.lazy.avg)} (avg)`);
	console.log("   When Lazy Ran First:");
	console.log(`     Eager: ${formatTime(lazyFirstResults.startup.eager.avg)} (avg)`);
	console.log(`     Lazy:  ${formatTime(lazyFirstResults.startup.lazy.avg)} (avg)`);

	// Function call comparison
	console.log("\n⚡ FUNCTION CALL PERFORMANCE:");
	console.log("   When Eager Ran First:");
	console.log(`     Eager:             ${formatTime(eagerFirstResults.functionCalls.eager.avg)} (avg)`);
	console.log(`     Lazy (first):      ${formatTime(eagerFirstResults.functionCalls.lazyFirst.time)} (materialization)`);
	console.log(`     Lazy (subsequent): ${formatTime(eagerFirstResults.functionCalls.lazySubsequent.avg)} (avg)`);
	console.log("   When Lazy Ran First:");
	console.log(`     Eager:             ${formatTime(lazyFirstResults.functionCalls.eager.avg)} (avg)`);
	console.log(`     Lazy (first):      ${formatTime(lazyFirstResults.functionCalls.lazyFirst.time)} (materialization)`);
	console.log(`     Lazy (subsequent): ${formatTime(lazyFirstResults.functionCalls.lazySubsequent.avg)} (avg)`);

	// Complex module comparison
	console.log("\n🎯 COMPLEX MODULE PERFORMANCE:");
	console.log("   When Eager Ran First:");
	console.log(`     Eager:             ${formatTime(eagerFirstResults.complexModules.eager.avg)} (avg)`);
	console.log(`     Lazy (first):      ${formatTime(eagerFirstResults.complexModules.lazyFirst.time)} (materialization)`);
	console.log(`     Lazy (subsequent): ${formatTime(eagerFirstResults.complexModules.lazySubsequent.avg)} (avg)`);
	console.log("   When Lazy Ran First:");
	console.log(`     Eager:             ${formatTime(lazyFirstResults.complexModules.eager.avg)} (avg)`);
	console.log(`     Lazy (first):      ${formatTime(lazyFirstResults.complexModules.lazyFirst.time)} (materialization)`);
	console.log(`     Lazy (subsequent): ${formatTime(lazyFirstResults.complexModules.lazySubsequent.avg)} (avg)`);

	// Multi-module comparison
	console.log("\n🔄 MULTI-MODULE ACCESS PATTERNS:");
	for (const [testName, _] of Object.entries(eagerFirstResults.multiModules)) {
		console.log(`\n   ${testName}:`);

		const eagerFirstTest = eagerFirstResults.multiModules[testName];
		const lazyFirstTest = lazyFirstResults.multiModules[testName];

		console.log("     When Eager Ran First:");
		console.log(`       Eager:             ${formatTime(eagerFirstTest.eager.avg)}`);
		console.log(`       Lazy (first):      ${formatTime(eagerFirstTest.lazyFirst.time)} (materialization)`);
		console.log(`       Lazy (subsequent): ${formatTime(eagerFirstTest.lazySubsequent.avg)}`);

		console.log("     When Lazy Ran First:");
		console.log(`       Eager:             ${formatTime(lazyFirstTest.eager.avg)}`);
		console.log(`       Lazy (first):      ${formatTime(lazyFirstTest.lazyFirst.time)} (materialization)`);
		console.log(`       Lazy (subsequent): ${formatTime(lazyFirstTest.lazySubsequent.avg)}`);

		// Show performance difference analysis
		const eagerFirstSpeedup = (eagerFirstTest.eager.avg / eagerFirstTest.lazySubsequent.avg).toFixed(2);
		const lazyFirstSpeedup = (lazyFirstTest.eager.avg / lazyFirstTest.lazySubsequent.avg).toFixed(2);

		console.log("     Performance Analysis:");
		console.log(`       Eager-first test: Lazy ${parseFloat(eagerFirstSpeedup) > 1 ? "wins" : "loses"} by ${Math.abs(eagerFirstSpeedup)}x`);
		console.log(`       Lazy-first test:  Lazy ${parseFloat(lazyFirstSpeedup) > 1 ? "wins" : "loses"} by ${Math.abs(lazyFirstSpeedup)}x`);
	}

	// Realistic usage comparison (HIGH WEIGHT)
	if (eagerFirstResults.realisticUsage && lazyFirstResults.realisticUsage) {
		console.log("\n🌐 REALISTIC API USAGE PATTERNS (HIGH WEIGHT):");
		console.log(
			`   Testing ${eagerFirstResults.realisticUsage.eager.totalCalls} unique API call patterns (${eagerFirstResults.realisticUsage.eager.iterations} iterations)`
		);

		console.log("   When Eager Ran First:");
		console.log(`     Eager: ${formatTime(eagerFirstResults.realisticUsage.eager.avg)} (avg)`);
		console.log(`     Lazy:  ${formatTime(eagerFirstResults.realisticUsage.lazy.avg)} (avg)`);

		console.log("   When Lazy Ran First:");
		console.log(`     Eager: ${formatTime(lazyFirstResults.realisticUsage.eager.avg)} (avg)`);
		console.log(`     Lazy:  ${formatTime(lazyFirstResults.realisticUsage.lazy.avg)} (avg)`);

		const eagerFirstSpeedup = (eagerFirstResults.realisticUsage.eager.avg / eagerFirstResults.realisticUsage.lazy.avg).toFixed(2);
		const lazyFirstSpeedup = (lazyFirstResults.realisticUsage.eager.avg / lazyFirstResults.realisticUsage.lazy.avg).toFixed(2);

		console.log("     Performance Analysis:");
		console.log(`       Eager-first test: Lazy ${parseFloat(eagerFirstSpeedup) > 1 ? "wins" : "loses"} by ${Math.abs(eagerFirstSpeedup)}x`);
		console.log(`       Lazy-first test:  Lazy ${parseFloat(lazyFirstSpeedup) > 1 ? "wins" : "loses"} by ${Math.abs(lazyFirstSpeedup)}x`);
		console.log(`     ⭐ Highest weight test - represents real-world diverse API usage`);
	}
}

/**
 * Displays aggregated benchmark results
 * @param {object} aggregated - Aggregated benchmark results
 * @param {object} eagerFirstResults - Results when eager ran first
 * @param {object} lazyFirstResults - Results when lazy ran first
 */
function displayAggregatedResults(aggregated) {
	console.log("\n" + "=".repeat(80));
	console.log("🎯 FINAL AGGREGATED RESULTS");
	console.log("=".repeat(80));

	// Startup comparison
	const startupSpeedup = (aggregated.startup.eager.avg / aggregated.startup.lazy.avg).toFixed(1);
	const startupWinnerDisplay = parseFloat(startupSpeedup) > 1 ? "Lazy" : "Eager";
	const startupSpeedupDisplay =
		parseFloat(startupSpeedup) > 1 ? parseFloat(startupSpeedup).toFixed(1) : (1 / parseFloat(startupSpeedup)).toFixed(1);
	console.log("\n📊 STARTUP PERFORMANCE:");
	console.log(`   Eager: ${formatTime(aggregated.startup.eager.avg)} (avg)`);
	console.log(`   Lazy:  ${formatTime(aggregated.startup.lazy.avg)} (avg)`);
	console.log(`   Winner: ${startupWinnerDisplay} mode (${startupSpeedupDisplay}x faster)`);

	// Function call comparison
	const callSpeedup = (aggregated.functionCalls.eager.avg / aggregated.functionCalls.lazySubsequent.avg).toFixed(2);
	const callWinner = parseFloat(callSpeedup) > 1 ? "Lazy" : "Eager";
	const lazyTotalWithMaterialization = aggregated.functionCalls.lazySubsequent.avg + aggregated.functionCalls.lazyFirst.time;
	console.log("\n📊 FUNCTION CALL PERFORMANCE:");
	console.log(`   Eager:           ${formatTime(aggregated.functionCalls.eager.avg)} (avg)`);
	console.log(`   Lazy (first):    ${formatTime(aggregated.functionCalls.lazyFirst.time)} (materialization)`);
	console.log(`   Lazy (subsequent): ${formatTime(aggregated.functionCalls.lazySubsequent.avg)} (avg)`);
	console.log(`   Lazy (avg w/ materialization): ${formatTime(lazyTotalWithMaterialization)} (first call cost amortized)`);
	console.log(`   Winner: ${callWinner} mode (${Math.abs(callSpeedup)}x ${parseFloat(callSpeedup) > 1 ? "faster" : "slower"})`);

	// Complex module comparison
	const complexSpeedup = (aggregated.complexModules.eager.avg / aggregated.complexModules.lazySubsequent.avg).toFixed(2);
	const complexWinner = parseFloat(complexSpeedup) > 1 ? "Lazy" : "Eager";
	console.log("\n📊 COMPLEX MODULE PERFORMANCE:");
	console.log(`   Eager:             ${formatTime(aggregated.complexModules.eager.avg)} (avg)`);
	console.log(`   Lazy (first):      ${formatTime(aggregated.complexModules.lazyFirst.time)} (materialization)`);
	console.log(`   Lazy (subsequent): ${formatTime(aggregated.complexModules.lazySubsequent.avg)} (avg)`);
	console.log(`   Winner: ${complexWinner} mode (${Math.abs(complexSpeedup)}x ${parseFloat(complexSpeedup) > 1 ? "faster" : "slower"})`);

	// Multi-module summary
	console.log("\n📊 MULTI-MODULE ACCESS PATTERNS:");
	for (const [testName, results] of Object.entries(aggregated.multiModules)) {
		const moduleSpeedup = (results.eager.avg / results.lazySubsequent.avg).toFixed(2);
		const moduleWinner = parseFloat(moduleSpeedup) > 1 ? "Lazy" : "Eager";
		console.log(`   ${testName}:`);
		console.log(`     Eager:             ${formatTime(results.eager.avg)}`);
		console.log(`     Lazy (subsequent): ${formatTime(results.lazySubsequent.avg)}`);
		console.log(`     Winner: ${moduleWinner} (${Math.abs(moduleSpeedup)}x ${parseFloat(moduleSpeedup) > 1 ? "faster" : "slower"})`);
	}

	// Realistic usage patterns (HIGH WEIGHT)
	if (aggregated.realisticUsage && aggregated.realisticUsage.eager) {
		const realisticSpeedup = (aggregated.realisticUsage.eager.avg / aggregated.realisticUsage.lazy.avg).toFixed(2);
		const realisticWinner = parseFloat(realisticSpeedup) > 1 ? "Lazy" : "Eager";
		console.log("\n📊 REALISTIC API USAGE PATTERNS (⭐ HIGH WEIGHT - " + aggregated.realisticUsage.iterations + " iterations):");
		console.log(`   Testing ${aggregated.realisticUsage.totalCalls} unique API call patterns from actual test suite`);
		console.log(`   Eager: ${formatTime(aggregated.realisticUsage.eager.avg)} (avg)`);
		console.log(`   Lazy:  ${formatTime(aggregated.realisticUsage.lazy.avg)} (avg)`);
		console.log(
			`   Winner: ${realisticWinner} mode (${Math.abs(realisticSpeedup)}x ${parseFloat(realisticSpeedup) > 1 ? "faster" : "slower"})`
		);
		console.log(`   ⚠️  This test carries highest weight - represents real-world diverse API usage`);
	}

	// Overall recommendation
	console.log("\n🏆 OVERALL PERFORMANCE WINNER:");

	// Calculate weighted score with realistic usage having highest weight
	const startupWeight = 0.15; // Reduced from 0.3
	const callWeight = 0.25; // Reduced from 0.7
	const realisticWeight = 0.6; // NEW: Highest weight for realistic patterns

	const lazyStartupScore = parseFloat(startupSpeedup) * startupWeight;
	const lazyCallScore = parseFloat(callSpeedup) * callWeight;

	let lazyRealisticScore = 0;
	if (aggregated.realisticUsage && aggregated.realisticUsage.eager) {
		const realisticSpeedup = (aggregated.realisticUsage.eager.avg / aggregated.realisticUsage.lazy.avg).toFixed(2);
		lazyRealisticScore = parseFloat(realisticSpeedup) * realisticWeight;
	}

	const lazyTotalScore = lazyStartupScore + lazyCallScore + lazyRealisticScore;

	const overallWinner = lazyTotalScore > 1 ? "Lazy" : "Eager";
	console.log(`   ${overallWinner} mode wins overall`);
	console.log(`   (Weighted score: ${lazyTotalScore.toFixed(2)} - higher is better for lazy mode)`);
	console.log(
		`   Weight distribution: Startup ${(startupWeight * 100).toFixed(0)}%, Function Calls ${(callWeight * 100).toFixed(0)}%, Realistic Usage ${(realisticWeight * 100).toFixed(0)}%`
	);

	// Add comprehensive performance analysis and recommendations
	console.log("\n🎯 PERFORMANCE ANALYSIS & RECOMMENDATIONS");
	console.log("==========================================");

	console.log("� BENCHMARK RESULTS SUMMARY:");
	const startupWinner = aggregated.startup.lazy.avg < aggregated.startup.eager.avg ? "Lazy mode wins" : "Eager mode wins";
	const callWinnerText =
		aggregated.functionCalls.lazySubsequent.avg < aggregated.functionCalls.eager.avg ? "Lazy mode wins" : "Eager mode wins";
	console.log(`• Startup Performance:     ${startupWinner}`);
	console.log(`• Function Call Performance: ${callWinnerText}`);
	console.log(`• Materialization Overhead: ${formatTime(aggregated.functionCalls.lazyFirst.time)} (one-time cost per module)`);

	console.log("\n🔍 DETAILED ANALYSIS:");
	const startupSpeedupRatio = (aggregated.startup.eager.avg / aggregated.startup.lazy.avg).toFixed(1);
	const callSpeedupRatio = (aggregated.functionCalls.eager.avg / aggregated.functionCalls.lazySubsequent.avg).toFixed(1);

	if (parseFloat(startupSpeedupRatio) > 1) {
		console.log(`✅ Lazy startup is ${startupSpeedupRatio}x faster because:`);
		console.log("   - No upfront module loading and compilation");
		console.log("   - Deferred file system operations");
		console.log("   - Minimal initial memory allocation");
	} else {
		console.log(`✅ Eager startup is ${(1 / parseFloat(startupSpeedupRatio)).toFixed(1)}x faster because:`);
		console.log("   - Better optimization with full module graph");
		console.log("   - No proxy overhead during initialization");
		console.log("   - Predictable startup characteristics");
	}

	if (parseFloat(callSpeedupRatio) > 1) {
		console.log(`\n✅ Lazy function calls are ${callSpeedupRatio}x faster because:`);
		console.log("   - Post-materialization optimization");
		console.log("   - Reduced memory pressure improves cache locality");
		console.log("   - JIT compiler optimizations on materialized functions");
	} else {
		console.log(`\n❌ Eager function calls are ${(1 / parseFloat(callSpeedupRatio)).toFixed(1)}x faster because:`);
		console.log("   - No materialization overhead after startup");
		console.log("   - Consistent performance characteristics");
		console.log("   - Predictable function call timing");
	}

	console.log("\n📋 USAGE RECOMMENDATIONS:");
	console.log("\n🚀 CHOOSE EAGER MODE WHEN:");
	console.log("   • You use most/all modules in your API");
	console.log("   • Function call performance is critical");
	console.log("   • Memory usage is not a constraint");
	console.log("   • Startup time is acceptable");
	console.log("   • You prefer predictable performance characteristics");

	console.log("\n🎯 CHOOSE LAZY MODE WHEN:");
	console.log("   • You only use a subset of available modules");
	console.log("   • Fast startup time is critical");
	console.log("   • Memory efficiency is important");
	console.log("   • You can tolerate one-time materialization overhead");
	console.log("   • You have a large API with many unused endpoints");

	console.log("\n⚖️  TRADE-OFF SUMMARY:");
	const startupTradeoffWinner = aggregated.startup.lazy.avg < aggregated.startup.eager.avg ? "Lazy" : "Eager";
	const startupFaster =
		startupTradeoffWinner === "Lazy" ? formatTime(aggregated.startup.lazy.avg) : formatTime(aggregated.startup.eager.avg);
	const startupSlower =
		startupTradeoffWinner === "Lazy" ? formatTime(aggregated.startup.eager.avg) : formatTime(aggregated.startup.lazy.avg);
	console.log(`   • Startup:     ${startupTradeoffWinner} wins (${startupFaster} vs ${startupSlower})`);
	console.log(
		`   • Calls:       ${callWinner} wins (${formatTime(
			Math.min(aggregated.functionCalls.eager.avg, aggregated.functionCalls.lazySubsequent.avg)
		)} vs ${formatTime(Math.max(aggregated.functionCalls.eager.avg, aggregated.functionCalls.lazySubsequent.avg))})`
	);
	console.log(`   • Memory:      Lazy wins (only loads used modules)`);
	console.log(`                  ⚠️  Note: Once materialized, modules stay in memory - lazy's memory advantage is only for unused modules`);
	console.log(`   • Consistency: Eager wins (no materialization surprises)`);

	console.log("\n💡 PERFORMANCE NOTES:");
	console.log("   • These benchmarks represent micro-optimizations");
	console.log("   • Real-world performance depends on your specific usage patterns");
	console.log("   • Consider profiling your actual application workload");
	console.log("   • The difference may be negligible for most applications");

	console.log("\n📏 Raw Numbers (for documentation):");
	console.log(`   • Eager startup: ${formatTime(aggregated.startup.eager.avg)}`);
	console.log(`   • Lazy startup:  ${formatTime(aggregated.startup.lazy.avg)}`);
	console.log(`   • Eager calls:   ${formatTime(aggregated.functionCalls.eager.avg)}`);
	console.log(`   • Lazy calls:    ${formatTime(aggregated.functionCalls.lazySubsequent.avg)}`);
	console.log(
		`   • Lazy calls (w/ materialization): ${formatTime(aggregated.functionCalls.lazySubsequent.avg + aggregated.functionCalls.lazyFirst.time)}`
	);
	console.log(`   • Materialization: ${formatTime(aggregated.functionCalls.lazyFirst.time)}`);
}

// Main execution with optional --json flag
async function main() {
	if (ensureDevEnvFlags()) {
		return;
	}

	const module = await import("@cldmv/slothlet");
	slothlet = module?.default ?? module?.slothlet ?? module;
	if (typeof slothlet !== "function") {
		throw new Error("slothlet entrypoint did not export a callable function");
	}

	const { apiDir, apiConfigPath } = resolveApiPaths();
	API_DIR = apiDir;
	API_CONFIG_PATH = apiConfigPath;

	const jsonMode = process.argv.includes("--json");
	const orderArg = process.argv.find((arg) => arg.startsWith("--order="));
	const orderValue = orderArg ? orderArg.slice("--order=".length) : null;
	const modeArg = process.argv.find((arg) => arg.startsWith("--mode="));
	const modeValue = modeArg ? modeArg.slice("--mode=".length) : null;
	let forcedOrder = null;
	if (orderValue) {
		if (orderValue === "eager-first") {
			forcedOrder = true;
		} else if (orderValue === "lazy-first") {
			forcedOrder = false;
		} else {
			throw new Error("--order must be eager-first or lazy-first");
		}
	}
	if (modeValue && modeValue !== "eager" && modeValue !== "lazy") {
		throw new Error("--mode must be eager or lazy");
	}

	// Helper to suppress console.log if jsonMode
	if (jsonMode) {
		// Override console.log to noop
		console.log = () => {};
	}

	// Analyze module structure
	const moduleStructure = await analyzeModuleStructure(API_DIR);
	if (!jsonMode) {
		console.log("🚀 Slothlet Aggregated Performance Benchmark");
		console.log(`Testing with API directory: ${API_DIR}`);
		console.log("\n🔍 DEBUG: Module Structure Analysis");
		console.log("====================================");
		console.log("• Root modules (loaded immediately in lazy mode):");
		moduleStructure.rootModules.forEach((mod) => console.log(`  - ${mod}`));
		console.log("• Nested modules (materialized on-demand in lazy mode):");
		moduleStructure.nestedModules.forEach((mod) => console.log(`  - ${mod}`));
		console.log("• Testing ONLY nested modules to measure true materialization!");
		console.log("\n" + "=".repeat(60));
		console.log("RUNNING BIDIRECTIONAL BENCHMARK TESTS");
		console.log("=".repeat(60));
	}

	if (modeValue) {
		const singleModeResults = await runSingleModeBenchmarks(modeValue);
		if (jsonMode) {
			process.stdout.write(JSON.stringify(singleModeResults, null, 2) + "\n");
			return;
		}
		console.log(`\n✅ Completed ${modeValue} mode benchmarks only.`);
		console.log(JSON.stringify(singleModeResults, null, 2));
		return;
	}

	const lazyFirstResults = forcedOrder === null || forcedOrder === false ? await runBenchmarkSet(false) : null;
	const eagerFirstResults = forcedOrder === null || forcedOrder === true ? await runBenchmarkSet(true) : null;

	// Aggregate results
	const resultSets = [eagerFirstResults, lazyFirstResults].filter(Boolean);
	const aggregated = aggregateResults(resultSets);

	if (jsonMode) {
		// Output only raw numbers as JSON, including formatted summary
		const rawNumbers = {
			startup: aggregated.startup,
			functionCalls: aggregated.functionCalls,
			complexModules: aggregated.complexModules,
			multiModules: aggregated.multiModules,
			rawNumbersFormatted: {
				eagerStartup: formatTime(aggregated.startup.eager.avg),
				lazyStartup: formatTime(aggregated.startup.lazy.avg),
				eagerCalls: formatTime(aggregated.functionCalls.eager.avg),
				lazyCalls: formatTime(aggregated.functionCalls.lazySubsequent.avg),
				materialization: formatTime(aggregated.functionCalls.lazyFirst.time)
			}
		};
		// Print JSON to stdout
		process.stdout.write(JSON.stringify(rawNumbers, null, 2) + "\n");
	} else {
		if (eagerFirstResults && lazyFirstResults) {
			// Display individual results from each test order
			displayIndividualResults(eagerFirstResults, lazyFirstResults);
			// Display order effect analysis
			displayOrderEffectAnalysis(eagerFirstResults, lazyFirstResults);
		}
		// Display final results
		displayAggregatedResults(aggregated);
	}
}

// Run the benchmark
main().catch(console.error);
