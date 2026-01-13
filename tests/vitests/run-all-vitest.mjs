/**
 * @fileoverview Run all Vitest test files sequentially and provide comprehensive report
 * @module tests/vitests/run-all-vitest
 * @internal
 *
 * @description
 * Runs each Vitest test file separately to avoid OOM issues, collecting results
 * and providing a final summary report similar to Vitest's native output.
 * Captures test counts, timing, heap usage, and error details.
 *
 * @example
 * // Run all test files in suites/ directory
 * node tests/vitests/run-all-vitest.mjs
 *
 * @example
 * // Run specific test file
 * node tests/vitests/run-all-vitest.mjs tests/vitests/suites/addapi/addapi-path-resolution.test.vitest.mjs
 *
 * @example
 * // Run all tests in a folder
 * node tests/vitests/run-all-vitest.mjs tests/vitests/suites/addapi
 *
 * @example
 * // Run multiple folders
 * node tests/vitests/run-all-vitest.mjs tests/vitests/suites/addapi tests/vitests/suites/context
 *
 * @example
 * // With custom heap limit
 * VITEST_HEAP_MB=8192 node tests/vitests/run-all-vitest.mjs tests/vitests/suites/smart-flattening
 */

import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import chalk from "chalk";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..", "..");
const vitestEntrypoint = path.resolve(projectRoot, "node_modules", "vitest", "vitest.mjs");
const vitestConfigPath = path.join(".configs", "vitest.config.mjs");

// Configuration
const WORKER_COUNT = process.env.VITEST_WORKERS ? parseInt(process.env.VITEST_WORKERS, 10) : 4;

/**
 * Discover all Vitest test files in a directory
 * @param {string} dir - Directory to search
 * @returns {Promise<string[]>} Array of test file paths relative to project root
 */
async function discoverFilesInDir(dir) {
	const queue = [dir];
	const files = [];

	while (queue.length) {
		const current = queue.pop();
		let entries;
		try {
			entries = await fs.readdir(current, { withFileTypes: true });
		} catch (___error) {
			continue;
		}

		for (const entry of entries) {
			if (entry.isDirectory()) {
				if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
				queue.push(path.join(current, entry.name));
				continue;
			}

			if (!entry.isFile()) continue;
			const name = entry.name;
			if (/\.test\.vitest\.(?:js|mjs)$/i.test(name)) {
				const rel = path.relative(projectRoot, path.join(current, name));
				files.push(rel);
			}
		}
	}

	return files;
}

/**
 * Discover Vitest test files based on CLI arguments or default to all processed/ files
 * @param {string[]} args - Command-line arguments (file paths, folder paths, or empty for all)
 * @returns {Promise<string[]>} Array of test file paths relative to project root
 */
async function discoverVitestFiles(args) {
	// If no arguments provided, run all files in suites/
	if (args.length === 0) {
		const suitesDir = path.resolve(__dirname, "suites");
		const files = await discoverFilesInDir(suitesDir);
		return files.sort((a, b) => a.localeCompare(b));
	}

	const files = [];

	for (const arg of args) {
		const absPath = path.isAbsolute(arg) ? arg : path.resolve(projectRoot, arg);

		try {
			const stat = await fs.stat(absPath);

			if (stat.isFile()) {
				// Single test file specified
				if (/\.test\.vitest\.(?:js|mjs)$/i.test(absPath)) {
					const rel = path.relative(projectRoot, absPath);
					files.push(rel);
				}
			} else if (stat.isDirectory()) {
				// Directory specified - discover all test files in it
				const dirFiles = await discoverFilesInDir(absPath);
				files.push(...dirFiles);
			}
		} catch (___error) {
			console.warn(`⚠️  Could not access: ${arg}`);
			continue;
		}
	}

	return files.sort((a, b) => a.localeCompare(b));
}

/**
 * Strip ANSI color codes from text
 * @param {string} text - Text with ANSI codes
 * @returns {string} Clean text
 */
function stripAnsi(text) {
	// eslint-disable-next-line no-control-regex
	return text.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, "");
}

/**
 * Parse Vitest output to extract test results
 * @param {string} output - Raw Vitest output
 * @returns {Object} Parsed test results
 */
function parseVitestOutput(output) {
	// Strip ANSI codes for easier parsing
	const cleanOutput = stripAnsi(output);

	const result = {
		testFilesPass: 0,
		testFilesFail: 0,
		testsPass: 0,
		testsFail: 0,
		testsSkip: 0,
		duration: 0,
		heapMb: null,
		errors: []
	};

	// Extract test counts - match lines exactly as Vitest formats them
	// "Test Files  1 passed (1)" or "Test Files  1 failed (1)" or "Test Files  1 passed | 2 failed (3)"
	const testFilesLineMatch = cleanOutput.match(/Test Files\s+(.+)/);
	if (testFilesLineMatch) {
		const line = testFilesLineMatch[1];
		const passMatch = line.match(/(\d+)\s+passed/);
		const failMatch = line.match(/(\d+)\s+failed/);
		if (passMatch) result.testFilesPass = parseInt(passMatch[1], 10);
		if (failMatch) result.testFilesFail = parseInt(failMatch[1], 10);
	}

	// "Tests  82 passed (82)" or "Tests  2 failed | 4 passed (6)" or "Tests  2 skipped | 4 passed (6)"
	// Note: Use looser whitespace matching since Vitest may use multiple spaces
	const testsLineMatch = cleanOutput.match(/^\s*Tests\s+(.+)$/m);
	if (testsLineMatch) {
		const line = testsLineMatch[1];
		const passMatch = line.match(/(\d+)\s+passed/);
		const failMatch = line.match(/(\d+)\s+failed/);
		const skipMatch = line.match(/(\d+)\s+skipped/);
		if (passMatch) result.testsPass = parseInt(passMatch[1], 10);
		if (failMatch) result.testsFail = parseInt(failMatch[1], 10);
		if (skipMatch) result.testsSkip = parseInt(skipMatch[1], 10);
	}

	// Extract duration from "Duration  Xs"
	const durationMatch = cleanOutput.match(/Duration\s+([\d.]+)s/);
	if (durationMatch) {
		result.duration = parseFloat(durationMatch[1]) * 1000; // Convert to ms
	}

	// Extract heap usage - multiple possible formats
	const heapMatch = cleanOutput.match(/(\d+)\s*MB\s+heap\s+used/i);
	if (heapMatch) {
		result.heapMb = parseInt(heapMatch[1], 10);
	}

	// Extract error details - capture full error blocks from original output (with ANSI codes)
	// Look for "Failed Tests" section - simpler pattern matching
	const failedSectionStart = output.indexOf("Failed Tests");
	if (failedSectionStart !== -1) {
		// Find where the error section ends (at "Test Files" line or end of output)
		const failedSectionEnd = output.indexOf("\n Test Files", failedSectionStart);
		const errorSection =
			failedSectionEnd !== -1 ? output.substring(failedSectionStart, failedSectionEnd) : output.substring(failedSectionStart);

		// Split by FAIL lines - account for ANSI codes between "FAIL" and "tests"
		// Pattern: FAIL (with possible ANSI codes and spaces) tests/
		// eslint-disable-next-line no-control-regex
		const failPattern = /FAIL\s*(?:\x1B\[[0-9;]*[a-zA-Z]|\s)*tests\//g;
		const matches = [...errorSection.matchAll(failPattern)];

		if (matches.length > 0) {
			// Process each FAIL block - find the start of the line containing FAIL
			for (let i = 0; i < matches.length; i++) {
				// Back up to find the newline before FAIL
				const matchPos = matches[i].index;
				const lineStart = errorSection.lastIndexOf("\n", matchPos);
				const actualStart = lineStart === -1 ? 0 : lineStart;

				const matchEnd = i < matches.length - 1 ? matches[i + 1].index : errorSection.length;
				const nextLineStart = errorSection.lastIndexOf("\n", matchEnd);
				const actualEnd = nextLineStart === -1 ? matchEnd : nextLineStart;

				const errorBlock = errorSection.substring(actualStart, actualEnd).trim();
				if (errorBlock) {
					result.errors.push(errorBlock);
				}
			}
		}
	}

	return result;
}

/**
 * Run a single test file with Vitest
 * @param {string} filePath - Test file path relative to project root
 * @param {number | undefined} maxOldSpaceMb - Optional heap size limit
 * @returns {Promise<Object>} Test results
 */
async function runSingleFile(filePath, maxOldSpaceMb) {
	return new Promise((resolve) => {
		const startTime = Date.now();
		const args = [vitestEntrypoint, "--config", vitestConfigPath, "run", filePath];

		const baseEnv = { ...process.env };
		if (!baseEnv.NODE_ENV) baseEnv.NODE_ENV = "development";
		const hasDevCondition = baseEnv.NODE_OPTIONS?.includes("--conditions=development");
		if (!hasDevCondition) {
			const existing = baseEnv.NODE_OPTIONS ? `${baseEnv.NODE_OPTIONS} ` : "";
			baseEnv.NODE_OPTIONS = `${existing}--conditions=development`.trim();
		}
		if (maxOldSpaceMb && !baseEnv.NODE_OPTIONS?.includes("--max-old-space-size")) {
			const existing = baseEnv.NODE_OPTIONS ? `${baseEnv.NODE_OPTIONS} ` : "";
			baseEnv.NODE_OPTIONS = `${existing}--max-old-space-size=${maxOldSpaceMb}`.trim();
		}

		const child = spawn(process.execPath, args, {
			cwd: projectRoot,
			stdio: ["ignore", "pipe", "pipe"],
			env: baseEnv
		});

		let stdout = "";
		let stderr = "";

		child.stdout?.on("data", (data) => {
			const text = data.toString();
			stdout += text;
			process.stdout.write(data); // Stream output to console
		});

		child.stderr?.on("data", (data) => {
			const text = data.toString();
			stderr += text;
			process.stderr.write(data); // Stream output to console
		});

		child.on("close", (code) => {
			const spawnDuration = Date.now() - startTime;
			const output = stdout + "\n" + stderr;
			const parsed = parseVitestOutput(output);

			resolve({
				file: filePath,
				code: code ?? 1,
				// Use Vitest's reported duration if available, otherwise use spawn duration
				duration: parsed.duration > 0 ? parsed.duration : spawnDuration,
				testFilesPass: parsed.testFilesPass,
				testFilesFail: parsed.testFilesFail,
				testsPass: parsed.testsPass,
				testsFail: parsed.testsFail,
				testsSkip: parsed.testsSkip || 0,
				heapMb: parsed.heapMb,
				errors: parsed.errors,
				rawOutput: output
			});
		});

		child.on("error", (err) => {
			const spawnDuration = Date.now() - startTime;
			resolve({
				file: filePath,
				code: 1,
				duration: spawnDuration,
				testFilesPass: 0,
				testFilesFail: 1,
				testsPass: 0,
				testsFail: 0,
				heapMb: null,
				errors: [err.message],
				rawOutput: err.toString()
			});
		});
	});
}

/**
 * Main runner: executes all test files and provides final report
 */
async function runAllFiles() {
	// Parse CLI arguments - everything after script name
	const args = process.argv.slice(2);

	const testFiles = await discoverVitestFiles(args);
	if (testFiles.length === 0) {
		if (args.length > 0) {
			console.log(`❌ No Vitest test files found matching: ${args.join(", ")}`);
		} else {
			console.log("❌ No Vitest test files found in tests/vitests/suites/");
		}
		return;
	}

	const maxOldSpaceMb = process.env.VITEST_HEAP_MB ? parseInt(process.env.VITEST_HEAP_MB, 10) : undefined;
	const results = [];
	const scriptStartTime = Date.now();
	const scriptStartTimeFormatted = new Date().toLocaleTimeString("en-US", { hour12: false });

	if (args.length > 0) {
		console.log(`\n🧪 Running ${testFiles.length} test files matching: ${args.join(", ")}`);
	} else {
		console.log(`\n🧪 Running ${testFiles.length} test files in parallel`);
	}
	console.log(`⚙️  Workers: ${WORKER_COUNT}`);
	if (maxOldSpaceMb) {
		console.log(`🧠 Heap limit: ${maxOldSpaceMb} MB`);
	}
	console.log(""); // Blank line

	// Run tests with proper worker pool - start new work when slots open
	const runTestFile = async (filePath) => {
		console.log(`\n${"=".repeat(80)}`);
		console.log(`▶️  ${filePath}`);
		console.log("=".repeat(80));

		const result = await runSingleFile(filePath, maxOldSpaceMb);

		if (result.code === 0) {
			const durationSec = (result.duration / 1000).toFixed(2);
			const heapInfo = result.heapMb ? ` | ${result.heapMb} MB heap` : "";
			console.log(`\n✅ PASSED (${durationSec}s${heapInfo})\n`);
		} else {
			const durationSec = (result.duration / 1000).toFixed(2);
			console.log(`\n❌ FAILED (exit code ${result.code}, ${durationSec}s)\n`);
		}

		return result;
	};

	// Worker pool: Run up to WORKER_COUNT tests concurrently, start new one when slot opens
	let index = 0;
	const activePromises = new Set();

	while (index < testFiles.length || activePromises.size > 0) {
		// Fill worker slots
		while (index < testFiles.length && activePromises.size < WORKER_COUNT) {
			const filePath = testFiles[index];
			index++;

			const promise = runTestFile(filePath)
				.then((result) => {
					results.push(result);
					activePromises.delete(promise);
				})
				.catch((err) => {
					console.error(`Error running ${filePath}:`, err);
					activePromises.delete(promise);
				});

			activePromises.add(promise);
		}

		// Wait for at least one to complete before continuing
		if (activePromises.size > 0) {
			await Promise.race(activePromises);
		}
	}

	// Aggregate results
	const totalTestFilesPass = results.reduce((sum, r) => sum + r.testFilesPass, 0);
	const totalTestFilesFail = results.reduce((sum, r) => sum + r.testFilesFail, 0);
	const totalTestsPass = results.reduce((sum, r) => sum + r.testsPass, 0);
	const totalTestsFail = results.reduce((sum, r) => sum + r.testsFail, 0);
	const totalTestsSkip = results.reduce((sum, r) => sum + (r.testsSkip || 0), 0);
	const totalDuration = results.reduce((sum, r) => sum + r.duration, 0); // Sum of individual test durations
	const failedFiles = results.filter((r) => r.code !== 0);
	const passedFiles = results.filter((r) => r.code === 0);

	// Print report sections
	console.log("\n" + "=".repeat(80));

	// Top memory users
	const withHeap = results.filter((r) => r.heapMb !== null);
	if (withHeap.length > 0) {
		console.log("\n" + chalk.bold("🧠 TOP MEMORY USERS"));
		console.log("-".repeat(80));

		withHeap
			.sort((a, b) => (b.heapMb || 0) - (a.heapMb || 0))
			.slice(0, 10)
			.forEach((r) => {
				console.log(`  ${r.heapMb.toString().padStart(4)} MB  ${chalk.dim(r.file)}`);
			});
	}

	// Passed test files summary
	if (passedFiles.length > 0) {
		console.log("\n" + "=".repeat(80));
		console.log(chalk.bold.green("✓ PASSED TEST FILES"));
		console.log("=".repeat(80));

		passedFiles.forEach((result) => {
			const heapInfo = result.heapMb ? chalk.dim(` (${result.heapMb} MB)`) : "";
			const testInfo = result.testsPass > 0 ? ` - ${result.testsPass} tests` : "";
			console.log(chalk.green(`✓ ${result.file}${testInfo}${heapInfo}`));
		});
	}

	// Failed test files with detailed errors
	if (failedFiles.length > 0) {
		console.log("\n" + "=".repeat(80));
		console.log(chalk.bold.red("✖ FAILED TEST FILES"));
		console.log("=".repeat(80));

		failedFiles.forEach((result) => {
			console.log(`\n${chalk.red("✖")} ${chalk.red(result.file)}`);
			const durationSec = (result.duration / 1000).toFixed(2);
			console.log(chalk.dim(`   Duration: ${durationSec}s | Exit code: ${result.code}`));

			if (result.testsFail > 0) {
				console.log(chalk.dim(`   Failed tests: ${result.testsFail}/${result.testsPass + result.testsFail}`));
			}

			if (result.errors.length > 0) {
				console.log("\n" + chalk.bold.red("━".repeat(23) + " Failed Tests " + result.errors.length + " " + "━".repeat(23)));
				result.errors.forEach((error) => {
					// Output the error with original formatting preserved (includes ANSI codes)
					console.log(error);
				});
			}
		});
	}

	// Final summary (Vitest-style)
	console.log("\n" + chalk.bold("=".repeat(80)));

	// Test Files Summary (failed first, like Vitest)
	if (totalTestFilesFail > 0 && totalTestFilesPass > 0) {
		console.log(
			` ${chalk.bold("Test Files")}  ${chalk.red(`${totalTestFilesFail} failed`)} ${chalk.dim("|")} ${chalk.green(`${totalTestFilesPass} passed`)} ${chalk.dim(`(${totalTestFilesPass + totalTestFilesFail})`)}`
		);
	} else if (totalTestFilesFail > 0) {
		console.log(` ${chalk.bold("Test Files")}  ${chalk.red(`${totalTestFilesFail} failed`)} ${chalk.dim(`(${totalTestFilesFail})`)}`);
	} else {
		console.log(` ${chalk.bold("Test Files")}  ${chalk.green(`${totalTestFilesPass} passed`)} ${chalk.dim(`(${totalTestFilesPass})`)}`);
	}

	// Tests Summary (failed first, like Vitest)
	const totalTests = totalTestsPass + totalTestsFail + totalTestsSkip;
	const testsParts = [];
	if (totalTestsFail > 0) testsParts.push(chalk.red(`${totalTestsFail} failed`));
	if (totalTestsPass > 0) testsParts.push(chalk.green(`${totalTestsPass} passed`));
	if (totalTestsSkip > 0) testsParts.push(chalk.yellow(`${totalTestsSkip} skipped`));
	const testsLine = testsParts.join(` ${chalk.dim("|")} `);
	console.log(`      ${chalk.bold("Tests")}  ${testsLine} ${chalk.dim(`(${totalTests})`)}`);

	// Start time (Vitest format)
	console.log(`   ${chalk.bold("Start at")}  ${scriptStartTimeFormatted}`);

	// Duration - show both actual wall-clock time and sum of test durations
	const scriptEndTime = Date.now();
	const actualDuration = scriptEndTime - scriptStartTime;
	const actualDurationSec = (actualDuration / 1000).toFixed(2);
	const testsDurationSec = (totalDuration / 1000).toFixed(2);
	console.log(`   ${chalk.bold("Duration")}  ${actualDurationSec}s ${chalk.dim(`(tests ${testsDurationSec}s)`)}`);

	// Heap usage stats (script's own memory usage)
	const scriptMemory = process.memoryUsage();
	const scriptHeapMb = Math.round(scriptMemory.heapUsed / 1024 / 1024);
	const scriptRssMb = Math.round(scriptMemory.rss / 1024 / 1024);
	if (withHeap.length > 0) {
		const maxHeap = Math.max(...withHeap.map((r) => r.heapMb));
		const avgHeap = (withHeap.reduce((sum, r) => sum + r.heapMb, 0) / withHeap.length).toFixed(0);
		console.log(`       ${chalk.bold("Heap")}  max ${maxHeap} MB | avg ${avgHeap} MB | script ${scriptHeapMb} MB (RSS ${scriptRssMb} MB)`);
	} else {
		console.log(`       ${chalk.bold("Heap")}  script ${scriptHeapMb} MB (RSS ${scriptRssMb} MB)`);
	}

	console.log(chalk.bold("=".repeat(80)));

	// Exit with appropriate code
	if (failedFiles.length > 0) {
		console.log(`\n❌ ${failedFiles.length} test file(s) failed\n`);
		process.exit(1);
	} else {
		console.log(`\n✅ All ${passedFiles.length} test files passed\n`);
		process.exit(0);
	}
}

runAllFiles().catch((err) => {
	console.error("Fatal error:", err);
	process.exit(1);
});
