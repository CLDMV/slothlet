/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/run-all-vitest.mjs
 *	@Date: 2026-01-12T23:44:38-08:00 (1768290278)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-02 18:03:44 -08:00 (1772503424)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Compatibility wrapper that delegates Vitest execution to @cldmv/vitest-runner.
 * @module tests/vitests/run-all-vitest
 * @internal
 *
 * @description
 * Preserves the original script UX for Slothlet (`--baseline`, `--no-error-details`,
 * `--coverage-quiet`, test patterns, worker and heap env vars), while offloading all heavy
 * runner logic to the shared @cldmv/vitest-runner package.
 *
 * @example
 * node tests/vitests/run-all-vitest.mjs --baseline
 *
 * @example
 * node tests/vitests/run-all-vitest.mjs suites/config/background-materialize.test.vitest.mjs
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { run } from "@cldmv/vitest-runner";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..", "..");

const DEFAULT_WORKERS = process.env.VITEST_WORKERS ? parseInt(process.env.VITEST_WORKERS, 10) : 4;

/**
 * Absolute path to the coverage run lock file.
 * Created exclusively (`wx`) at the start of a coverage run and removed on exit.
 * Using `tmp/` keeps it inside the project (never `os.tmpdir()`).
 * @type {string}
 */
const COVERAGE_LOCK_FILE = path.join(projectRoot, "tmp", ".coverage-lock");

/**
 * Attempt to acquire the coverage run lock.
 * Uses the `wx` (exclusive-create) flag which is atomic on all platforms — the OS
 * guarantees that only one process can create the file when it does not exist.
 *
 * @returns {void}
 * @throws {Error} Re-throws any unexpected filesystem error other than EEXIST.
 * @example
 * acquireCoverageLock(); // creates tmp/.coverage-lock
 */
function acquireCoverageLock() {
	try {
		fs.mkdirSync(path.dirname(COVERAGE_LOCK_FILE), { recursive: true });
		// 'wx' = exclusive create: fails with EEXIST if the file is already there (atomic, OS-agnostic)
		fs.writeFileSync(COVERAGE_LOCK_FILE, String(process.pid), { flag: "wx", encoding: "utf8" });
	} catch (err) {
		if (err.code === "EEXIST") {
			const ownerPid = (() => {
				try {
					return fs.readFileSync(COVERAGE_LOCK_FILE, "utf8").trim();
				} catch {
					return "(unknown)";
				}
			})();
			console.error(`\n❌  Coverage run already in progress (PID ${ownerPid}).`);
			console.error(`    Only one coverage run may execute at a time.`);
			console.error(`    Lock file: ${COVERAGE_LOCK_FILE}`);
			console.error(`    If no run is active, delete the lock file and retry.\n`);
			process.exit(1);
		}
		throw err;
	}
}

/**
 * Release the coverage run lock by removing the lock file.
 * Safe to call multiple times — silently ignores missing-file errors.
 *
 * @returns {void}
 * @example
 * releaseCoverageLock(); // removes tmp/.coverage-lock
 */
function releaseCoverageLock() {
	try {
		fs.unlinkSync(COVERAGE_LOCK_FILE);
	} catch {
		// Already removed or never existed — both are fine
	}
}
const DEFAULT_TEST_DIR = "tests/vitests/suites";
const BASELINE_PATH = "tests/vitests/baseline-tests.json";
const DEFAULT_VITEST_CONFIG = ".configs/vitest.config.mjs";

const SOLO_RUN_PATTERNS = [
	// "listener-cleanup/",
	"lazy/lazy-background-materialization.test.vitest.mjs",
	"api-manager/api-manager-reload-coverage.test.vitest.mjs",
	"tests/vitests/suites/listener-cleanup/third-party-cleanup.test.vitest.mjs",
	"tests/vitests/suites/metadata/metadata-edge-cases.test.vitest.mjs"
];
const PER_FILE_HEAP_OVERRIDES = [{ pattern: "listener-cleanup/", heapMb: 6144 }];

/**
 * Print CLI help for the compatibility wrapper.
 * @returns {void} Prints help text to stdout.
 * @example
 * showHelp();
 */
function showHelp() {
	console.log(`
Slothlet Vitest Test Runner (v2)
Delegates execution to @cldmv/vitest-runner while preserving legacy flags.

USAGE:
  node tests/vitests/run-all-vitest.mjs [OPTIONS] [PATTERNS]

LEGACY FLAGS:
  --baseline              Run tests from tests/vitests/baseline-tests.json
  --no-error-details      Hide detailed error output
  --coverage-quiet        Implies --coverage and shows condensed output
  --help, -h              Show this help message

RUNNER FLAGS (forwarded to @cldmv/vitest-runner API):
  --workers <n>           Number of workers (overrides VITEST_WORKERS)
  --solo-pattern <pat>    Add extra solo pattern (repeatable)
  --test-list <file>      JSON list of test files
  --file-pattern <regex>  Custom discovery regex
  --log-file <path>       Mirror output log path (quiet coverage mode)

VITEST FLAGS:
  Unknown flags are passed through to Vitest as-is.

EXAMPLES:
  node tests/vitests/run-all-vitest.mjs --baseline
  node tests/vitests/run-all-vitest.mjs suites/config/background-materialize.test.vitest.mjs
  node tests/vitests/run-all-vitest.mjs --workers 2 suites/context
  node tests/vitests/run-all-vitest.mjs -t "lazy materialization"
`);
}

/**
 * Parse CLI arguments into runner options, vitest passthrough args, and test patterns.
 * @param {string[]} args - Raw process arguments excluding node and script path.
 * @returns {{
 * 	help: boolean,
 * 	baseline: boolean,
 * 	showErrorDetails: boolean,
 * 	coverageQuiet: boolean,
 * 	workers: number,
 * 	testListFile?: string,
 * 	testFilePattern?: RegExp,
 * 	logFile?: string,
 * 	earlyRunPatterns: string[],
 * 	vitestArgs: string[],
 * 	testPatterns: string[]
 * }} Parsed argument groups.
 * @example
 * const parsed = parseArguments(["--baseline", "--workers", "2", "suites/config"]);
 */
function parseArguments(args) {
	let help = false;
	let baseline = false;
	let showErrorDetails = true;
	let coverageQuiet = false;
	let workers = DEFAULT_WORKERS;
	let testListFile;
	let testFilePattern;
	let logFile;
	const earlyRunPatterns = [...SOLO_RUN_PATTERNS];
	const vitestArgs = [];
	const testPatterns = [];

	for (let i = 0; i < args.length; i++) {
		const arg = args[i];

		if (arg === "--help" || arg === "-h") {
			help = true;
			continue;
		}

		if (arg === "--baseline") {
			baseline = true;
			continue;
		}

		if (arg === "--no-error-details") {
			showErrorDetails = false;
			continue;
		}

		if (arg === "--coverage-quiet") {
			coverageQuiet = true;
			continue;
		}

		if (arg === "--workers") {
			const next = args[i + 1];
			if (next && !next.startsWith("-")) {
				workers = parseInt(next, 10);
				i++;
			}
			continue;
		}

		if (arg.startsWith("--workers=")) {
			workers = parseInt(arg.split("=").slice(1).join("="), 10);
			continue;
		}

		if (arg === "--solo-pattern") {
			const next = args[i + 1];
			if (next && !next.startsWith("-")) {
				earlyRunPatterns.push(next);
				i++;
			}
			continue;
		}

		if (arg.startsWith("--solo-pattern=")) {
			earlyRunPatterns.push(arg.split("=").slice(1).join("="));
			continue;
		}

		if (arg === "--test-list") {
			const next = args[i + 1];
			if (next && !next.startsWith("-")) {
				testListFile = next;
				i++;
			}
			continue;
		}

		if (arg.startsWith("--test-list=")) {
			testListFile = arg.split("=").slice(1).join("=");
			continue;
		}

		if (arg === "--file-pattern") {
			const next = args[i + 1];
			if (next && !next.startsWith("-")) {
				testFilePattern = new RegExp(next, "i");
				i++;
			}
			continue;
		}

		if (arg.startsWith("--file-pattern=")) {
			testFilePattern = new RegExp(arg.split("=").slice(1).join("="), "i");
			continue;
		}

		if (arg === "--log-file") {
			const next = args[i + 1];
			if (next && !next.startsWith("-")) {
				logFile = next;
				i++;
			}
			continue;
		}

		if (arg.startsWith("--log-file=")) {
			logFile = arg.split("=").slice(1).join("=");
			continue;
		}

		if (arg.startsWith("-")) {
			vitestArgs.push(arg);
			if (i + 1 < args.length && !args[i + 1].startsWith("-")) {
				vitestArgs.push(args[i + 1]);
				i++;
			}
			continue;
		}

		testPatterns.push(arg);
	}

	if (!Number.isFinite(workers) || workers <= 0) {
		workers = DEFAULT_WORKERS;
	}

	return {
		help,
		baseline,
		showErrorDetails,
		coverageQuiet,
		workers,
		testListFile,
		testFilePattern,
		logFile,
		earlyRunPatterns,
		vitestArgs,
		testPatterns
	};
}

/**
 * Normalize legacy test pattern shortcuts into paths discoverable from project root.
 * @param {string[]} patterns - Incoming test patterns from CLI.
 * @returns {string[]} Normalized patterns.
 * @example
 * normalizePatterns(["suites/config"]);
 */
function normalizePatterns(patterns) {
	return patterns.map((pattern) => {
		if (pattern.startsWith("tests/vitests/")) {
			return pattern;
		}

		if (pattern.startsWith("suites/")) {
			return `tests/vitests/${pattern}`;
		}

		return pattern;
	});
}

/**
 * Build runner options for @cldmv/vitest-runner from parsed compatibility args.
 * @param {ReturnType<typeof parseArguments>} parsed - Parsed CLI arguments.
 * @returns {import("@cldmv/vitest-runner").RunOptions} Fully resolved runner options.
 * @example
 * const options = buildRunOptions(parseArguments(process.argv.slice(2)));
 */
function buildRunOptions(parsed) {
	const hasCoverage = parsed.vitestArgs.some((arg) => arg === "--coverage" || arg.startsWith("--coverage."));
	const normalizedPatterns = normalizePatterns(parsed.testPatterns);

	const maxOldSpaceMb = process.env.VITEST_HEAP_MB ? parseInt(process.env.VITEST_HEAP_MB, 10) : undefined;

	const runOptions = {
		cwd: projectRoot,
		testDir: DEFAULT_TEST_DIR,
		vitestConfig: DEFAULT_VITEST_CONFIG,
		workers: parsed.workers,
		showErrorDetails: parsed.showErrorDetails,
		coverageQuiet: parsed.coverageQuiet,
		worstCoverageCount: 10,
		testPatterns: normalizedPatterns,
		vitestArgs: [...parsed.vitestArgs],
		earlyRunPatterns: parsed.earlyRunPatterns,
		perFileHeapOverrides: PER_FILE_HEAP_OVERRIDES,
		conditions: ["slothlet-dev"],
		nodeEnv: process.env.NODE_ENV || "development"
	};

	if (maxOldSpaceMb && Number.isFinite(maxOldSpaceMb)) {
		runOptions.maxOldSpaceMb = maxOldSpaceMb;
	}

	if (parsed.baseline && !parsed.testListFile) {
		runOptions.testListFile = BASELINE_PATH;
	}

	if (parsed.testListFile) {
		runOptions.testListFile = parsed.testListFile;
	}

	if (parsed.testFilePattern) {
		runOptions.testFilePattern = parsed.testFilePattern;
	}

	if (parsed.logFile) {
		runOptions.logFile = parsed.logFile;
	}

	if (parsed.coverageQuiet && !hasCoverage) {
		runOptions.vitestArgs.unshift("--coverage");
	}

	return runOptions;
}

/**
 * Execute the compatibility runner.
 * @returns {Promise<void>} Resolves when process exits.
 * @example
 * await main();
 */
async function main() {
	const parsed = parseArguments(process.argv.slice(2));

	if (parsed.help) {
		showHelp();
		process.exit(0);
	}

	const isCoverageRun =
		parsed.coverageQuiet || parsed.vitestArgs.some((arg) => arg === "--coverage" || arg.startsWith("--coverage."));

	if (isCoverageRun) {
		acquireCoverageLock();

		// Release lock on any form of process exit (normal, signal, or uncaught error)
		const onExit = () => releaseCoverageLock();
		process.once("exit", onExit);
		process.once("SIGINT", () => {
			releaseCoverageLock();
			process.exit(130);
		});
		process.once("SIGTERM", () => {
			releaseCoverageLock();
			process.exit(143);
		});
	}

	const code = await run(buildRunOptions(parsed));
	process.exit(code);
}

main().catch((error) => {
	console.error("Fatal error:", error);
	process.exit(1);
});
