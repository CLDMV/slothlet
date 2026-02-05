/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tools/build-with-tests.mjs
 *	@Date: 2025-09-09T08:06:19-07:00 (1757430379)
 *	@Author: Nate Hyson <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Hyson <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-02-04 20:39:39 -08:00 (1770266379)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Test-first build script for slothlet.
 * @module @cldmv/slothlet/tools/build-with-tests
 * @package
 * @description
 * Implements a test-first build pipeline that:
 * 1. Runs all tests (vitest + node tests)
 * 2. Only proceeds with build if ALL tests pass
 * 3. Runs the complete build pipeline
 * 4. Fails immediately if any step fails
 *
 * This ensures we never build with failing tests and provides
 * fast feedback for development workflow.
 *
 * @example
 * // Run test-first build
 * npm run build
 *
 * @example
 * // Run directly
 * node tools/build-with-tests.mjs
 */

import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

/**
 * Run a command and wait for completion.
 * @internal
 * @private
 * @param {string} command - Command to run
 * @param {string[]} args - Command arguments
 * @param {string} description - Description for logging
 * @returns {Promise<boolean>} True if command succeeded
 */
async function runCommand(command, args, description, extraEnv = {}) {
	console.log(`🔄 ${description}...`);

	return new Promise((resolve) => {
		const child = spawn(command, args, {
			cwd: projectRoot,
			stdio: "inherit",
			shell: true,
			env: { ...process.env, ...extraEnv }
		});

		child.on("close", (code) => {
			if (code === 0) {
				console.log(`✅ ${description} completed successfully`);
				resolve(true);
			} else {
				console.error(`❌ ${description} failed with exit code ${code}`);
				resolve(false);
			}
		});

		child.on("error", (error) => {
			console.error(`❌ ${description} failed:`, error.message);
			resolve(false);
		});
	});
}

/**
 * Main build function with test-first approach.
 * @package
 * @async
 * @returns {Promise<void>}
 */
async function buildWithTests() {
	console.log("🚀 Starting Test-First Build Pipeline");
	console.log("=".repeat(50));
	const devEnv = { NODE_ENV: "development", NODE_OPTIONS: "--conditions=slothlet-dev" };

	try {
		// Step 1: Run vitest tests
		console.log("📋 Phase 1a: Running Vitest Tests");
		console.log("-".repeat(30));

		const vitestSuccess = await runCommand("npm", ["run", "test:unit"], "Vitest Tests", devEnv);

		if (!vitestSuccess) {
			console.error("\n💥 BUILD ABORTED: Vitest tests failed!");
			console.error("Fix failing vitest tests before building.");
			process.exit(1);
		}

		// Step 2: Run node tests
		console.log("\n📋 Phase 1b: Running Node Tests");
		console.log("-".repeat(30));

		const nodeTestsSuccess = await runCommand("npm", ["run", "test:node"], "Node Tests", devEnv);
		if (!nodeTestsSuccess) {
			console.error("\n💥 BUILD ABORTED: Node tests failed!");
			console.error("Fix failing node tests before building.");
			process.exit(1);
		}

		console.log("\n🎉 All tests passed! Proceeding with build...\n");

		// Step 3: Build pipeline
		console.log("📋 Phase 2: Build Pipeline");
		console.log("-".repeat(30));

		const buildSteps = [
			{ command: "npm", args: ["run", "build:cleanup"], desc: "Cleanup" },
			{ command: "npm", args: ["run", "build:dist"], desc: "Build Distribution" },
			{ command: "npm", args: ["run", "build:types"], desc: "Generate Types" },
			{ command: "npm", args: ["run", "build:exports"], desc: "Build Exports" },
			{ command: "npm", args: ["run", "test:types"], desc: "Validate Types" },
			{ command: "npm", args: ["run", "build:prepend-license"], desc: "Prepend License" }
		];

		for (const step of buildSteps) {
			const success = await runCommand(step.command, step.args, step.desc);
			if (!success) {
				console.error(`\n💥 BUILD FAILED at step: ${step.desc}`);
				process.exit(1);
			}
		}

		console.log("\n🎉 BUILD COMPLETED SUCCESSFULLY!");
		console.log("=".repeat(50));
		console.log("✅ All tests passed");
		console.log("✅ Distribution built");
		console.log("✅ Types generated and validated");
		console.log("✅ Exports configured");
		console.log("✅ License headers added");
		console.log("\n📦 Package ready for publishing!");
	} catch (error) {
		console.error("💥 Build pipeline failed:", error.message);
		process.exit(1);
	}
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1].endsWith("build-with-tests.mjs")) {
	buildWithTests();
}

export { buildWithTests };
