/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tools/dev/check-node-versions.mjs
 *	@Date: 2026-03-13 00:00:00 -08:00 (1741852800)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-13 06:35:55 -07:00 (1773408955)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Scans all node_modules (including nested) for packages that declare
 * a minimum Node.js engine requirement. Reports each package's required version,
 * flags any that exceed the project's own `engines.node` lower bound, and prints
 * a sorted summary table.
 *
 * @module @cldmv/slothlet/tools/check-node-versions
 * @title npm run check:node-versions
 *
 * @example
 * // Scan the default node_modules in the project root
 * npm run check:node-versions
 *
 * @example
 * // Pass a custom root directory
 * node tools/dev/check-node-versions.mjs /path/to/project
 *
 * @example
 * // Show only packages that require a Node version newer than the project floor
 * node tools/dev/check-node-versions.mjs --violations-only
 *
 * @description
 * **CLI Options:**
 *
 * | Option             | Default | Description                                          |
 * | ------------------ | ------- | ---------------------------------------------------- |
 * | `[root]`           | `cwd`   | Project root that contains the top-level node_modules |
 * | `--violations-only`| false   | Print only packages that violate the project floor   |
 * | `--no-nested`      | false   | Skip scanning nested node_modules directories        |
 * | `--min <n>`        | 0       | Only show packages requiring >= n (numeric)          |
 * | `--json`           | false   | Output results as JSON instead of a table            |
 */

import { readFileSync, readdirSync, statSync, existsSync } from "fs";
import { join, resolve, relative } from "path";
import { fileURLToPath } from "url";

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

/**
 * Parses a semver range string and returns the lowest concrete Node.js major
 * version implied by that range.
 *
 * Supports common range styles:
 * - `>=18.0.0`, `>= 18`, `>18`
 * - `^18.0.0`, `~16.4.0`
 * - `14 || 16 || 18`
 * - `14.x`, `14.*`
 * - `*`, `""`  (any version)
 *
 * @param {string} range - The engines.node range string.
 * @returns {{ min: number|null, raw: string }} Parsed result; `min` is null when
 *   the range cannot be interpreted.
 * @example
 * parseNodeRange(">=18.0.0"); // { min: 18, raw: ">=18.0.0" }
 * parseNodeRange("14 || 16"); // { min: 14, raw: "14 || 16" }
 * parseNodeRange("*");        // { min: null, raw: "*" }
 */
function parseNodeRange(range) {
	const raw = range.trim();

	if (!raw || raw === "*" || raw === "x" || raw === "latest") {
		return { min: null, raw };
	}

	// OR-separated set: pick the smallest major across all alternatives
	if (raw.includes("||")) {
		const parts = raw.split("||").map((p) => p.trim());
		const mins = parts.map((p) => parseNodeRange(p).min).filter((n) => n !== null);
		return { min: mins.length ? Math.min(...mins) : null, raw };
	}

	// Space-separated intersections (e.g. ">=14 <20"): pick the lower bound
	if (raw.includes(" ")) {
		const parts = raw
			.split(/\s+/)
			.map((p) => p.trim())
			.filter(Boolean);
		const mins = parts.map((p) => parseNodeRange(p).min).filter((n) => n !== null);
		return { min: mins.length ? Math.min(...mins) : null, raw };
	}

	// Strip range operators, carets, tildes
	const stripped = raw.replace(/^[>=<^~v]+/, "");

	// Could be "14.x" or "14.*"
	const major = parseInt(stripped.split(/[.x*]/)[0], 10);
	if (!isNaN(major)) {
		return { min: major, raw };
	}

	return { min: null, raw };
}

/**
 * Reads a package.json file and returns a parsed object, or null on failure.
 *
 * @param {string} pkgPath - Absolute path to the package.json file.
 * @returns {object|null} Parsed JSON or null if the file is unreadable / invalid.
 * @example
 * readPkg("/srv/repos/slothlet/node_modules/chalk/package.json");
 */
function readPkg(pkgPath) {
	try {
		return JSON.parse(readFileSync(pkgPath, "utf8"));
	} catch {
		return null;
	}
}

/**
 * Returns an array of immediate child directory names inside `dir`, excluding
 * hidden entries that start with `.`.
 *
 * @param {string} dir - Absolute path to the directory to list.
 * @returns {string[]} Child directory names.
 * @example
 * listDirs("/srv/repos/slothlet/node_modules"); // ["chalk", "vitest", ...]
 */
function listDirs(dir) {
	try {
		return readdirSync(dir).filter((name) => {
			if (name.startsWith(".")) return false;
			try {
				return statSync(join(dir, name)).isDirectory();
			} catch {
				return false;
			}
		});
	} catch {
		return [];
	}
}

/**
 * Recursively discovers every `node_modules` path beneath `root`, including
 * the root-level one. Nested `node_modules` inside packages are included when
 * `includeNested` is `true`.
 *
 * @param {string} root - Absolute path to the project root.
 * @param {boolean} includeNested - Whether to recurse into nested node_modules.
 * @returns {string[]} Absolute paths to every discovered node_modules directory.
 * @example
 * findAllNodeModules("/srv/repos/slothlet", true);
 * // ["/srv/repos/slothlet/node_modules", "/srv/repos/slothlet/node_modules/pkg/node_modules"]
 */
function findAllNodeModules(root, includeNested) {
	const results = [];
	const rootNm = join(root, "node_modules");
	if (!existsSync(rootNm)) return results;

	results.push(rootNm);
	if (!includeNested) return results;

	/**
	 * Walk into each installed package and look for a nested node_modules.
	 * We limit depth to avoid extremely deep traversal.
	 *
	 * @param {string} nmDir - Current node_modules directory.
	 * @param {number} depth - Current recursion depth.
	 * @returns {void}
	 */
	function walk(nmDir, depth) {
		if (depth > 4) return;
		const pkgs = listDirs(nmDir);
		for (const pkg of pkgs) {
			// Scoped packages are listed as folders starting with @
			const pkgDir = join(nmDir, pkg);
			if (pkg.startsWith("@")) {
				// One more level for scoped
				const scoped = listDirs(pkgDir);
				for (const sp of scoped) {
					const nested = join(pkgDir, sp, "node_modules");
					if (existsSync(nested)) {
						results.push(nested);
						walk(nested, depth + 1);
					}
				}
			} else {
				const nested = join(pkgDir, "node_modules");
				if (existsSync(nested)) {
					results.push(nested);
					walk(nested, depth + 1);
				}
			}
		}
	}

	walk(rootNm, 0);
	return results;
}

/**
 * Scans a single `node_modules` directory and returns one result entry per
 * installed package (including scoped packages).
 *
 * @param {string} nmDir - Absolute path to the node_modules directory.
 * @param {string} root  - Project root (used for display-relative paths).
 * @returns {Array<{name: string, version: string, nodeRange: string, min: number|null, location: string}>}
 *   Array of package result objects.
 * @example
 * scanNodeModules("/srv/repos/slothlet/node_modules", "/srv/repos/slothlet");
 */
function scanNodeModules(nmDir, root) {
	const results = [];
	const entries = listDirs(nmDir);

	for (const entry of entries) {
		const entryPath = join(nmDir, entry);

		if (entry.startsWith("@")) {
			// Scoped packages: iterate inner dirs
			const scoped = listDirs(entryPath);
			for (const sp of scoped) {
				const pkg = readPkg(join(entryPath, sp, "package.json"));
				if (pkg) {
					const nodeRange = pkg.engines?.node ?? null;
					const parsed = nodeRange ? parseNodeRange(nodeRange) : { min: null, raw: "" };
					results.push({
						name: pkg.name ?? `${entry}/${sp}`,
						version: pkg.version ?? "?",
						nodeRange: nodeRange ?? "",
						min: parsed.min,
						location: relative(root, join(entryPath, sp))
					});
				}
			}
		} else {
			const pkg = readPkg(join(entryPath, "package.json"));
			if (pkg) {
				const nodeRange = pkg.engines?.node ?? null;
				const parsed = nodeRange ? parseNodeRange(nodeRange) : { min: null, raw: "" };
				results.push({
					name: pkg.name ?? entry,
					version: pkg.version ?? "?",
					nodeRange: nodeRange ?? "",
					min: parsed.min,
					location: relative(root, entryPath)
				});
			}
		}
	}

	return results;
}

// ────────────────────────────────────────────────────────────────────────────
// Formatting
// ────────────────────────────────────────────────────────────────────────────

/** ANSI helpers (no external deps) */
const ANSI = {
	reset: "\x1b[0m",
	bold: "\x1b[1m",
	dim: "\x1b[2m",
	red: "\x1b[31m",
	green: "\x1b[32m",
	yellow: "\x1b[33m",
	blue: "\x1b[34m",
	cyan: "\x1b[36m",
	white: "\x1b[37m",
	gray: "\x1b[90m"
};

/**
 * Applies zero or more ANSI codes to the given text, then resets.
 *
 * @param {string} text - Text to colorize.
 * @param {...string} codes - ANSI escape codes to apply.
 * @returns {string} Decorated string.
 * @example
 * clr("hello", ANSI.bold, ANSI.green); // "\x1b[1m\x1b[32mhello\x1b[0m"
 */
function clr(text, ...codes) {
	return `${codes.join("")}${text}${ANSI.reset}`;
}

/**
 * Pads `str` with trailing spaces to reach `len` columns.
 *
 * @param {string} str - Input string.
 * @param {number} len - Target column width.
 * @returns {string} Padded string.
 * @example
 * padEnd("foo", 8); // "foo     "
 */
function padEnd(str, len) {
	return str.length >= len ? str : str + " ".repeat(len - str.length);
}

/**
 * Renders the results array as a formatted table to stdout.
 *
 * @param {Array<object>} rows - Deduplicated result rows (already sorted).
 * @param {number} projectFloor - The project's own minimum Node major.
 * @param {number} filterMin - Only show rows where min >= filterMin.
 * @param {boolean} violationsOnly - Only show rows where min > projectFloor.
 * @returns {void}
 */
function printTable(rows, projectFloor, filterMin, violationsOnly) {
	const filtered = rows.filter((r) => {
		if (r.min === null) return !violationsOnly && filterMin === 0;
		if (violationsOnly && r.min <= projectFloor) return false;
		if (r.min < filterMin) return false;
		return true;
	});

	if (filtered.length === 0) {
		console.log(clr("No packages matched the given filters.", ANSI.yellow));
		return;
	}

	// Column widths
	const nameW = Math.min(50, Math.max(20, ...filtered.map((r) => r.name.length)));
	const verW = Math.max(9, ...filtered.map((r) => r.version.length));
	const rangeW = Math.max(14, ...filtered.map((r) => r.nodeRange.length));
	const minW = 5;

	const header = [
		clr(padEnd("Package", nameW), ANSI.bold, ANSI.cyan),
		clr(padEnd("Version", verW), ANSI.bold, ANSI.cyan),
		clr(padEnd("engines.node", rangeW), ANSI.bold, ANSI.cyan),
		clr(padEnd("Min", minW), ANSI.bold, ANSI.cyan)
	].join("  ");

	const divider = clr(["─".repeat(nameW), "─".repeat(verW), "─".repeat(rangeW), "─".repeat(minW)].join("──"), ANSI.dim);

	console.log("\n" + header);
	console.log(divider);

	for (const row of filtered) {
		const isViolation = row.min !== null && row.min > projectFloor;
		const isUnspecified = !row.nodeRange;

		const nameStr = padEnd(row.name.length > nameW ? row.name.slice(0, nameW - 1) + "…" : row.name, nameW);
		const verStr = padEnd(row.version, verW);
		const rangeStr = padEnd(row.nodeRange || clr("(none)", ANSI.dim), rangeW);
		const minStr = row.min !== null ? String(row.min) : clr("?", ANSI.dim);

		let nameColored;
		if (isViolation) {
			nameColored = clr(nameStr, ANSI.red, ANSI.bold);
		} else if (isUnspecified) {
			nameColored = clr(nameStr, ANSI.gray);
		} else {
			nameColored = clr(nameStr, ANSI.white);
		}

		const minColored = isViolation ? clr(minStr, ANSI.red, ANSI.bold) : clr(minStr, ANSI.green);

		console.log([nameColored, clr(verStr, ANSI.dim), rangeStr, minColored].join("  "));
	}

	console.log(divider);
}

/**
 * Prints a summary line showing how many packages were scanned and how many
 * violate the project's Node.js floor.
 *
 * @param {Array<object>} rows - All deduplicated result rows.
 * @param {number} projectFloor - The project's minimum Node major.
 * @returns {void}
 */
function printSummary(rows, projectFloor) {
	const withRange = rows.filter((r) => r.nodeRange);
	const violations = rows.filter((r) => r.min !== null && r.min > projectFloor);
	const unspecified = rows.filter((r) => !r.nodeRange);

	console.log("\n" + clr("Summary", ANSI.bold, ANSI.cyan));
	console.log(`  Total packages scanned : ${clr(String(rows.length), ANSI.bold)}`);
	console.log(`  With engines.node      : ${clr(String(withRange.length), ANSI.bold)}`);
	console.log(`  No engines.node        : ${clr(String(unspecified.length), ANSI.dim)}`);
	console.log(`  Project floor (Node)   : ${clr(`>=${projectFloor}`, ANSI.bold, ANSI.green)}`);

	if (violations.length === 0) {
		console.log(`  Violations             : ${clr("none ✓", ANSI.bold, ANSI.green)}`);
	} else {
		console.log(
			`  Violations             : ${clr(String(violations.length), ANSI.bold, ANSI.red)} package(s) require a newer Node than the project floor`
		);
		console.log(clr("\n  Violating packages:", ANSI.red, ANSI.bold));
		for (const v of violations) {
			console.log(`    ${clr(v.name, ANSI.red, ANSI.bold)}@${v.version}  →  ${clr(`Node >=${v.min}`, ANSI.red)}  (${v.location})`);
		}
	}
	console.log();
}

// ────────────────────────────────────────────────────────────────────────────
// CLI entry point
// ────────────────────────────────────────────────────────────────────────────

/**
 * Parses CLI arguments and returns a normalized options object.
 *
 * @param {string[]} argv - `process.argv.slice(2)`.
 * @returns {{ root: string, includeNested: boolean, violationsOnly: boolean, minFilter: number, jsonOutput: boolean }}
 * @example
 * parseArgs(["--violations-only", "--min", "16"]);
 * // { root: process.cwd(), includeNested: true, violationsOnly: true, minFilter: 16, jsonOutput: false }
 */
function parseArgs(argv) {
	let root = null;
	let includeNested = true;
	let violationsOnly = false;
	let minFilter = 0;
	let jsonOutput = false;

	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i];
		if (arg === "--violations-only") {
			violationsOnly = true;
		} else if (arg === "--no-nested") {
			includeNested = false;
		} else if (arg === "--json") {
			jsonOutput = true;
		} else if (arg === "--min") {
			const next = argv[i + 1];
			if (next && !next.startsWith("--")) {
				minFilter = parseInt(next, 10) || 0;
				i++;
			}
		} else if (!arg.startsWith("--")) {
			root = resolve(arg);
		}
	}

	if (!root) root = resolve(fileURLToPath(import.meta.url), "../../../");

	return { root, includeNested, violationsOnly, minFilter, jsonOutput };
}

/**
 * Main entry: discovers node_modules, scans packages, deduplicates, sorts by
 * min required version (descending), then prints results.
 *
 * @returns {Promise<void>}
 */
async function main() {
	const args = parseArgs(process.argv.slice(2));
	const { root, includeNested, violationsOnly, minFilter, jsonOutput } = args;

	// Read project's own node floor from its package.json
	const rootPkg = readPkg(join(root, "package.json"));
	const projectRangeRaw = rootPkg?.engines?.node ?? ">=0";
	const projectFloor = parseNodeRange(projectRangeRaw).min ?? 0;

	if (!jsonOutput) {
		console.log(clr("\n🔍 check-node-versions", ANSI.bold, ANSI.cyan));
		console.log(`   Root      : ${clr(root, ANSI.dim)}`);
		console.log(`   Nested    : ${clr(String(includeNested), ANSI.dim)}`);
		console.log(
			`   Project   : ${clr(rootPkg?.name ?? "(unknown)", ANSI.dim)} — engines.node ${clr(projectRangeRaw, ANSI.bold, ANSI.green)}`
		);
	}

	const nmDirs = findAllNodeModules(root, includeNested);

	if (!jsonOutput) {
		console.log(`   Scanning  : ${clr(String(nmDirs.length), ANSI.bold)} node_modules director${nmDirs.length === 1 ? "y" : "ies"}`);
	}

	// Collect & deduplicate (keep highest min for same package name)
	/** @type {Map<string, object>} */
	const seen = new Map();

	for (const nmDir of nmDirs) {
		const rows = scanNodeModules(nmDir, root);
		for (const row of rows) {
			const existing = seen.get(row.name);
			if (!existing || (row.min !== null && (existing.min === null || row.min > existing.min))) {
				seen.set(row.name, row);
			}
		}
	}

	// Sort by min descending (nulls last), then alphabetically
	const sorted = [...seen.values()].sort((a, b) => {
		if (a.min === null && b.min === null) return a.name.localeCompare(b.name);
		if (a.min === null) return 1;
		if (b.min === null) return -1;
		if (b.min !== a.min) return b.min - a.min;
		return a.name.localeCompare(b.name);
	});

	if (jsonOutput) {
		console.log(JSON.stringify({ projectFloor, packages: sorted }, null, 2));
		return;
	}

	printTable(sorted, projectFloor, minFilter, violationsOnly);
	printSummary(sorted, projectFloor);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
