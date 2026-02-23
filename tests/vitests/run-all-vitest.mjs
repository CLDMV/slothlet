/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/run-all-vitest.mjs
 *	@Date: 2026-01-12T23:44:38-08:00 (1768290278)
 *	@Author: Nate Hyson <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Hyson <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-02-22 20:18:22 -08:00 (1771820302)
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
import { createWriteStream } from "node:fs";
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

// Mirror all output (except progress bar lines) to coverage/coverage-run.log when running in coverage-quiet mode (cross-platform)
if (process.argv.includes("--coverage-quiet")) {
	const logStream = createWriteStream(path.join(projectRoot, "coverage", "coverage-run.log"));
	const origStdoutWrite = process.stdout.write.bind(process.stdout);
	const origStderrWrite = process.stderr.write.bind(process.stderr);

	/**
	 * Determine if a chunk is a progress bar write that should be excluded from the log file.
	 * TTY mode uses \r to overwrite in place; non-TTY mode prints "progress N.N% ..." lines.
	 * @param {Buffer|string} chunk - The data being written.
	 * @returns {boolean} True if the chunk is a progress line and should be skipped in the log.
	 */
	function isProgressChunk(chunk) {
		const str = chunk.toString();
		return str.startsWith("\r") || /^progress \d+\.\d+%/.test(str);
	}

	process.stdout.write = (chunk, enc, cb) => {
		if (!isProgressChunk(chunk)) logStream.write(chunk);
		return origStdoutWrite(chunk, enc, cb);
	};
	process.stderr.write = (chunk, enc, cb) => {
		if (!isProgressChunk(chunk)) logStream.write(chunk);
		return origStderrWrite(chunk, enc, cb);
	};
	process.on("exit", () => logStream.end());
}

const vitestEntrypoint = path.resolve(projectRoot, "node_modules", "vitest", "vitest.mjs");
const vitestConfigPath = path.join(".configs", "vitest.config.mjs");

// Configuration
const WORKER_COUNT = process.env.VITEST_WORKERS ? parseInt(process.env.VITEST_WORKERS, 10) : 4;

// How many files to display in the worst-coverage table (when --coverage is used). Set to 0 to disable the table.
const WORST_COVERAGE_FILE_COUNT = 10;

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
	--coverage-quiet        Implies --coverage; show progress bar + final summaries only
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

	# Coverage with quiet output and progress bar
	npm run vitest -- --coverage --coverage-quiet
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
	const specialFlags = ["--baseline", "--no-error-details", "--coverage-quiet", "--help"];
	const vitestPassthroughArgs = [];
	const testPatterns = [];
	let baseline = false;
	let showErrorDetails = true;
	let coverageQuiet = false;
	let help = false;

	for (let i = 0; i < args.length; i++) {
		const arg = args[i];

		if (arg === "--baseline") {
			baseline = true;
		} else if (arg === "--no-error-details") {
			showErrorDetails = false;
		} else if (arg === "--coverage-quiet") {
			coverageQuiet = true;
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
		coverageQuiet,
		help,
		vitestPassthroughArgs,
		testPatterns
	};
}

/**
 * Format milliseconds to human-readable m:ss or h:mm:ss.
 * @param {number} ms - Duration in milliseconds.
 * @returns {string} Formatted duration string.
 * @example
 * formatDuration(65000); // "1:05"
 */
function formatDuration(ms) {
	const totalSeconds = Math.max(0, Math.floor(ms / 1000));
	const hours = Math.floor(totalSeconds / 3600);
	const minutes = Math.floor((totalSeconds % 3600) / 60);
	const seconds = totalSeconds % 60;

	if (hours > 0) {
		return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
	}

	return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

/**
 * Create a live coverage progress tracker with TTY bar/spinner and non-TTY fallbacks.
 * @param {number} total - Total number of files to execute.
 * @returns {{ onStart: () => void, onComplete: (failedRun: boolean) => void, finish: () => void }} Progress tracker API.
 * @example
 * const progress = createCoverageProgressTracker(120);
 * progress.onStart();
 * progress.onComplete(false);
 * progress.finish();
 */
function createCoverageProgressTracker(total) {
	const isTTY = Boolean(process.stdout.isTTY);
	const spinnerFrames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
	const barWidth = 26;
	const startTime = Date.now();
	let completed = 0;
	let active = 0;
	let failed = 0;
	let frameIndex = 0;
	let maxLineLength = 0;
	let lastPlainLog = 0;
	let spinnerTimer = null;

	/**
	 * Build the current progress line text.
	 * @returns {string} Progress line.
	 */
	function buildLine() {
		const percent = total === 0 ? 100 : (completed / total) * 100;
		const elapsedMs = Date.now() - startTime;
		const avgPerFile = completed > 0 ? elapsedMs / completed : 0;
		const remainingFiles = Math.max(total - completed, 0);
		const etaMs = avgPerFile * remainingFiles;
		const filled = Math.round((percent / 100) * barWidth);
		const spinner = spinnerFrames[frameIndex % spinnerFrames.length];

		const barType = 1;
		let barConfig = {
			preBar: "[",
			postBar: "]",
			fill: "=",
			empty: "-"
		};

		if (barType === 2) {
			barConfig = {
				preBar: "|",
				postBar: "|",
				fill: "█",
				empty: "░"
			};
		}

		let _percent = percent.toFixed(1).padStart(5);
		if (percent < 30) {
			_percent = chalk.red(_percent + "%");
		} else if (percent < 70) {
			_percent = chalk.rgb(255, 136, 0)(_percent + "%");
		} else if (percent > 99) {
			_percent = chalk.green(_percent + "%");
		} else {
			_percent = chalk.yellow(_percent + "%");
		}

		const bar = `${barConfig.preBar}${barConfig.fill.repeat(filled)}${barConfig.empty.repeat(Math.max(0, barWidth - filled))}${barConfig.postBar}`;

		if (isTTY) {
			return `${chalk.green(spinner)} ${chalk.green(bar)} ${chalk.bold(_percent)} ${completed}/${total} | active ${active} | failed ${failed} | ETA ${formatDuration(etaMs)} | elapsed ${formatDuration(elapsedMs)}`;
		}

		return `progress ${percent.toFixed(1)}% ${completed}/${total} | active ${active} | failed ${failed} | eta ${formatDuration(etaMs)} | elapsed ${formatDuration(elapsedMs)}`;
	}

	/**
	 * Render the progress line to stdout.
	 * @param {boolean} forcePlainLog - Force a plain line log in non-TTY mode.
	 * @returns {void}
	 */
	function render(forcePlainLog = false) {
		const line = buildLine();
		frameIndex++;

		if (isTTY) {
			const visibleLength = stripAnsi(line).length;
			maxLineLength = Math.max(maxLineLength, visibleLength);
			const padded = line.padEnd(maxLineLength, " ");
			process.stdout.write(`\r${padded}`);
			return;
		}

		const now = Date.now();
		if (forcePlainLog || now - lastPlainLog >= 2000) {
			console.log(line);
			lastPlainLog = now;
		}
	}

	/**
	 * Start periodic spinner redraw for TTY output.
	 * @returns {void}
	 */
	function startSpinnerLoop() {
		if (!isTTY || spinnerTimer) return;

		spinnerTimer = setInterval(() => {
			if (completed >= total && active === 0) return;
			render();
		}, 120);

		spinnerTimer.unref?.();
	}

	/**
	 * Stop periodic spinner redraw loop.
	 * @returns {void}
	 */
	function stopSpinnerLoop() {
		if (!spinnerTimer) return;
		clearInterval(spinnerTimer);
		spinnerTimer = null;
	}

	render(true);
	startSpinnerLoop();

	return {
		onStart() {
			active++;
			render();
		},
		onComplete(failedRun) {
			active = Math.max(0, active - 1);
			completed++;
			if (failedRun) failed++;
			render(true);
		},
		finish() {
			stopSpinnerLoop();
			render(true);
			if (isTTY) {
				process.stdout.write("\n");
			}
		}
	};
}

/**
 * Print full verbose output for failed coverage files in quiet mode.
 * @param {Array<{file: string, code: number, rawOutput: string}>} failedResults - Failed coverage run results.
 * @returns {void}
 * @example
 * printQuietCoverageFailureDetails([{ file: "tests/vitests/suites/foo.test.vitest.mjs", code: 1, rawOutput: "..." }]);
 */
function printQuietCoverageFailureDetails(failedResults) {
	if (failedResults.length === 0) return;

	console.log(`\n${"=".repeat(80)}`);
	console.log(chalk.bold.red("✖ FAILED TEST FILES (VERBOSE OUTPUT)"));
	console.log("=".repeat(80));

	for (const failedResult of failedResults) {
		console.log(`\n${chalk.red("✖")} ${chalk.red(failedResult.file)} ${chalk.dim(`(exit ${failedResult.code})`)}`);
		if (failedResult.rawOutput?.trim()) {
			console.log(failedResult.rawOutput.trimEnd());
		} else {
			console.log(chalk.dim("(no child output captured)"));
		}
	}

	console.log(`\n${"=".repeat(80)}`);
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
 * @param {{ streamOutput?: boolean }} options - Runtime options for child output behavior
 * @returns {Promise<Object>} Test results
 */
async function runSingleFile(filePath, maxOldSpaceMb, vitestArgs = [], options = {}) {
	return new Promise((resolve) => {
		const { streamOutput = true } = options;
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
			if (streamOutput) {
				process.stdout.write(data); // Stream output to console
			}
		});

		child.stderr?.on("data", (data) => {
			const text = data.toString();
			stderr += text;
			if (streamOutput) {
				process.stderr.write(data); // Stream output to console
			}
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
 * @param {{ quietOutput?: boolean }} options - Controls whether merge output is filtered.
 * @returns {Promise<number>} Process exit code
 */
async function runMergeReports(blobsDir, extraCoverageArgs = [], maxOldSpaceMb, options = {}) {
	return new Promise((resolve) => {
		const { quietOutput = false } = options;
		const mergeReporterArgs = quietOutput ? ["--color"] : [];
		const args = [
			vitestEntrypoint,
			"--config",
			vitestConfigPath,
			"--mergeReports",
			blobsDir,
			"--run",
			"--coverage",
			...mergeReporterArgs,
			...extraCoverageArgs
		];

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
			stdio: quietOutput ? ["ignore", "pipe", "pipe"] : "inherit",
			env: baseEnv
		});

		let stdout = "";
		let stderr = "";

		if (quietOutput) {
			child.stdout?.on("data", (data) => {
				stdout += data.toString();
			});

			child.stderr?.on("data", (data) => {
				stderr += data.toString();
			});
		}

		child.on("close", (code) => {
			if (quietOutput) {
				const output = `${stdout}\n${stderr}`;
				if ((code ?? 1) === 0) {
					const marker = "% Coverage report from v8";
					const rawLines = output.split("\n");
					const markerLineIndex = rawLines.findIndex((line) => stripAnsi(line).includes(marker));

					if (markerLineIndex >= 0) {
						let endLineIndex = rawLines.length;
						for (let i = markerLineIndex + 1; i < rawLines.length; i++) {
							const line = stripAnsi(rawLines[i]).trimStart();
							if (line.startsWith("stderr |") || line.startsWith("stdout |")) {
								endLineIndex = i;
								break;
							}
						}

						const coverageBlock = rawLines.slice(markerLineIndex, endLineIndex).join("\n").trimEnd();
						if (coverageBlock) {
							console.log(`\n${coverageBlock}\n`);
						}
					}
				} else {
					const failedOutput = output.trimEnd();
					if (failedOutput) {
						console.error(failedOutput);
					}
				}
			}

			resolve(code ?? 1);
		});
		child.on("error", () => resolve(1));
	});
}

/**
 * Colour-code a coverage percentage value.
 * @param {number} pct - Coverage percentage (0–100).
 * @returns {string} Chalk-coloured string.
 */
function colourPct(pct) {
	const str = pct.toFixed(2).padStart(6);
	if (pct >= 80) return chalk.green(str);
	if (pct >= 50) return chalk.yellow(str);
	return chalk.red(str);
}

/**
 * Compute a coverage-summary-style object from the raw V8/Istanbul coverage-final.json.
 * Each file entry has statement/function/branch/line totals and covered counts.
 * @param {Record<string, object>} finalData - Parsed coverage-final.json contents.
 * @returns {{ total: object, [filePath: string]: object }} Summary in coverage-summary format.
 */
function computeSummaryFromFinal(finalData) {
	const pct = (covered, total) => (total === 0 ? 100 : parseFloat(((covered / total) * 100).toFixed(2)));
	const summary = {
		total: {
			statements: { total: 0, covered: 0, pct: 0 },
			branches: { total: 0, covered: 0, pct: 0 },
			functions: { total: 0, covered: 0, pct: 0 },
			lines: { total: 0, covered: 0, pct: 0 }
		}
	};

	for (const [filePath, data] of Object.entries(finalData)) {
		const sKeys = Object.keys(data.s ?? {});
		const stmtTotal = sKeys.length;
		const stmtCovered = sKeys.filter((k) => data.s[k] > 0).length;

		const fKeys = Object.keys(data.f ?? {});
		const fnTotal = fKeys.length;
		const fnCovered = fKeys.filter((k) => data.f[k] > 0).length;

		let branchTotal = 0,
			branchCovered = 0;
		for (const counts of Object.values(data.b ?? {})) {
			branchTotal += counts.length;
			branchCovered += counts.filter((c) => c > 0).length;
		}

		// Lines: use statementMap to find unique source lines.
		const coveredLines = new Set();
		const totalLines = new Set();
		for (const [sid, loc] of Object.entries(data.statementMap ?? {})) {
			const line = loc?.start?.line;
			if (line == null) continue;
			totalLines.add(line);
			if ((data.s ?? {})[sid] > 0) coveredLines.add(line);
		}

		const fileStats = {
			statements: { total: stmtTotal, covered: stmtCovered, pct: pct(stmtCovered, stmtTotal) },
			branches: { total: branchTotal, covered: branchCovered, pct: pct(branchCovered, branchTotal) },
			functions: { total: fnTotal, covered: fnCovered, pct: pct(fnCovered, fnTotal) },
			lines: { total: totalLines.size, covered: coveredLines.size, pct: pct(coveredLines.size, totalLines.size) }
		};
		summary[filePath] = fileStats;

		for (const key of ["statements", "branches", "functions", "lines"]) {
			summary.total[key].total += fileStats[key].total;
			summary.total[key].covered += fileStats[key].covered;
		}
	}

	for (const key of ["statements", "branches", "functions", "lines"]) {
		const { total, covered } = summary.total[key];
		summary.total[key].pct = pct(covered, total);
	}
	return summary;
}

/**
 * Resolve coverage output directory from CLI coverage arguments.
 * @param {string[]} extraCoverageArgs - Any --coverage.* passthrough args.
 * @returns {string} Absolute coverage directory path.
 * @example
 * resolveCoverageDirectory(["--coverage.reportsDirectory=.coverage"]);
 */
function resolveCoverageDirectory(extraCoverageArgs) {
	let coverageDir = path.resolve(projectRoot, "coverage");
	const repoDirArg = extraCoverageArgs.find((a) => a.startsWith("--coverage.reportsDirectory="));
	if (repoDirArg) {
		const raw = repoDirArg.split("=").slice(1).join("=");
		coverageDir = path.isAbsolute(raw) ? raw : path.resolve(projectRoot, raw);
	}

	return coverageDir;
}

/**
 * Parse the V8/istanbul coverage-summary.json (or fall back to coverage-final.json) produced
 * by Vitest after a mergeReports run, then print a worst-offenders table and overall-coverage footer.
 * @param {string[]} extraCoverageArgs - Any --coverage.* passthrough args (used to detect reportsDirectory).
 * @returns {Promise<void>}
 */
async function printCoverageSummary(extraCoverageArgs) {
	const coverageDir = resolveCoverageDirectory(extraCoverageArgs);

	let summary;

	// Primary: try coverage-summary.json (generated by "json-summary" reporter).
	const summaryPath = path.join(coverageDir, "coverage-summary.json");
	try {
		const content = await fs.readFile(summaryPath, "utf8");
		summary = JSON.parse(content);
	} catch {
		// Fallback: compute from coverage-final.json (generated by "json" reporter / V8 default).
		const finalPath = path.join(coverageDir, "coverage-final.json");
		try {
			const content = await fs.readFile(finalPath, "utf8");
			summary = computeSummaryFromFinal(JSON.parse(content));
		} catch {
			console.log(chalk.dim("  (no coverage JSON found — skipping summary)"));
			return;
		}
	}

	const { total, ...fileSummaries } = summary;

	if (WORST_COVERAGE_FILE_COUNT > 0) {
		// Build sorted list: worst line-coverage first.
		const fileRows = Object.entries(fileSummaries)
			.map(([absFile, data]) => ({
				file: path.relative(projectRoot, absFile),
				lines: data.lines?.pct ?? 0,
				stmts: data.statements?.pct ?? 0,
				fns: data.functions?.pct ?? 0,
				branches: data.branches?.pct ?? 0
			}))
			.sort((a, b) => a.lines - b.lines);

		console.log("\n" + chalk.bold("📉 WORST COVERAGE FILES (lines)"));
		console.log("-".repeat(80));
		fileRows.slice(0, WORST_COVERAGE_FILE_COUNT).forEach(({ file, lines, stmts, fns, branches }) => {
			const pctCol = colourPct(lines);
			const extras = chalk.dim(`stmts ${stmts.toFixed(0)}% | fns ${fns.toFixed(0)}% | branches ${branches.toFixed(0)}%`);
			console.log(`  ${pctCol}%  ${chalk.dim(file)}  ${extras}`);
		});

		if (fileRows.length > WORST_COVERAGE_FILE_COUNT) {
			console.log(chalk.dim(`  ... and ${fileRows.length - WORST_COVERAGE_FILE_COUNT} more files`));
		}
	}

	// Overall totals footer — matches the Vitest-style summary line format.
	const tl = total.lines?.pct ?? 0;
	const ts = total.statements?.pct ?? 0;
	const tf = total.functions?.pct ?? 0;
	const tb = total.branches?.pct ?? 0;
	console.log(
		`\n  ${chalk.bold("Coverage")}  ${colourPct(tl)}% lines ${chalk.dim("|")} ${colourPct(ts)}% statements ${chalk.dim("|")} ${colourPct(tf)}% functions ${chalk.dim("|")} ${colourPct(tb)}% branches`
	);
}

/**
 * Main runner: executes all test files and provides final report
 */
async function runAllFiles() {
	// Parse CLI arguments - everything after script name
	const rawArgs = process.argv.slice(2);
	const {
		baseline,
		showErrorDetails,
		coverageQuiet,
		help,
		vitestPassthroughArgs: parsedVitestArgs,
		testPatterns
	} = parseArguments(rawArgs);
	const vitestPassthroughArgs = [...parsedVitestArgs];

	if (coverageQuiet && !vitestPassthroughArgs.some((arg) => arg === "--coverage" || arg.startsWith("--coverage."))) {
		vitestPassthroughArgs.unshift("--coverage");
	}

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
		// Coverage temp dirs must be OUTSIDE blobsDir — vitest --mergeReports errors on
		// any non-blob entry (including subdirectories) found inside the blobs directory.
		const coverageTmpBase = path.resolve(projectRoot, ".vitest-coverage-tmp");

		// Clean both dirs from any previous run
		await Promise.all([fs.rm(blobsDir, { recursive: true, force: true }), fs.rm(coverageTmpBase, { recursive: true, force: true })]);
		await Promise.all([fs.mkdir(blobsDir, { recursive: true }), fs.mkdir(coverageTmpBase, { recursive: true })]);

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

		if (!coverageQuiet) {
			console.log(`\n🧪 Running ${coverageTestFiles.length} test files for coverage (blob + merge mode)`);
			console.log(`⚙️  Workers: ${WORKER_COUNT}`);
			if (maxOldSpaceMb) console.log(`🧠 Heap limit: ${maxOldSpaceMb} MB`);
			console.log("");
		}

		const coverageProgress = coverageQuiet
			? createCoverageProgressTracker(coverageTestFiles.length)
			: {
					onStart() {},
					onComplete() {},
					finish() {}
				};

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

				if (!coverageQuiet) {
					console.log(`\n${"=".repeat(80)}`);
					console.log(`▶️  ${filePath}`);
					console.log("=".repeat(80));
				}

				coverageProgress.onStart();

				// Each run gets its own temp coverage dir (outside blobsDir) to avoid
				// concurrent write conflicts and keep --mergeReports happy.
				const tmpCoverageDir = path.join(coverageTmpBase, `run-${blobIndex}`);
				const blobArgs = [
					...nonCoveragePassthrough,
					"--coverage",
					`--coverage.reportsDirectory=${tmpCoverageDir}`,
					"--reporter=default",
					"--reporter=blob",
					`--outputFile=${blobPath}`
				];

				const promise = runSingleFile(filePath, maxOldSpaceMb, blobArgs, { streamOutput: !coverageQuiet })
					.then((result) => {
						coverageResults.push(result);
						coverageProgress.onComplete(result.code !== 0);

						if (!coverageQuiet) {
							if (result.code === 0) {
								const durationSec = (result.duration / 1000).toFixed(2);
								const heapInfo = result.heapMb ? ` | ${result.heapMb} MB heap` : "";
								console.log(`\n✅ PASSED (${durationSec}s${heapInfo})\n`);
							} else {
								const durationSec = (result.duration / 1000).toFixed(2);
								console.log(`\n❌ FAILED (exit code ${result.code}, ${durationSec}s)\n`);
							}
						}
						coverageActivePromises.delete(promise);
					})
					.catch((err) => {
						coverageProgress.onComplete(true);
						console.error(`Error running ${filePath}:`, err);
						coverageActivePromises.delete(promise);
					});

				coverageActivePromises.add(promise);
			}

			if (coverageActivePromises.size > 0) {
				await Promise.race(coverageActivePromises);
			}
		}

		coverageProgress.finish();

		// Verify blobs were produced
		const blobFiles = (await fs.readdir(blobsDir).catch(() => [])).filter((f) => f.endsWith(".blob"));
		if (blobFiles.length === 0) {
			console.error("❌ No coverage blobs were generated — coverage report cannot be produced");
			process.exit(1);
		}

		// Merge all blobs into the final coverage report
		if (!coverageQuiet) {
			console.log(`\n${"=".repeat(80)}`);
			console.log(`📊 Merging ${blobFiles.length} coverage blobs into final report...`);
			console.log("=".repeat(80));
		}

		const mergeExitCode = await runMergeReports(blobsDir, extraCoverageArgs, maxOldSpaceMb, { quietOutput: coverageQuiet });

		// Print coverage summary table (reads coverage-summary.json before cleanup)
		await printCoverageSummary(extraCoverageArgs);

		// Clean up blobs and tmp coverage dirs
		await Promise.all([
			fs.rm(blobsDir, { recursive: true, force: true }).catch(() => {}),
			fs.rm(coverageTmpBase, { recursive: true, force: true }).catch(() => {})
		]);

		const coverageFailed = coverageResults.filter((r) => r.code !== 0);
		if (coverageQuiet) {
			printQuietCoverageFailureDetails(coverageFailed);
		}
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
