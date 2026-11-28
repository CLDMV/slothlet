/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: tests/vitests/run-all-vitest.mjs
 *	@Date: 2026-01-12T23:44:38-08:00 (1768290278)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:31:03-08:00 (1795869063)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
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
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { run } from "@cldmv/vitest-runner";
import { cleanTmpArtifacts } from "../lib/clean-tmp-artifacts.mjs";
import { stageI18nPack, STAGED_ENV } from "./setup/i18n-pack-fixture.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..", "..");

const DEFAULT_WORKERS = process.env.VITEST_WORKERS ? parseInt(process.env.VITEST_WORKERS, 10) : 4;

/**
 * Memory each worker is budgeted on CI, in MB. A worker's heap peaks around 1–3 GB on the heavier
 * suites, and the hosted runner (4 cores, 16 GB) has to keep its own agent alive alongside them:
 * eight workers starved it until GitHub dropped the runner mid-run ("The hosted runner lost
 * communication with the server"). `VITEST_CI_WORKER_MB` overrides.
 * @type {number}
 */
const CI_WORKER_MB = process.env.VITEST_CI_WORKER_MB ? parseInt(process.env.VITEST_CI_WORKER_MB, 10) : 3072;

/**
 * Cap the worker count to what the CI machine can hold. Outside CI the requested count is kept.
 * @param {number} requested - Worker count from `--workers` or `VITEST_WORKERS`.
 * @param {NodeJS.ProcessEnv} [env=process.env] - Environment to read `CI` from.
 * @returns {number} Worker count to run with, at least 1.
 * @example
 * ciWorkerBudget(8, { CI: "true" }); // 4 on a 4-core, 16 GB runner
 */
function ciWorkerBudget(requested, env = process.env) {
	if (!env.CI || env.CI === "false") return requested;
	const byMemory = Math.floor(os.totalmem() / (1024 * 1024) / CI_WORKER_MB);
	const byCpu = os.availableParallelism();
	return Math.max(1, Math.min(requested, byMemory, byCpu));
}

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

/**
 * Heap ceiling for the runner's coverage merge step, in MB (`VITEST_MERGE_HEAP_MB` overrides).
 * The merge reads every per-file blob into one process; at ~800 files it outgrew 8 GB, so it
 * gets 12 GB. It runs once, after all test workers have exited, so the larger heap does not
 * raise the run's peak memory. The runner applies it to the merge only, never to the workers.
 * @type {number}
 */
const MERGE_HEAP_MB = 12288;

/**
 * Escape all regex metacharacters in a string so it can be safely used
 * as a literal pattern inside `new RegExp()`.
 * This prevents regex injection when the value comes from user-controlled
 * CLI input (e.g. --file-pattern).
 * @param {string} string - Raw user input to escape.
 * @returns {string} String with all regex metacharacters escaped.
 * @example
 * escapeRegExp("foo.bar"); // "foo\\.bar"
 * escapeRegExp("a|b");    // "a\\|b"
 */
function escapeRegExp(string) {
	return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const SOLO_RUN_PATTERNS = [
	// "listener-cleanup/",
	"lazy/lazy-background-materialization.test.vitest.mjs",
	"api-manager/api-manager-reload-coverage.test.vitest.mjs",
	"tests/vitests/suites/listener-cleanup/third-party-cleanup.test.vitest.mjs",
	"tests/vitests/suites/metadata/metadata-edge-cases.test.vitest.mjs",
	"tests/vitests/suites/context/per-request-context.test.vitest.mjs",
	// i18n-pack-resolution writes into node_modules/@cldmv/slothlet-i18n's own pack directory
	// (staging/corrupting/restoring locale files to test pack-resolution fallbacks). Under a full
	// parallel run this races with anything else touching that shared directory concurrently
	// (ENOENT / pack-not-loaded failures, non-deterministic) — passes cleanly in isolation, so it
	// runs solo like the other shared-mutable-state files above, not because it's flaky.
	"tests/vitests/suites/i18n/i18n-pack-resolution.test.vitest.mjs",
	// typescript-strict-mode's Function Execution beforeEach boots slothlet with TypeScript type
	// generation (a forked tsc compile) per test. Under a full parallel run the fork is starved by
	// the other workers and exceeds vitest's 10s hook timeout (passes 13/13 in isolation), so it
	// runs solo like the other resource-heavy files.
	"tests/vitests/suites/typescript/typescript-strict-mode.test.vitest.mjs",
	// typescript-options-strict boots strict mode (a forked tsc type-generation pass plus the type
	// check) once per test, for the same reason as typescript-strict-mode above.
	"tests/vitests/suites/typescript/typescript-options-strict.test.vitest.mjs",
	// typegen-programmatic runs generateTypes per test — two `ts.Program`s (checker + declaration
	// emit) plus a `tsc` compile of the output in the acceptance check. Under a full parallel run
	// those tsc passes are starved by the other workers and blow past the test timeout (each takes
	// ~3s in isolation), so it runs solo like typescript-strict-mode above.
	"tests/vitests/suites/typegen/typegen-programmatic.test.vitest.mjs",
	// The four metadata suites below each build a slothlet instance per test across every LAZY* config
	// (45-120s per file in isolation, 1-3 GB heap). Under the full sharded run on a CI runner the
	// beforeEach instance build is starved by the other workers and exceeds the 10s hook timeout
	// (a different test in each file on the Node 24 leg of PR #830). They pass in isolation and time the
	// same on next and on the PR branch, so this is starvation, not a regression: they run solo like
	// metadata-edge-cases above.
	"tests/vitests/suites/metadata/system-metadata.test.vitest.mjs",
	"tests/vitests/suites/metadata/user-metadata.test.vitest.mjs",
	"tests/vitests/suites/metadata/metadata-reload.test.vitest.mjs",
	"tests/vitests/suites/metadata/metadata-external-api.test.vitest.mjs"
];
const PER_FILE_HEAP_OVERRIDES = [
	{ pattern: "listener-cleanup/", heapMb: 6144 },
	// metadata-edge-cases composes 176 instances (22 cases × 8 matrix configs, one at a time with
	// proper afterEach shutdown) and peaks ~1.2 GB heap. It is already solo (SOLO_RUN_PATTERNS), but
	// under coverage instrumentation it sits at the default-heap edge and intermittently OOM-flakes
	// its LAZY_LIVE config (passes 176/176 in isolation). Headroom is the remaining lever.
	{ pattern: "metadata/metadata-edge-cases", heapMb: 6144 }
];

/**
 * Time limit per test file, in ms, for @cldmv/vitest-runner's watchdog (`VITEST_FILE_TIMEOUT`, in
 * seconds, overrides). The runner's own default of 30 minutes is too close for the slowest suites on a
 * 4-core CI runner: in a plain (no coverage) Node 22 run on next, all-api-structures took 23.5 minutes and
 * api-root-integrity, reload-held-code and permissions-sync-leaf-thenable 12–15, and coverage runs are
 * slower. Those files are now split so each runs in a few minutes; this limit is kept as headroom. The idle
 * limit stays at the runner's 10 minutes: every file prints as its tests finish.
 * @type {number}
 */
const FILE_TIMEOUT_MS = 60 * 60 * 1000;

/**
 * Per-file watchdog limits for files that outgrow {@link FILE_TIMEOUT_MS}.
 * @type {Array<{ pattern: string, timeoutMs?: number, idleTimeoutMs?: number }>}
 */
const PER_FILE_TIMEOUT_OVERRIDES = [];

// Scratch dirs (gitignored, same pair the repo's own eslint/prettier ignores use) that test
// discovery must never enter. `tmp/` holds per-agent git worktrees (tmp/agents/*/wt) and staged
// fixtures — each carries its own full copy of tests/vitests/suites, which partial-path pattern
// resolution could otherwise match and run against the wrong (worktree's) tree. `trash/` is the
// same class of scratch bucket. See @cldmv/vitest-runner's `exclude` option.
const DEFAULT_EXCLUDE_PATTERNS = ["tmp/**", "trash/**"];

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
  --exclude <glob>        Add extra discovery-exclude glob, relative to cwd (repeatable;
                          default: tmp/**, trash/**)
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

/** Matches a vitest test file name in this repo. */
const TEST_FILE_PATTERN = /\.test\.vitest\.[cm]?js$/i;

/**
 * List every test file under `tests/vitests`, as project-relative forward-slash paths.
 * @returns {string[]} Test file paths.
 * @example
 * const files = listTestFiles();
 */
function listTestFiles() {
	const base = path.join(projectRoot, DEFAULT_TEST_DIR);
	if (!fs.existsSync(base)) return [];
	return fs
		.readdirSync(base, { recursive: true })
		.map((entry) => String(entry).replace(/\\/g, "/"))
		.filter((entry) => TEST_FILE_PATTERN.test(entry) && !entry.split("/").includes("node_modules"))
		.map((entry) => `${DEFAULT_TEST_DIR}/${entry}`.replace(/\\/g, "/"));
}

/**
 * Whether an argument names a test file, folder or path pattern, so it is a selector and never a flag's value.
 * @param {string} arg - Raw CLI argument (not starting with "-").
 * @returns {boolean} True when it should be treated as a test selector.
 * @example
 * isTestSelector("suites/config"); // true
 * isTestSelector("verbose"); // false
 */
function isTestSelector(arg) {
	if (TEST_FILE_PATTERN.test(arg)) return true;
	const [normalized] = normalizePatterns([arg]);
	if (fs.existsSync(path.resolve(projectRoot, arg)) || fs.existsSync(path.resolve(projectRoot, normalized))) return true;
	if (!arg.includes("/")) return false;
	return listTestFiles().some((file) => file.includes(normalized.replace(/\\/g, "/")));
}

/**
 * Find selectors that match no test file: not an existing test file, not a folder holding one, and not a
 * substring of any test file path.
 * @param {string[]} patterns - Test selectors from the CLI.
 * @returns {string[]} The selectors that matched nothing.
 * @example
 * findUnmatchedSelectors(["suites/config", "suites/nope"]); // ["suites/nope"]
 */
export function findUnmatchedSelectors(patterns) {
	const files = listTestFiles();
	return patterns.filter((pattern) => {
		const [normalized] = normalizePatterns([pattern]);
		const needle = normalized.replace(/\\/g, "/").replace(/\/+$/, "");
		return !files.some((file) => file.includes(needle));
	});
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
 * 	excludePatterns: string[],
 * 	vitestArgs: string[],
 * 	testPatterns: string[]
 * }} Parsed argument groups.
 * @example
 * const parsed = parseArguments(["--baseline", "--workers", "2", "suites/config"]);
 */
export function parseArguments(args) {
	let help = false;
	let baseline = false;
	let showErrorDetails = true;
	let coverageQuiet = false;
	let workers = DEFAULT_WORKERS;
	let testListFile;
	let testFilePattern;
	let logFile;
	const earlyRunPatterns = [...SOLO_RUN_PATTERNS];
	const excludePatterns = [...DEFAULT_EXCLUDE_PATTERNS];
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

		if (arg === "--exclude") {
			const next = args[i + 1];
			if (next && !next.startsWith("-")) {
				excludePatterns.push(next);
				i++;
			}
			continue;
		}

		if (arg.startsWith("--exclude=")) {
			excludePatterns.push(arg.split("=").slice(1).join("="));
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
				testFilePattern = new RegExp(escapeRegExp(next), "i");
				i++;
			}
			continue;
		}

		if (arg.startsWith("--file-pattern=")) {
			testFilePattern = new RegExp(escapeRegExp(arg.split("=").slice(1).join("=")), "i");
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
			// `--name=value` carries its own value; a bare flag takes the next argument as its value
			// only when that argument isn't a test selector.
			if (!arg.includes("=") && i + 1 < args.length && !args[i + 1].startsWith("-") && !isTestSelector(args[i + 1])) {
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
		excludePatterns,
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
 * Collect the values of every `--coverage.include` argument (`=value` or separate value form).
 * @param {string[]} vitestArgs - Vitest passthrough arguments.
 * @returns {string[]} The include globs, in order.
 * @example
 * coverageIncludeFromArgs(["--coverage.include=src/a.mjs"]); // ["src/a.mjs"]
 */
export function coverageIncludeFromArgs(vitestArgs) {
	const includes = [];
	for (let i = 0; i < vitestArgs.length; i++) {
		const arg = vitestArgs[i];
		if (arg.startsWith("--coverage.include=")) {
			includes.push(arg.slice("--coverage.include=".length));
		} else if (arg === "--coverage.include" && i + 1 < vitestArgs.length) {
			includes.push(vitestArgs[++i]);
		}
	}
	return includes;
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
		exclude: parsed.excludePatterns,
		perFileHeapOverrides: PER_FILE_HEAP_OVERRIDES,
		perFileTimeoutOverrides: PER_FILE_TIMEOUT_OVERRIDES,
		conditions: ["slothlet-dev"],
		nodeEnv: process.env.NODE_ENV || "development"
	};

	// An explicit option would shadow VITEST_FILE_TIMEOUT, so only set it when the env var is absent.
	if (!process.env.VITEST_FILE_TIMEOUT) {
		runOptions.fileTimeoutMs = FILE_TIMEOUT_MS;
	}

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

	// The runner merges the blobs itself, with its own heap ceiling, and writes
	// coverage/coverage-index.json. An explicit option would shadow VITEST_MERGE_HEAP_MB, so only set
	// it when the env var is absent.
	if (!process.env.VITEST_MERGE_HEAP_MB) {
		runOptions.mergeMaxOldSpaceMb = MERGE_HEAP_MB;
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

	const budgeted = ciWorkerBudget(parsed.workers);
	if (budgeted !== parsed.workers) {
		console.log(
			`🧮 CI: running ${budgeted} workers instead of ${parsed.workers} (${os.availableParallelism()} cores, ${Math.round(os.totalmem() / 1024 ** 3)} GB)`
		);
		parsed.workers = budgeted;
	}

	// Precheck: sweep stale per-run temp folders left behind by crashed/killed runs.
	cleanTmpArtifacts({ projectRoot });

	const isCoverageRun = parsed.coverageQuiet || parsed.vitestArgs.some((arg) => arg === "--coverage" || arg.startsWith("--coverage."));

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

	// Stage the optional @cldmv/slothlet-i18n pack ONCE, before any worker spawns, and tear it down on
	// exit (an "exit" handler survives the process.exit below). Suites that need it assert STAGED_ENV and
	// fail loudly when run bare. This replaces the old per-test-file beforeAll/afterAll staging that raced
	// across forks and could clobber a real install. See tests/vitests/setup/i18n-pack-fixture.mjs.
	const restoreI18nPack = stageI18nPack(projectRoot);
	process.env[STAGED_ENV] = "1";
	process.once("exit", restoreI18nPack);

	// Selectors that match no test file must fail loudly, never fall back to the whole suite.
	if (parsed.testPatterns.length > 0 && !parsed.testListFile && !parsed.baseline) {
		const unmatched = findUnmatchedSelectors(parsed.testPatterns);
		if (unmatched.length === parsed.testPatterns.length) {
			console.error(`❌ No test files match: ${unmatched.join(", ")}`);
			process.exit(1);
		}
	}

	// The runner hands `--coverage.*` args only to the merge step, so the per-file runs would still
	// collect all of src/. The vitest config reads this variable for `coverage.include` instead.
	const coverageInclude = coverageIncludeFromArgs(parsed.vitestArgs);
	if (coverageInclude.length > 0) {
		process.env.SLOTHLET_COVERAGE_INCLUDE = JSON.stringify(coverageInclude);
	}

	const runOptions = buildRunOptions(parsed);
	const code = await run(runOptions);
	process.exit(code);
}

// Run only as the entry script, so tests can import parseArguments without starting a run.
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
	main().catch((error) => {
		console.error("Fatal error:", error);
		process.exit(1);
	});
}
