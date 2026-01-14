/**
 * Test if V8 JIT optimization explains the performance difference
 * Compare: same instance measured twice vs two different instances
 */

process.env.NODE_ENV = "development";
process.env.NODE_OPTIONS = "--conditions=slothlet-dev --conditions=development";

import { performance } from "perf_hooks";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { slothlet as rawSlothlet } from "@cldmv/slothlet/slothlet";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const API_DIR = join(__dirname, "../../api_tests/api_test");
const ITERATIONS = 1000;

async function measureCalls(api, name) {
	// Warmup
	for (let i = 0; i < 100; i++) {
		await api.math.add(2, 3);
	}

	// Measure
	const times = [];
	for (let i = 0; i < ITERATIONS; i++) {
		const start = performance.now();
		await api.math.add(2, 3);
		const end = performance.now();
		times.push(end - start);
	}

	times.sort((a, b) => a - b);
	const avg = times.reduce((sum, t) => sum + t, 0) / times.length;

	console.log(`${name}: avg=${(avg * 1000).toFixed(2)}μs`);
	return avg;
}

async function main() {
	console.log("🔍 Testing V8 JIT Optimization Theory\n");

	// Test 1: Create two eager instances, measure separately
	console.log("Test 1: Two separate eager instances (cold JIT for each)");
	const eager1 = await rawSlothlet({ dir: API_DIR, mode: "eager" });
	const eager1Time = await measureCalls(eager1, "  Eager instance 1");
	await eager1.shutdown();

	const eager2 = await rawSlothlet({ dir: API_DIR, mode: "eager" });
	const eager2Time = await measureCalls(eager2, "  Eager instance 2");
	await eager2.shutdown();

	console.log(`  Difference: ${((Math.abs(eager1Time - eager2Time) / Math.min(eager1Time, eager2Time)) * 100).toFixed(1)}%\n`);

	// Test 2: Create two lazy instances, materialize, measure separately
	console.log("Test 2: Two separate lazy instances (cold JIT for each)");
	const lazy1 = await rawSlothlet({ dir: API_DIR, mode: "lazy" });
	await lazy1.math.add(2, 3); // Materialize
	const lazy1Time = await measureCalls(lazy1, "  Lazy instance 1");
	await lazy1.shutdown();

	const lazy2 = await rawSlothlet({ dir: API_DIR, mode: "lazy" });
	await lazy2.math.add(2, 3); // Materialize
	const lazy2Time = await measureCalls(lazy2, "  Lazy instance 2");
	await lazy2.shutdown();

	console.log(`  Difference: ${((Math.abs(lazy1Time - lazy2Time) / Math.min(lazy1Time, lazy2Time)) * 100).toFixed(1)}%\n`);

	// Test 3: Eager then lazy (simulating benchmark order effect)
	console.log("Test 3: Eager first, then Lazy (like benchmark)");
	const eager3 = await rawSlothlet({ dir: API_DIR, mode: "eager" });
	const eager3Time = await measureCalls(eager3, "  Eager (warm JIT)");
	await eager3.shutdown();

	const lazy3 = await rawSlothlet({ dir: API_DIR, mode: "lazy" });
	await lazy3.math.add(2, 3); // Materialize
	const lazy3Time = await measureCalls(lazy3, "  Lazy (cold JIT after eager)");
	await lazy3.shutdown();

	console.log(`  Eager vs Lazy: ${(eager3Time / lazy3Time).toFixed(2)}x ${eager3Time > lazy3Time ? "slower" : "faster"}\n`);

	// Test 4: Lazy then eager (reverse order)
	console.log("Test 4: Lazy first, then Eager (reverse order)");
	const lazy4 = await rawSlothlet({ dir: API_DIR, mode: "lazy" });
	await lazy4.math.add(2, 3); // Materialize
	const lazy4Time = await measureCalls(lazy4, "  Lazy (warm JIT)");
	await lazy4.shutdown();

	const eager4 = await rawSlothlet({ dir: API_DIR, mode: "eager" });
	const eager4Time = await measureCalls(eager4, "  Eager (cold JIT after lazy)");
	await eager4.shutdown();

	console.log(`  Lazy vs Eager: ${(lazy4Time / eager4Time).toFixed(2)}x ${lazy4Time > eager4Time ? "slower" : "faster"}\n`);

	console.log("📊 ANALYSIS:");
	console.log("If V8 JIT optimization is the issue, we should see:");
	console.log("  • The first-measured mode is slower than the second (cold vs warm)");
	console.log("  • BUT: Both are loading different function instances, so each should optimize separately");
	console.log("\nIf module caching is the issue:");
	console.log("  • Lazy mode reuses the SAME function from module cache (faster)");
	console.log("  • Eager mode creates NEW function instances each time (slower due to cold JIT)");
}

main().catch(console.error);
