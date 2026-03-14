/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/test-conditional.mjs
 *	@Date: 2025-09-09T08:06:19-07:00 (1757430379)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-01 20:21:40 -08:00 (1772425300)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Conditional test runner that skips Vitest on Node.js < 18
 * @module scripts/test-conditional
 */

import { execSync } from "child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Get the current Node.js major version
 * @returns {number} Major version number
 */
function getNodeMajorVersion() {
	return parseInt(process.version.slice(1).split(".")[0], 10);
}

/**
 * Build an environment object safe for running test:node.
 * When src/ has been deleted (post-build), strips the slothlet-dev
 * condition from NODE_OPTIONS so that imports resolve to dist/ instead.
 * @returns {NodeJS.ProcessEnv} Environment object to pass to execSync.
 */
function buildTestNodeEnv() {
	const srcExists = existsSync(path.resolve(__dirname, "../src/slothlet.mjs"));
	if (srcExists) {
		// Pre-build: inherit everything as-is
		return process.env;
	}

	// Post-build: src/ was removed by ci-cleanup-src — strip slothlet-dev
	// from NODE_OPTIONS so package exports resolve to dist/ correctly.
	console.log("ℹ️  src/ not found — running test:node against dist/ (stripping slothlet-dev condition)");
	const cleaned = (process.env.NODE_OPTIONS ?? "")
		.split(/\s+/)
		.filter((token) => token !== "--conditions=slothlet-dev" && token !== "")
		.join(" ");

	return {
		...process.env,
		NODE_OPTIONS: cleaned || undefined
	};
}

/**
 * Run tests conditionally based on Node.js version
 * @async
 * @returns {Promise<void>}
 */
async function runConditionalTests() {
	const nodeMajorVersion = getNodeMajorVersion();

	console.log(`Running tests on Node.js ${process.version} (major: ${nodeMajorVersion})`);

	try {
		if (nodeMajorVersion >= 18) {
			console.log("✅ Node.js >= 18: Running full test suite including Vitest");
			execSync("npm run vitest", { stdio: "inherit" });
		} else {
			console.log("⚠️  Node.js < 18: Skipping Vitest tests due to compatibility issues");
			console.log("   (Vitest requires Node.js >= 18 for proper operation)");
		}

		// Always run the Node.js native tests
		console.log("🚀 Running Node.js native tests");
		execSync("npm run test:node", { stdio: "inherit", env: buildTestNodeEnv() });

		console.log("✅ All compatible tests completed successfully");
	} catch (error) {
		console.error("❌ Tests failed:", error.message);
		process.exit(1);
	}
}

// Run if this script is executed directly
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	runConditionalTests();
}

export { runConditionalTests, getNodeMajorVersion };
