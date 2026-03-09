/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/setup/debug-hook-paths.mjs
 *	@Date: 2026-01-11T19:07:25-08:00 (1768187245)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-01 20:21:40 -08:00 (1772425300)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

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
	// console.log("=== DEBUGGING HOOK PATHS ===\n");

	// Use the full hook-enabled matrix (all combinations with hook.enabled=true)
	const configs = getMatrixConfigs({ hook: { enabled: true } });
	// console.log(`Testing ${configs.length} configs`);

	for (const config of configs) {
		// console.log(`\n--- Testing ${config.name} (${config.config.mode}) ---`);

		const api = await slothlet({ ...config.config, dir: TEST_DIRS.API_TEST });

		const capturedPaths = [];

		// Register a hook to capture all paths with detailed debugging
		// typePattern format: "type:globPattern" (e.g. "before:**")
		api.slothlet.hook.on("before:**", ({ apiPath }) => {
			const pathType = typeof apiPath;
			const pathValue = pathType === "function" ? apiPath.toString() : apiPath;

			capturedPaths.push({
				value: apiPath,
				type: pathType,
				stringified: pathValue
			});

			// console.log(`🎯 Hook fired:`);
			// console.log(`  - Path: ${pathValue}`);
			// console.log(`  - Type: ${pathType}`);
		});

		// console.log("\nCalling api.advanced.selfObject.addViaSelf(2, 3):");
		try {
			await api.advanced.selfObject.addViaSelf(2, 3);
		} catch (____error) {
			// console.log(`❌ Error: ${____error.message}`);
		}

		// console.log("\nCalling api.math.add(2, 3):");
		try {
			await api.math.add(2, 3);
		} catch (____error) {
			// console.log(`❌ Error: ${____error.message}`);
		}

		// console.log("\nCalling api.string.upper('test'):");
		try {
			await api.string.upper("test");
		} catch (____error) {
			// console.log(`❌ Error: ${____error.message}`);
		}

		// console.log(`\nAll captured paths for ${config.name}:`);
		capturedPaths.forEach((____pathInfo, ____i) => {
			// console.log(`  ${i + 1}. "${pathInfo.stringified}" (${pathInfo.type})`);
		});

		const ____stringPaths = capturedPaths.filter((p) => p.type === "string");
		const ____functionPaths = capturedPaths.filter((p) => p.type === "function");

		// console.log(`\nPath Analysis:`);
		// console.log(`  - String paths: ${stringPaths.length}/${capturedPaths.length}`);
		// console.log(`  - Function paths: ${functionPaths.length}/${capturedPaths.length}`);
		// console.log(`  - Advanced paths: ${stringPaths.filter((p) => p.stringified.startsWith("advanced.")).length}`);

		await api.shutdown();
		// console.log("--- End ---\n");
	}
}

debugHookPaths().catch(console.error);
