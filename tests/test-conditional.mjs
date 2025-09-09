#!/usr/bin/env node

/**
 * @fileoverview Conditional test runner that skips Vitest on Node.js < 18
 * @module scripts/test-conditional
 */

import { execSync } from "child_process";

/**
 * Get the current Node.js major version
 * @returns {number} Major version number
 */
function getNodeMajorVersion() {
	return parseInt(process.version.slice(1).split(".")[0], 10);
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
			execSync("npm run test:unit", { stdio: "inherit" });
		} else {
			console.log("⚠️  Node.js < 18: Skipping Vitest tests due to compatibility issues");
			console.log("   (Vitest requires Node.js >= 18 for proper operation)");
		}

		// Always run the Node.js native tests
		console.log("🚀 Running Node.js native tests");
		execSync("npm run test:node", { stdio: "inherit" });

		console.log("✅ All compatible tests completed successfully");
	} catch (error) {
		console.error("❌ Tests failed:", error.message);
		process.exit(1);
	}
}

// Run if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
	runConditionalTests();
}

export { runConditionalTests, getNodeMajorVersion };
