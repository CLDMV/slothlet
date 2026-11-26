/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tools/coverage/coverage-file.mjs
 *	@Date: 2026-11-25T11:45:29-08:00 (1795635929)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-25T12:07:49-08:00 (1795637269)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Re-measure the coverage of one source file by running only the test files that reach it.
 * @module tools/coverage/coverage-file
 * @internal
 *
 * @description
 * A coverage run writes `coverage/coverage-index.json` (from @cldmv/vitest-runner): for every source
 * file, each function and the test files that executed it. This script looks a source file (or one of
 * its functions) up in that index, runs just those test files through `npm run coverage:node`, and
 * prints the file's uncovered lines with `tools/coverage/analyze-coverage.mjs`.
 *
 * The index comes from `--index <path>`, else `coverage/coverage-index.json` when it was written for the
 * current HEAD, else the index CI publishes for `--branch` (default `next`) on the badges branch.
 *
 * @example
 * npm run coverage:file -- src/lib/helpers/module-sort.mjs
 * npm run coverage:file -- src/lib/helpers/module-sort.mjs --fn sortModules --dry-run
 * npm run coverage:file -- src/lib/helpers/module-sort.mjs -- --workers 2
 */

import fs from "node:fs";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const PROJECT_ROOT = path.resolve(path.dirname(__filename), "..", "..");

/** Local index written by a coverage run, relative to the project root. */
export const LOCAL_INDEX = "coverage/coverage-index.json";

/** Base URL of the files CI publishes to the badges branch. */
export const PUBLISHED_BASE_URL = "https://raw.githubusercontent.com/CLDMV/slothlet/badges";

/** Published index file name per branch. */
export const PUBLISHED_INDEX_FILES = {
	next: "coverage-index-next.json",
	master: "coverage-index.json",
	hotfixes: "coverage-index-hotfixes.json"
};

/** Index layout version this script reads. */
const INDEX_VERSION = 1;

const USAGE = `Usage: npm run coverage:file -- <src file> [--fn <name>] [--branch next|master|hotfixes] [--index <path>] [--dry-run] [-- <coverage:node args>]

  <src file>         Source file to re-measure, e.g. src/lib/helpers/module-sort.mjs
  --fn <name>        Only the tests that reach this function (name, or name@line for a repeated name)
  --branch <name>    Published index to fall back on: next (default), master or hotfixes
  --index <path>     Read this index file instead
  --dry-run          Print the tests that would run, and stop
  -- <args>          Passed on to npm run coverage:node (e.g. -- --workers 2)`;

/**
 * Error with a message meant for the user, printed without a stack.
 */
export class CoverageFileError extends Error {}

/**
 * Parse the command line.
 * @param {string[]} argv - Arguments after the script path.
 * @returns {{ help: boolean, file: string|null, fn: string|null, branch: string, index: string|null, dryRun: boolean, passthrough: string[] }}
 * @throws {CoverageFileError} On an unknown flag, a missing flag value, a bad branch, or more than one source file.
 * @example
 * parseArgs(["src/a.mjs", "--fn", "run"]); // { file: "src/a.mjs", fn: "run", branch: "next", ... }
 */
export function parseArgs(argv) {
	const out = { help: false, file: null, fn: null, branch: "next", index: null, dryRun: false, passthrough: [] };
	/**
	 * Value of a `--flag value` / `--flag=value` pair.
	 * @param {string} flag - Flag name.
	 * @param {string} arg - Current argument.
	 * @param {number} i - Its index.
	 * @returns {[string, number]} The value and the index of the last argument consumed.
	 */
	const valueOf = (flag, arg, i) => {
		if (arg.startsWith(`${flag}=`)) return [arg.slice(flag.length + 1), i];
		const next = argv[i + 1];
		if (next === undefined || next.startsWith("-")) throw new CoverageFileError(`${flag} needs a value`);
		return [next, i + 1];
	};

	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i];
		if (arg === "--") {
			out.passthrough = argv.slice(i + 1);
			break;
		}
		if (arg === "--help" || arg === "-h") out.help = true;
		else if (arg === "--dry-run") out.dryRun = true;
		else if (arg === "--fn" || arg.startsWith("--fn=")) [out.fn, i] = valueOf("--fn", arg, i);
		else if (arg === "--index" || arg.startsWith("--index=")) [out.index, i] = valueOf("--index", arg, i);
		else if (arg === "--branch" || arg.startsWith("--branch=")) {
			[out.branch, i] = valueOf("--branch", arg, i);
			if (!Object.hasOwn(PUBLISHED_INDEX_FILES, out.branch)) {
				throw new CoverageFileError(`Unknown branch "${out.branch}": use ${Object.keys(PUBLISHED_INDEX_FILES).join(", ")}`);
			}
		} else if (arg.startsWith("-")) throw new CoverageFileError(`Unknown option ${arg}`);
		else if (out.file) throw new CoverageFileError(`One source file at a time (got ${out.file} and ${arg})`);
		else out.file = arg;
	}
	return out;
}

/**
 * The source file as the index keys it: relative to the project root, with forward slashes.
 * @param {string} file - Path as given (relative to cwd, or absolute).
 * @param {{ root?: string, cwd?: string }} [opts]
 * @returns {string} Project-relative path.
 * @throws {CoverageFileError} When the file doesn't exist or lies outside the project.
 * @example
 * toIndexPath("./src/lib/helpers/segments.mjs"); // "src/lib/helpers/segments.mjs"
 */
export function toIndexPath(file, { root = PROJECT_ROOT, cwd = process.cwd() } = {}) {
	const abs = path.resolve(cwd, file);
	const rel = path.relative(root, abs);
	if (rel.startsWith("..") || path.isAbsolute(rel)) throw new CoverageFileError(`${file} is outside the project`);
	if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) throw new CoverageFileError(`No such file: ${file}`);
	return rel.split(path.sep).join("/");
}

/**
 * Check an index's layout.
 * @param {unknown} index - Parsed JSON.
 * @param {string} source - Where it came from, for the error message.
 * @returns {{ version: number, commit: string|null, files: Record<string, Record<string, string[]>> }} The index.
 * @throws {CoverageFileError} When it isn't a version 1 coverage index.
 */
export function validateIndex(index, source) {
	const ok = index && typeof index === "object" && index.version === INDEX_VERSION && index.files && typeof index.files === "object";
	if (!ok) throw new CoverageFileError(`${source} is not a version ${INDEX_VERSION} coverage index`);
	return /** @type {any} */ (index);
}

/**
 * Current HEAD commit, or null outside a git checkout.
 * @param {string} [root=PROJECT_ROOT]
 * @returns {string|null}
 */
export function headCommit(root = PROJECT_ROOT) {
	try {
		return execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim() || null;
	} catch {
		return null;
	}
}

/**
 * Load the index: `--index`, else the local one when it was written for `head`, else the published one for `branch`.
 * @param {{ index?: string|null, branch?: string, root?: string, head?: string|null, fetchImpl?: typeof fetch }} opts
 * @returns {Promise<{ index: { version: number, commit: string|null, files: Record<string, Record<string, string[]>> }, source: string }>}
 * @throws {CoverageFileError} When no index can be read.
 * @example
 * const { index, source } = await loadIndex({ branch: "next", head: headCommit() });
 */
export async function loadIndex({ index = null, branch = "next", root = PROJECT_ROOT, head = null, fetchImpl = globalThis.fetch } = {}) {
	if (index) {
		const file = path.resolve(index);
		if (!fs.existsSync(file)) throw new CoverageFileError(`Index not found: ${index}`);
		return { index: validateIndex(readJson(file), index), source: index };
	}

	const localFile = path.join(root, LOCAL_INDEX);
	const local = fs.existsSync(localFile) ? validateIndex(readJson(localFile), LOCAL_INDEX) : null;
	if (local && head && local.commit === head) return { index: local, source: LOCAL_INDEX };

	const url = `${PUBLISHED_BASE_URL}/${PUBLISHED_INDEX_FILES[branch]}`;
	try {
		return { index: await fetchIndex(url, fetchImpl), source: url };
	} catch (err) {
		// An older local index beats none; the caller warns that it isn't for HEAD.
		if (local) return { index: local, source: `${LOCAL_INDEX} (${err.message})` };
		throw new CoverageFileError(`${err.message} Pass --index <path> to read an index file.`);
	}
}

/**
 * Fetch and check a published index.
 * @param {string} url
 * @param {typeof fetch} fetchImpl
 * @returns {Promise<{ version: number, commit: string|null, files: Record<string, Record<string, string[]>> }>}
 * @throws {CoverageFileError} When it can't be fetched or isn't an index.
 */
async function fetchIndex(url, fetchImpl) {
	let response;
	try {
		response = await fetchImpl(url);
	} catch (err) {
		throw new CoverageFileError(`Couldn't fetch ${url}: ${err?.message ?? err}.`);
	}
	if (!response.ok) throw new CoverageFileError(`No published index at ${url} (HTTP ${response.status}).`);
	let parsed;
	try {
		parsed = await response.json();
	} catch {
		throw new CoverageFileError(`${url} is not JSON.`);
	}
	return validateIndex(parsed, url);
}

/**
 * Read and parse a JSON file.
 * @param {string} file - Absolute path.
 * @returns {unknown}
 * @throws {CoverageFileError} When it isn't valid JSON.
 */
function readJson(file) {
	try {
		return JSON.parse(fs.readFileSync(file, "utf8"));
	} catch (err) {
		throw new CoverageFileError(`Couldn't read ${file}: ${err?.message ?? err}`);
	}
}

/**
 * Warning text when the index wasn't written for HEAD, else null.
 * @param {{ commit: string|null }} index
 * @param {string|null} head
 * @returns {string|null}
 * @example
 * staleWarning({ commit: "abc" }, "def"); // "Index is for abc, HEAD is def: ..."
 */
export function staleWarning(index, head) {
	if (!head) return null;
	if (!index.commit) return "The index records no commit, so it can't be checked against HEAD.";
	if (index.commit === head) return null;
	return `The index is for ${index.commit.slice(0, 12)}, HEAD is ${head.slice(0, 12)}: tests added or changed since may be missing from the list.`;
}

/**
 * The test files that reach a source file, or one of its functions.
 * @param {{ files: Record<string, Record<string, string[]>> }} index
 * @param {string} file - Project-relative source path.
 * @param {string|null} [fn] - Function name, or `name@line`; a bare name matches every `name@line` entry.
 * @returns {{ tests: string[], functions: string[] }} Sorted unique test files, and the index keys matched.
 * @throws {CoverageFileError} When the file isn't in the index or has no such function.
 * @example
 * lookupTests(index, "src/lib/helpers/module-sort.mjs", "sortModules");
 */
export function lookupTests(index, file, fn = null) {
	const functions = index.files[file];
	if (!functions) throw new CoverageFileError(`${file} is not in the coverage index (not under coverage, or no test loads it)`);
	const keys = Object.keys(functions).filter((key) => !fn || key === fn || key.startsWith(`${fn}@`));
	if (fn && keys.length === 0) {
		throw new CoverageFileError(`${file} has no function "${fn}" in the index. Known: ${Object.keys(functions).join(", ") || "(none)"}`);
	}
	const tests = new Set();
	for (const key of keys) for (const test of functions[key]) tests.add(test);
	return { tests: [...tests].sort(), functions: keys };
}

/**
 * Run the command line.
 * @param {string[]} argv - Arguments after the script path.
 * @returns {Promise<number>} Exit code.
 */
export async function main(argv) {
	const args = parseArgs(argv);
	if (args.help) {
		console.log(USAGE);
		return 0;
	}
	if (!args.file) throw new CoverageFileError(`Missing the source file.\n\n${USAGE}`);

	const file = toIndexPath(args.file);
	const head = headCommit();
	const { index, source } = await loadIndex({ index: args.index, branch: args.branch, head });
	console.log(`🗂️  Coverage index: ${source}`);
	const warning = staleWarning(index, head);
	if (warning) console.warn(`⚠️  ${warning}`);

	const { tests, functions } = lookupTests(index, file, args.fn);
	const target = args.fn ? `${file} (${functions.join(", ")})` : file;
	if (tests.length === 0) {
		console.log(`No test reaches ${target}.`);
		return 1;
	}
	const missing = tests.filter((test) => !fs.existsSync(path.join(PROJECT_ROOT, test)));
	if (missing.length > 0) console.warn(`⚠️  Not in this checkout, skipped: ${missing.join(", ")}`);
	const runnable = tests.filter((test) => !missing.includes(test));

	console.log(`🧪 ${runnable.length} test file(s) reach ${target}:`);
	for (const test of runnable) console.log(`   ${test}`);
	if (args.dryRun || runnable.length === 0) return runnable.length === 0 ? 1 : 0;

	// The runner wrapper doesn't yet narrow coverage with --coverage.include (#954), so the run
	// measures the whole src tree and the report below is filtered to the one file.
	const npm = process.platform === "win32" ? "npm.cmd" : "npm";
	const run = spawnSync(npm, ["run", "coverage:node", "--", ...runnable, ...args.passthrough], { cwd: PROJECT_ROOT, stdio: "inherit" });
	if (run.status !== 0) console.warn(`⚠️  coverage:node exited ${run.status ?? run.signal}; the report below may be partial.`);

	const { generateReport } = await import("./analyze-coverage.mjs");
	await generateReport({ coverageFile: path.join(PROJECT_ROOT, "coverage", "coverage-final.json"), only: [path.join(PROJECT_ROOT, file)] });
	return run.status ?? 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
	main(process.argv.slice(2)).then(
		(code) => process.exit(code),
		(err) => {
			console.error(err instanceof CoverageFileError ? `❌ ${err.message}` : err);
			process.exit(1);
		}
	);
}
