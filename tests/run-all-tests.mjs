#!/usr/bin/env node

/**
 * @fileoverview Comprehensive test runner for all slothlet test files.
 * @module @cldmv/slothlet/tests/run-all-tests
 * @package
 * @internal
 * @description
 * Runs all test files in the tests/ directory and reports results.
 * Supports both .mjs and .cjs test files and aggregates results.
 * If any test fails, the script exits with code 1 to fail the build.
 *
 * Key features:
 * - Discovers all test files automatically
 * - Runs tests in sequence to avoid conflicts
 * - Captures output and exit codes
 * - Provides summary report
 * - Fails fast or continues based on configuration
 *
 * Technical implementation:
 * - Uses child_process.spawn to run test files
 * - Captures stdout/stderr for reporting
 * - Tracks test timing and results
 * - Excludes utility files and specific patterns
 *
 * @example
 * // Run all tests
 * npm run test:all
 *
 * @example
 * // Run directly
 * node tests/run-all-tests.mjs
 */

import { spawn } from "node:child_process";
import { readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const testsDir = __dirname;

/**
 * Run a single test file and capture its output.
 * @internal
 * @private
 * @param {string} testFile - Path to the test file
 * @returns {Promise<{success: boolean, output: string, duration: number}>} Test result
 */
async function runSingleTest(testFile) {
	return new Promise((resolve) => {
		const startTime = Date.now();
		const child = spawn("node", [testFile], {
			cwd: path.dirname(testsDir),
			stdio: ["ignore", "pipe", "pipe"]
		});
		let output = "";
		let errorOutput = "";

		child.stdout?.on("data", (data) => {
			output += data.toString();
		});

		child.stderr?.on("data", (data) => {
			errorOutput += data.toString();
		});

		child.on("close", (code) => {
			const duration = Date.now() - startTime;
			const success = code === 0;
			const fullOutput = output + (errorOutput ? `\nSTDERR:\n${errorOutput}` : "");

			resolve({
				success,
				output: fullOutput,
				duration,
				exitCode: code
			});
		});

		child.on("error", (error) => {
			const duration = Date.now() - startTime;
			resolve({
				success: false,
				output: `Failed to start test: ${error.message}`,
				duration,
				exitCode: -1
			});
		});
	});
}

/**
 * Main test runner function.
 * @package
 * @async
 * @returns {Promise<void>}
 * @throws {Error} When tests fail and process should exit with code 1
 */
async function runAllTests() {
	console.log("🧪 Running All Slothlet Tests");
	console.log("=".repeat(50));

	try {
		// Discover test files
		const files = await readdir(testsDir);

		// Utility files that should NOT be run as standalone tests
		const excludeExactFiles = [
			"test-utils.mjs",
			"test-helper.mjs",
			"run-all-tests.mjs",
			"test-conditional.mjs",
			"dump-full-api.mjs",
			"validate-typescript.mjs"
		];

		// Pattern-based exclusions
		const excludePatterns = [
			/^debug-/, // Debug tools
			/performance-benchmark/, // Performance tests (run separately)
			/\.vest\.mjs$/ // Vitest files (handled by npm test)
		];

		const testFiles = files
			.filter((file) => file.endsWith(".mjs") || file.endsWith(".cjs"))
			.filter((file) => !excludeExactFiles.includes(file))
			.filter((file) => !excludePatterns.some((pattern) => pattern.test(file)))
			.sort();
		if (testFiles.length === 0) {
			console.log("⚠️  No test files found");
			return;
		}

		console.log(`Found ${testFiles.length} test files:`);
		testFiles.forEach((file) => console.log(`  📄 ${file}`));
		console.log("");

		const results = [];
		let totalDuration = 0;

		// Run tests sequentially
		for (const file of testFiles) {
			const filePath = path.join(testsDir, file);
			console.log(`🔄 Running ${file}...`);

			const result = await runSingleTest(filePath);
			results.push({ file, ...result });
			totalDuration += result.duration;
			if (result.success) {
				console.log(`✅ ${file} passed (${result.duration}ms)`);
			} else {
				console.log(`❌ ${file} failed (${result.duration}ms) - Exit code: ${result.exitCode}`);
				// Show last 20 lines of output for debugging
				const lines = result.output.split("\n");
				const totalLines = lines.length;
				const lastLines = lines.slice(-20);
				if (totalLines > 20) {
					console.log(`   ... (${totalLines - 20} lines omitted, showing last 20 lines)`);
				}
				lastLines.forEach((line) => console.log(`   ${line}`));
			}
			console.log("");
		}

		// Summary
		console.log("📊 Test Results Summary");
		console.log("=".repeat(50));

		const passed = results.filter((r) => r.success).length;
		const failed = results.filter((r) => !r.success).length;

		console.log(`✅ Passed: ${passed}`);
		console.log(`❌ Failed: ${failed}`);
		console.log(`⏱️  Total Duration: ${totalDuration}ms`);
		console.log("");

		if (failed > 0) {
			console.log("❌ Failed Tests:");
			results
				.filter((r) => !r.success)
				.forEach((r) => {
					console.log(`   ${r.file} (exit code: ${r.exitCode})`);
				});
			console.log("");
			console.log("💡 Run individual tests for detailed output:");
			results
				.filter((r) => !r.success)
				.forEach((r) => {
					console.log(`   node tests/${r.file}`);
				});

			process.exit(1);
		}

		console.log("🎉 All tests passed!");
	} catch (error) {
		console.error("❌ Test runner failed:", error.message);
		process.exit(1);
	}
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1].endsWith("run-all-tests.mjs")) {
	runAllTests();
}

export { runAllTests };
