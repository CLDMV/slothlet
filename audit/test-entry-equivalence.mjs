#!/usr/bin/env node
/**
 * @fileoverview Test script to verify CJS and ESM entry points produce identical results.
 */

// Test CJS entry point using createRequire
async function testCJS() {
	const { createRequire } = await import("module");
	const require = createRequire(import.meta.url);
	const slothlet = require("../index.cjs");
	const api = await slothlet({ dir: "../api_tests/api_test", debug: false });
	return {
		type: typeof api,
		keys: Object.keys(api).sort(),
		hasConfig: "config" in api,
		hasRootFunction: typeof api === "function"
	};
}

// Test ESM entry point
async function testESM() {
	const { default: slothlet } = await import("../index.mjs");
	const api = await slothlet({ dir: "../api_tests/api_test", debug: false });
	return {
		type: typeof api,
		keys: Object.keys(api).sort(),
		hasConfig: "config" in api,
		hasRootFunction: typeof api === "function"
	};
}

async function compareEntryPoints() {
	console.log("🔍 Testing entry point equivalence...\n");

	try {
		const [cjsResult, esmResult] = await Promise.all([testCJS(), testESM()]);

		console.log("📊 CJS Result:", cjsResult);
		console.log("📊 ESM Result:", esmResult);

		// Compare results
		const identical = JSON.stringify(cjsResult) === JSON.stringify(esmResult);

		console.log("\n" + "=".repeat(50));
		if (identical) {
			console.log("✅ SUCCESS: Entry points produce identical results!");
		} else {
			console.log("❌ FAILURE: Entry points produce different results!");
			console.log("\nDifferences:");
			Object.keys(cjsResult).forEach((key) => {
				if (JSON.stringify(cjsResult[key]) !== JSON.stringify(esmResult[key])) {
					console.log(`  - ${key}: CJS=${JSON.stringify(cjsResult[key])}, ESM=${JSON.stringify(esmResult[key])}`);
				}
			});
		}
		console.log("=".repeat(50));

		return identical;
	} catch (error) {
		console.error("❌ Test failed:", error);
		return false;
	}
}

compareEntryPoints().then((success) => {
	process.exit(success ? 0 : 1);
});
