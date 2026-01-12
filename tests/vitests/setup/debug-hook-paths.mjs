/**
 * @fileoverview Debug script to inspect actual hook paths
 * @description
 * Creates slothlet instances and logs actual paths captured by hooks
 * to help debug pattern matching tests
 */

import { getMatrixConfigs, TEST_DIRS } from "./vitest-helper.mjs";
import slothlet from "@cldmv/slothlet";

/**
 * Run hook-path debugging across the full hook-enabled test matrix.
 */
async function debugHookPaths() {
	console.log("=== DEBUGGING HOOK PATHS ===\n");

	// Use the full hook-enabled matrix (all combinations with hooks=true)
	const configs = getMatrixConfigs({ hooks: true });
	console.log(`Testing ${configs.length} configs`);

	for (const config of configs) {
		console.log(`\n--- Testing ${config.name} (${config.config.mode}) ---`);

		const api = await slothlet({ ...config.config, dir: TEST_DIRS.API_TEST });

		const capturedPaths = [];

		// Register a hook to capture all paths with detailed debugging
		api.hooks.on(
			"before",
			({ path }) => {
				const pathType = typeof path;
				const pathValue = pathType === "function" ? path.toString() : path;

				capturedPaths.push({
					value: path,
					type: pathType,
					stringified: pathValue
				});

				console.log(`🎯 Hook fired:`);
				console.log(`  - Path: ${pathValue}`);
				console.log(`  - Type: ${pathType}`);

				if (pathType === "function") {
					console.log(`  - Function name: ${path.name}`);
					console.log(`  - Function toString: ${path.toString()}`);
					console.log(`  - Function constructor: ${path.constructor.name}`);
					console.log(`  - Is native function: ${path.toString().includes("[native code]")}`);
					console.log(`  - Function prototype: ${path.prototype}`);
					console.log(`  - Function length: ${path.length}`);
					console.log(`  - Is proxy: ${typeof path === "function" && path.toString() === "function () { [native code] }" && path.name}`);
					console.log(`  - Stack trace:`);
					console.trace();
				}
			},
			{ pattern: "**" }
		);

		console.log("\nCalling api.advanced.selfObject.addViaSelf(2, 3):");
		try {
			await api.advanced.selfObject.addViaSelf(2, 3);
		} catch (error) {
			console.log(`❌ Error: ${error.message}`);
		}

		console.log("\nCalling api.math.add(2, 3):");
		try {
			await api.math.add(2, 3);
		} catch (error) {
			console.log(`❌ Error: ${error.message}`);
		}

		console.log("\nCalling api.string.upper('test'):");
		try {
			await api.string.upper("test");
		} catch (error) {
			console.log(`❌ Error: ${error.message}`);
		}

		console.log(`\nAll captured paths for ${config.name}:`);
		capturedPaths.forEach((pathInfo, i) => {
			console.log(`  ${i + 1}. "${pathInfo.stringified}" (${pathInfo.type})`);
		});

		const stringPaths = capturedPaths.filter((p) => p.type === "string");
		const functionPaths = capturedPaths.filter((p) => p.type === "function");

		console.log(`\nPath Analysis:`);
		console.log(`  - String paths: ${stringPaths.length}/${capturedPaths.length}`);
		console.log(`  - Function paths: ${functionPaths.length}/${capturedPaths.length}`);
		console.log(`  - Advanced paths: ${stringPaths.filter((p) => p.stringified.startsWith("advanced.")).length}`);

		await api.shutdown();
		console.log("--- End ---\n");
	}
}

debugHookPaths().catch(console.error);
