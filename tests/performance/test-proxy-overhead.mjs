/**
 * Test to measure proxy overhead in eager vs lazy modes
 */

// Set development environment
process.env.NODE_ENV = "development";
process.env.NODE_OPTIONS = "--conditions=slothlet-dev --conditions=development";

import { performance } from "perf_hooks";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { slothlet as rawSlothlet } from "@cldmv/slothlet/slothlet";
import wrappedSlothlet from "@cldmv/slothlet";

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
	const median = times[Math.floor(times.length / 2)];
	const min = times[0];

	console.log(`${name}: avg=${avg.toFixed(4)}ms, median=${median.toFixed(4)}ms, min=${min.toFixed(4)}ms`);
	return { avg, median, min };
}

async function main() {
	console.log("🔍 Testing Proxy Overhead\n");

	// Test 1: Raw eager (no wrapper)
	console.log("1. Raw Eager (no makeWrapper):");
	const rawEager = await rawSlothlet({ dir: API_DIR, mode: "eager" });
	const rawEagerResults = await measureCalls(rawEager, "  Raw Eager");
	await rawEager.shutdown();

	// Test 2: Wrapped eager
	console.log("\n2. Wrapped Eager (with makeWrapper):");
	const wrappedEager = await wrappedSlothlet({ dir: API_DIR, mode: "eager" });
	const wrappedEagerResults = await measureCalls(wrappedEager, "  Wrapped Eager");
	await wrappedEager.shutdown();

	// Test 3: Raw lazy (no wrapper)
	console.log("\n3. Raw Lazy (no makeWrapper):");
	const rawLazy = await rawSlothlet({ dir: API_DIR, mode: "lazy" });
	// Materialize
	await rawLazy.math.add(2, 3);
	const rawLazyResults = await measureCalls(rawLazy, "  Raw Lazy");
	await rawLazy.shutdown();

	// Test 4: Wrapped lazy
	console.log("\n4. Wrapped Lazy (with makeWrapper):");
	const wrappedLazy = await wrappedSlothlet({ dir: API_DIR, mode: "lazy" });
	// Materialize
	await wrappedLazy.math.add(2, 3);
	const wrappedLazyResults = await measureCalls(wrappedLazy, "  Wrapped Lazy");
	await wrappedLazy.shutdown();

	// Analysis
	console.log("\n📊 ANALYSIS:");
	const wrapperOverheadEager = (((wrappedEagerResults.avg - rawEagerResults.avg) / rawEagerResults.avg) * 100).toFixed(1);
	const wrapperOverheadLazy = (((wrappedLazyResults.avg - rawLazyResults.avg) / rawLazyResults.avg) * 100).toFixed(1);

	console.log(`Wrapper overhead (eager): ${wrapperOverheadEager}%`);
	console.log(`Wrapper overhead (lazy): ${wrapperOverheadLazy}%`);

	const eagerVsLazyRaw = (rawEagerResults.avg / rawLazyResults.avg).toFixed(2);
	const eagerVsLazyWrapped = (wrappedEagerResults.avg / wrappedLazyResults.avg).toFixed(2);

	console.log(`\nEager vs Lazy (raw): ${eagerVsLazyRaw}x ${rawEagerResults.avg > rawLazyResults.avg ? "slower" : "faster"}`);
	console.log(`Eager vs Lazy (wrapped): ${eagerVsLazyWrapped}x ${wrappedEagerResults.avg > wrappedLazyResults.avg ? "slower" : "faster"}`);
}

main().catch(console.error);
