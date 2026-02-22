/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/run-all-vitest.mjs
 *	@Date: 2026-01-12T23:44:38-08:00 (1768290278)
 *	@Author: Nate Hyson <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Hyson <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-02-21 21:38:39 -08:00 (1771738719)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

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
 * Supports passing through all standard Vitest CLI arguments while maintaining
 * special flags like --baseline. Acts as middleware to run tests sequentially
 * and avoid OOM issues in massive test suites.
 *
 * @example
 * // Run all test files in suites/ directory
 * node tests/vitests/run-all-vitest.mjs
 *
 * @example
 * // Run specific test file (full path)
 * node tests/vitests/run-all-vitest.mjs tests/vitests/suites/addapi/addapi-path-resolution.test.vitest.mjs
 *
 * @example
 * // Run specific test file (partial path - matches from suites/)
 * node tests/vitests/run-all-vitest.mjs suites/config/background-materialize.test.vitest.mjs
 *
 * @example
 * // Run specific test file (partial path - just folder and filename)
 * node tests/vitests/run-all-vitest.mjs config/background-materialize.test.vitest.mjs
 *
 * @example
 * // Run specific test file (partial path - just filename)
 * node tests/vitests/run-all-vitest.mjs background-materialize.test.vitest.mjs
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
 *
 * @example
 * // Pass through Vitest arguments (reporter, coverage, etc.)
 * node tests/vitests/run-all-vitest.mjs --reporter=verbose
 *
 * @example
 * // Combine special flags, test patterns, and vitest args
 * node tests/vitests/run-all-vitest.mjs --baseline --reporter=json --outputFile=results.json
 *
 * @example
 * // Use with coverage
 * node tests/vitests/run-all-vitest.mjs suites/config --coverage
 *
 * @example
 * // Hide detailed error output (show only file names and counts)
 * node tests/vitests/run-all-vitest.mjs --no-error-details
 *
 * @example
 * // Combine with test patterns
 * node tests/vitests/run-all-vitest.mjs --no-error-details --baseline
 */

import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import chalk from "chalk";

// eslint-disable-next-line no-useless-catch
try {
	// Import devcheck directly to avoid index.mjs try/catch
	await import("@cldmv/slothlet/devcheck");
	// console.log("🚀 GLOBAL SETUP: Devcheck completed");
} catch (error) {
	// console.log("🚀 GLOBAL SETUP: Devcheck failed:", error.message);
	throw error;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..", "..");
const vitestEntrypoint = path.resolve(projectRoot, "node_modules", "vitest", "vitest.mjs");
const vitestConfigPath = path.join(".configs", "vitest.config.mjs");

// Configuration
const WORKER_COUNT = process.env.VITEST_WORKERS ? parseInt(process.env.VITEST_WORKERS, 10) : 4;

/**
 * Display help message
 */
function showHelp() {
	console.log(`
${chalk.bold("Slothlet Vitest Test Runner")}
Sequential test runner to avoid OOM issues with massive test suites.

${chalk.bold("USAGE:")}
  npm run vitest [OPTIONS] [PATTERNS]

${chalk.bold("SPECIAL FLAGS:")}
  --baseline              Load test list from baseline-tests.json
  --no-error-details      Hide detailed error output (show only counts)
  --help, -h              Show this help message

${chalk.bold("TEST PATTERNS:")}
  [file]                  Run specific test file (supports partial paths)
  [folder]                Run all tests in folder
  
  Examples:
    suites/config/background-materialize.test.vitest.mjs
    suites/metadata
    metadata-collision-modes.test.vitest.mjs

${chalk.bold("VITEST FLAGS:")}
  All standard Vitest CLI flags are supported and passed through:
  -t, --testNamePattern   Filter tests by name pattern (regex)
  --reporter              Change reporter (verbose, dot, json, etc.)
  --coverage              Run full-suite coverage (blob-per-file + mergeReports,
                          avoids OOM; final report written to ./coverage/)
  --bail                  Stop on first failure
  
  See Vitest documentation for full list of options.

${chalk.bold("ENVIRONMENT VARIABLES:")}
  VITEST_HEAP_MB         Set max heap size per test (default: Node.js default)
  VITEST_WORKERS         Number of parallel workers (default: 4)

${chalk.bold("EXAMPLES:")}
  # Run all baseline tests
  npm run vitest -- --baseline

  # Run specific test file
  npm run vitest -- suites/config/background-materialize.test.vitest.mjs

  # Filter tests by name
  npm run vitest -- suites/metadata -t "lazy materialization"

  # Hide detailed errors
  npm run vitest -- --baseline --no-error-details

  # With custom heap and workers
  VITEST_HEAP_MB=8192 VITEST_WORKERS=2 npm run vitest -- suites/smart-flattening

  # Combine flags
  npm run vitest -- --baseline -t "LAZY" --reporter=verbose
`);
}

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
 * Parse CLI arguments to separate special flags, vitest flags, and test file patterns
 * @param {string[]} args - Raw CLI arguments
 * @returns {Object} Parsed arguments object
 */
function parseArguments(args) {
	const specialFlags = ["--baseline", "--no-error-details", "--help"];
	const vitestPassthroughArgs = [];
	const testPatterns = [];
	let baseline = false;
	let showErrorDetails = true;
	let help = false;

	for (let i = 0; i < args.length; i++) {
		const arg = args[i];

		if (arg === "--baseline") {
			baseline = true;
		} else if (arg === "--no-error-details") {
			showErrorDetails = false;
		} else if (arg === "--help" || arg === "-h") {
			help = true;
		} else if (arg.startsWith("--") || arg.startsWith("-")) {
			// Pass through any vitest flags (--reporter, --coverage, --watch, etc.)
			vitestPassthroughArgs.push(arg);
			// Check if this flag takes a value (next arg doesn't start with -)
			if (i + 1 < args.length && !args[i + 1].startsWith("-")) {
				vitestPassthroughArgs.push(args[i + 1]);
				i++; // Skip next arg since we consumed it
			}
		} else {
			// Test file pattern or path
			testPatterns.push(arg);
		}
	}

	return {
		baseline,
		showErrorDetails,
		help,
		vitestPassthroughArgs,
		testPatterns
	};
}

/**
 * Discover Vitest test files based on CLI arguments or default to all processed/ files
 * @param {string[]} testPatterns - Test file patterns (file paths, folder paths, partial paths, or empty for all)
 * @param {boolean} baseline - Whether to load baseline test list
 * @returns {Promise<string[]>} Array of test file paths relative to project root
 */
async function discoverVitestFiles(testPatterns, baseline) {
	// Check if --baseline flag is provided
	if (baseline) {
		const baselineJsonPath = path.resolve(__dirname, "baseline-tests.json");
		try {
			const jsonContent = await fs.readFile(baselineJsonPath, "utf8");
			const testList = JSON.parse(jsonContent);

			if (!Array.isArray(testList)) {
				throw new Error("baseline-tests.json must contain an array of test file paths");
			}

			console.log(`📋 Loading baseline test list from: ${path.relative(projectRoot, baselineJsonPath)}`);
			return testList.sort((a, b) => a.localeCompare(b));
		} catch (error) {
			console.error(`❌ Error reading baseline test list from ${baselineJsonPath}:`, error.message);
			process.exit(1);
		}
	}

	// If no test patterns provided, run all files in suites/
	if (testPatterns.length === 0) {
		const suitesDir = path.resolve(__dirname, "suites");
		const files = await discoverFilesInDir(suitesDir);
		return files.sort((a, b) => a.localeCompare(b));
	}

	const files = [];
	const suitesDir = path.resolve(__dirname, "suites");

	for (const arg of testPatterns) {
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
			// Path doesn't exist - try matching as a partial path
			// Discover all test files and match against them
			const allFiles = await discoverFilesInDir(suitesDir);
			const normalizedArg = arg.replace(/\\/g, "/");

			const matchedFiles = allFiles.filter((file) => {
				const normalizedFile = file.replace(/\\/g, "/");
				// Match if file ends with the provided partial path
				return normalizedFile.endsWith(normalizedArg) || normalizedFile.includes(`/${normalizedArg}`);
			});

			if (matchedFiles.length > 0) {
				files.push(...matchedFiles);
			} else {
				console.warn(`⚠️  No matches found for: ${arg}`);
			}
		}
	}

	// Remove duplicates and sort
	return [...new Set(files)].sort((a, b) => a.localeCompare(b));
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
 * @param {string[]} vitestArgs - Additional vitest arguments to pass through
 * @returns {Promise<Object>} Test results
 */
async function runSingleFile(filePath, maxOldSpaceMb, vitestArgs = []) {
	return new Promise((resolve) => {
		const startTime = Date.now();
		const args = [vitestEntrypoint, "--config", vitestConfigPath, "run", ...vitestArgs, filePath];

		const baseEnv = { ...process.env };
		if (!baseEnv.NODE_ENV) baseEnv.NODE_ENV = "development";
		const hasDevCondition = baseEnv.NODE_OPTIONS?.includes("--conditions=slothlet-dev");
		if (!hasDevCondition) {
			const existing = baseEnv.NODE_OPTIONS ? `${baseEnv.NODE_OPTIONS} ` : "";
			baseEnv.NODE_OPTIONS = `${existing}--conditions=slothlet-dev`.trim();
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
 * Run Vitest once directly with provided arguments
 * @param {string[]} vitestArgs - Vitest arguments and optional file patterns
 * @param {number | undefined} maxOldSpaceMb - Optional heap size limit
 * @returns {Promise<number>} Process exit code
 */
async function runVitestDirect(vitestArgs = [], maxOldSpaceMb) {
	return new Promise((resolve) => {
		const args = [vitestEntrypoint, "--config", vitestConfigPath, "run", ...vitestArgs];

		const baseEnv = { ...process.env };
		if (!baseEnv.NODE_ENV) baseEnv.NODE_ENV = "development";
		const hasDevCondition = baseEnv.NODE_OPTIONS?.includes("--conditions=slothlet-dev");
		if (!hasDevCondition) {
			const existing = baseEnv.NODE_OPTIONS ? `${baseEnv.NODE_OPTIONS} ` : "";
			baseEnv.NODE_OPTIONS = `${existing}--conditions=slothlet-dev`.trim();
		}
		if (maxOldSpaceMb && !baseEnv.NODE_OPTIONS?.includes("--max-old-space-size")) {
			const existing = baseEnv.NODE_OPTIONS ? `${baseEnv.NODE_OPTIONS} ` : "";
			baseEnv.NODE_OPTIONS = `${existing}--max-old-space-size=${maxOldSpaceMb}`.trim();
		}

		const child = spawn(process.execPath, args, {
			cwd: projectRoot,
			stdio: "inherit",
			env: baseEnv
		});

		child.on("close", (code) => {
			resolve(code ?? 1);
		});

		child.on("error", () => {
			resolve(1);
		});
	});
}

/**
 * Deduplicate similar error messages by grouping configs
 * @param {string[]} errors - Array of error messages (each is a complete error block with FAIL line + details)
 * @returns {string} Deduplicated error output as a single string
 */
function deduplicateErrors(errors) {
	// Join all errors into one string
	const fullText = errors.join("\n");
	const lines = fullText.split("\n");

	// Find FAIL lines with Config: and group them
	const failLineMap = new Map(); // pattern -> {lines: [original lines], configs: [config values]}
	const lineIndices = new Map(); // original line -> index in lines array

	lines.forEach((line, idx) => {
		if (line.includes("FAIL") && line.includes("Config:")) {
			lineIndices.set(line, idx);

			// Extract pattern: everything except the config value
			// Match: ... Config: 'XXX' ...  or Config: ''XXX''
			const cleaned = stripAnsi(line);
			const match = cleaned.match(/^(.+Config:\s+)'*([^'>]+)'*(.+)$/);
			if (match) {
				const [, before, config, after] = match;
				const pattern = before.trim() + "|||" + after.trim(); // Use ||| as separator

				if (!failLineMap.has(pattern)) {
					failLineMap.set(pattern, { lines: [], configs: [] });
				}
				failLineMap.get(pattern).lines.push(line);
				failLineMap.get(pattern).configs.push(config.replace(/'/g, "")); // Remove quotes
			}
		}
	});

	// Build result: replace duplicates with consolidated line
	const result = [];
	const skipIndices = new Set();

	for (const [pattern, data] of failLineMap.entries()) {
		if (data.configs.length > 1) {
			// Mark all but first for skipping
			for (let i = 1; i < data.lines.length; i++) {
				const idx = lineIndices.get(data.lines[i]);
				if (idx !== undefined) {
					skipIndices.add(idx);
				}
			}

			// Build consolidated line from first occurrence
			const firstLine = data.lines[0];
			const configArray = `[${data.configs.map((c) => `'${c}'`).join(",")}]`;
			const consolidated = stripAnsi(firstLine).replace(/(Config:\s+)'*[^'>]+'*/, `$1${configArray}`);

			// Replace first occurrence
			const firstIdx = lineIndices.get(firstLine);
			if (firstIdx !== undefined) {
				lines[firstIdx] = consolidated;
			}
		}
	}

	// Filter out skipped lines
	const filtered = lines.filter((_, idx) => !skipIndices.has(idx));

	return filtered.join("\n");
}

/**
 * Merge blob reports and generate final coverage report
 * @param {string} blobsDir - Directory containing blob files from individual runs
 * @param {string[]} extraCoverageArgs - Additional --coverage.* args to pass through
 * @param {number | undefined} maxOldSpaceMb - Optional heap size limit
 * @returns {Promise<number>} Process exit code
 */
async function runMergeReports(blobsDir, extraCoverageArgs = [], maxOldSpaceMb) {
	return new Promise((resolve) => {
		const args = [vitestEntrypoint, "--config", vitestConfigPath, "--mergeReports", blobsDir, "--run", "--coverage", ...extraCoverageArgs];

		const baseEnv = { ...process.env };
		if (!baseEnv.NODE_ENV) baseEnv.NODE_ENV = "development";
		const hasDevCondition = baseEnv.NODE_OPTIONS?.includes("--conditions=slothlet-dev");
		if (!hasDevCondition) {
			const existing = baseEnv.NODE_OPTIONS ? `${baseEnv.NODE_OPTIONS} ` : "";
			baseEnv.NODE_OPTIONS = `${existing}--conditions=slothlet-dev`.trim();
		}
		if (maxOldSpaceMb && !baseEnv.NODE_OPTIONS?.includes("--max-old-space-size")) {
			const existing = baseEnv.NODE_OPTIONS ? `${baseEnv.NODE_OPTIONS} ` : "";
			baseEnv.NODE_OPTIONS = `${existing}--max-old-space-size=${maxOldSpaceMb}`.trim();
		}

		const child = spawn(process.execPath, args, {
			cwd: projectRoot,
			stdio: "inherit",
			env: baseEnv
		});

		child.on("close", (code) => resolve(code ?? 1));
		child.on("error", () => resolve(1));
	});
}

/**
 * Main runner: executes all test files and provides final report
 */
async function runAllFiles() {
	// Parse CLI arguments - everything after script name
	const rawArgs = process.argv.slice(2);
	const { baseline, showErrorDetails, help, vitestPassthroughArgs, testPatterns } = parseArguments(rawArgs);
	const maxOldSpaceMb = process.env.VITEST_HEAP_MB ? parseInt(process.env.VITEST_HEAP_MB, 10) : undefined;
	const hasCoverage = vitestPassthroughArgs.some((arg) => arg === "--coverage" || arg.startsWith("--coverage."));

	// Show help and exit if requested
	if (help) {
		showHelp();
		process.exit(0);
	}

	if (hasCoverage) {
		// Coverage mode: run each file individually with blob reporter, then merge all blobs.
		// This avoids OOM while still producing a complete merged coverage report.
		const blobsDir = path.resolve(projectRoot, ".vitest-coverage-blobs");

		// Clean blobs dir from any previous run
		await fs.rm(blobsDir, { recursive: true, force: true });
		await fs.mkdir(blobsDir, { recursive: true });

		const coverageTestFiles = await discoverVitestFiles(testPatterns, baseline);
		if (coverageTestFiles.length === 0) {
			if (testPatterns.length > 0) {
				console.log(`❌ No Vitest test files found matching: ${testPatterns.join(", ")}`);
			} else {
				console.log("❌ No Vitest test files found in tests/vitests/suites/");
			}
			process.exit(1);
		}

		// Separate --coverage / --coverage.* args (used only in merge step) from other passthrough args
		const extraCoverageArgs = vitestPassthroughArgs.filter((a) => a !== "--coverage" && a.startsWith("--coverage."));
		const nonCoveragePassthrough = vitestPassthroughArgs.filter((a) => a !== "--coverage" && !a.startsWith("--coverage."));

		console.log(`\n🧪 Running ${coverageTestFiles.length} test files for coverage (blob + merge mode)`);
		console.log(`⚙️  Workers: ${WORKER_COUNT}`);
		if (maxOldSpaceMb) console.log(`🧠 Heap limit: ${maxOldSpaceMb} MB`);
		console.log("");

		const coverageResults = [];
		let blobIndex = 0;
		let coverageFileIndex = 0;
		const coverageActivePromises = new Set();

		while (coverageFileIndex < coverageTestFiles.length || coverageActivePromises.size > 0) {
			while (coverageFileIndex < coverageTestFiles.length && coverageActivePromises.size < WORKER_COUNT) {
				const filePath = coverageTestFiles[coverageFileIndex];
				const blobPath = path.join(blobsDir, `run-${blobIndex}.blob`);
				coverageFileIndex++;
				blobIndex++;

				console.log(`\n${"=".repeat(80)}`);
				console.log(`▶️  ${filePath}`);
				console.log("=".repeat(80));

				// Each run gets its own temp coverage dir to avoid concurrent write conflicts.
				// These live inside blobsDir and are cleaned up with it after the merge step.
				const tmpCoverageDir = path.join(blobsDir, `coverage-tmp-${blobIndex}`);
				const blobArgs = [
					...nonCoveragePassthrough,
					"--coverage",
					`--coverage.reportsDirectory=${tmpCoverageDir}`,
					"--reporter=default",
					"--reporter=blob",
					`--outputFile=${blobPath}`
				];

				const promise = runSingleFile(filePath, maxOldSpaceMb, blobArgs)
					.then((result) => {
						coverageResults.push(result);
						if (result.code === 0) {
							const durationSec = (result.duration / 1000).toFixed(2);
							const heapInfo = result.heapMb ? ` | ${result.heapMb} MB heap` : "";
							console.log(`\n✅ PASSED (${durationSec}s${heapInfo})\n`);
						} else {
							const durationSec = (result.duration / 1000).toFixed(2);
							console.log(`\n❌ FAILED (exit code ${result.code}, ${durationSec}s)\n`);
						}
						coverageActivePromises.delete(promise);
					})
					.catch((err) => {
						console.error(`Error running ${filePath}:`, err);
						coverageActivePromises.delete(promise);
					});

				coverageActivePromises.add(promise);
			}

			if (coverageActivePromises.size > 0) {
				await Promise.race(coverageActivePromises);
			}
		}

		// Verify blobs were produced
		const blobFiles = (await fs.readdir(blobsDir).catch(() => [])).filter((f) => f.endsWith(".blob"));
		if (blobFiles.length === 0) {
			console.error("❌ No coverage blobs were generated — coverage report cannot be produced");
			process.exit(1);
		}

		// Merge all blobs into the final coverage report
		console.log(`\n${"=".repeat(80)}`);
		console.log(`📊 Merging ${blobFiles.length} coverage blobs into final report...`);
		console.log("=".repeat(80));

		const mergeExitCode = await runMergeReports(blobsDir, extraCoverageArgs, maxOldSpaceMb);

		// Clean up blobs
		await fs.rm(blobsDir, { recursive: true, force: true }).catch(() => {});

		const coverageFailed = coverageResults.filter((r) => r.code !== 0);
		process.exit(coverageFailed.length > 0 ? 1 : mergeExitCode);
	}

	const testFiles = await discoverVitestFiles(testPatterns, baseline);
	if (testFiles.length === 0) {
		if (testPatterns.length > 0) {
			console.log(`❌ No Vitest test files found matching: ${testPatterns.join(", ")}`);
		} else {
			console.log("❌ No Vitest test files found in tests/vitests/suites/");
		}
		return;
	}

	const results = [];
	const scriptStartTime = Date.now();
	const scriptStartTimeFormatted = new Date().toLocaleTimeString("en-US", { hour12: false });

	if (testPatterns.length > 0) {
		console.log(`\n🧪 Running ${testFiles.length} test files matching: ${testPatterns.join(", ")}`);
	} else {
		console.log(`\n🧪 Running ${testFiles.length} test files in parallel`);
	}
	console.log(`⚙️  Workers: ${WORKER_COUNT}`);
	if (maxOldSpaceMb) {
		console.log(`🧠 Heap limit: ${maxOldSpaceMb} MB`);
	}
	if (vitestPassthroughArgs.length > 0) {
		console.log(`🔧 Vitest args: ${vitestPassthroughArgs.join(" ")}`);
	}
	console.log(""); // Blank line

	// Run tests with proper worker pool - start new work when slots open
	const runTestFile = async (filePath) => {
		console.log(`\n${"=".repeat(80)}`);
		console.log(`▶️  ${filePath}`);
		console.log("=".repeat(80));

		const result = await runSingleFile(filePath, maxOldSpaceMb, vitestPassthroughArgs);

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

	// Top duration
	if (results.length > 0) {
		console.log("\n" + chalk.bold("⏱️  TOP DURATION"));
		console.log("-".repeat(80));

		[...results]
			.sort((a, b) => b.duration - a.duration)
			.slice(0, 10)
			.forEach((r) => {
				const sec = (r.duration / 1000).toFixed(2);
				console.log(`  ${(sec + "s").padStart(8)}  ${chalk.dim(r.file)}`);
			});
	}

	// Passed test files summary
	if (passedFiles.length > 0) {
		console.log("\n" + "=".repeat(80));
		console.log(chalk.bold.green("✓ PASSED TEST FILES"));
		console.log("=".repeat(80));

		passedFiles.forEach((result) => {
			const durationSec = (result.duration / 1000).toFixed(2);
			const statsInfo = [];
			if (result.heapMb) statsInfo.push(`${result.heapMb} MB`);
			statsInfo.push(`${durationSec}s`);
			const testInfo = result.testsPass > 0 ? ` - ${result.testsPass} tests` : "";
			console.log(chalk.green(`✓ ${result.file}${testInfo}`) + chalk.dim(` (${statsInfo.join(", ")})`));
		});
	}
	/* 
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
 */
	// Final summary (Vitest-style)
	console.log("\n" + chalk.bold("=".repeat(80)));

	// Exit with appropriate code
	if (failedFiles.length > 0) {
		console.log(`\n❌ ${failedFiles.length} test file(s) failed`);
		console.log(chalk.bold.red("\nFailed Test Files:"));
		failedFiles.forEach((result) => {
			const durationSec = (result.duration / 1000).toFixed(2);
			const testCounts = [];
			if (result.testsFail > 0) testCounts.push(chalk.red(`${result.testsFail} failed`));
			if (result.testsPass > 0) testCounts.push(chalk.green(`${result.testsPass} passed`));
			if (result.testsSkip > 0) testCounts.push(chalk.yellow(`${result.testsSkip} skipped`));
			const statsInfo = [];
			if (result.heapMb) statsInfo.push(`${result.heapMb} MB`);
			statsInfo.push(`${durationSec}s`);
			const countStr = testCounts.length > 0 ? ` (${testCounts.join(", ")})` : "";
			console.log(`  ${chalk.red("✖")} ${result.file}${countStr}` + chalk.dim(` [${statsInfo.join(", ")}]`));

			// Show error details indented under each failed test file (if not suppressed)
			if (showErrorDetails && result.errors.length > 0) {
				// Deduplicate errors before displaying
				const deduplicatedText = deduplicateErrors(result.errors);

				// Indent each line by 4 spaces
				const indentedError = deduplicatedText
					.split("\n")
					.map((line) => (line.trim() ? `    ${line}` : ""))
					.join("\n");
				console.log(indentedError);
				console.log(""); // Blank line between test files
			}
		});
		console.log("");
	}

	console.log(chalk.bold("=".repeat(80)));

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

	// Exit with appropriate code
	if (failedFiles.length > 0) {
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
