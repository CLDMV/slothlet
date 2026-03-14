/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tools/dev/fix-headers.mjs
 *	@Date: 2026-03-01T00:00:00-08:00 (1740819600)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-04 20:49:56 -08:00 (1772686196)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Scans all source files in the project and validates or updates their standard
 * file header block (project name, filename, date, author, copyright). Delegates to
 * the shared `\@cldmv/fix-headers` package.
 * @module @cldmv/slothlet/tools/fix-headers
 * @title npm run fix:headers
 *
 * @example
 * // Run via npm script
 * npm run fix:headers
 *
 * @example
 * // Preview changes without writing
 * npm run fix:headers -- --dry-run
 *
 * @example
 * // Show diff for each changed file
 * npm run fix:headers -- --diff
 *
 * @example
 * // Verbose output
 * npm run fix:headers -- --verbose
 *
 * @description
 * **CLI Options:**
 *
 * | Option | Description |
 * | --- | --- |
 * | `--dry-run` | Preview what would change without writing any files |
 * | `--diff` | Show a per-file diff of header changes |
 * | `--verbose` | Print each file examined |
 * | `--help` | Show usage information |
 */

import { fixHeaders } from "@cldmv/fix-headers";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { FILE_HEADER_CHECK_FOLDERS, FILE_HEADER_IGNORE_FOLDERS } from "../lib/header-config.mjs";

/**
 * Options accepted by the `fixHeaders` function from @cldmv/fix-headers.
 * @typedef {Object} FixHeadersOptions
 * @property {string} [cwd] - Working directory for the project.
 * @property {string} [input] - Override input path.
 * @property {boolean} [dryRun] - If true, no files are written.
 * @property {string} [projectName] - Project name for header generation.
 * @property {string} [companyName] - Company name for copyright line.
 * @property {number} [copyrightStartYear] - First year of copyright range.
 * @property {string[]} [includeFolders] - Folder paths to scan.
 * @property {string[]} [excludeFolders] - Folder paths to skip.
 * @property {string[]} [includeExtensions] - File extensions to process.
 * @internal
 */

/**
 * Result returned by the `fixHeaders` function from @cldmv/fix-headers.
 * @typedef {Object} FixHeadersResult
 * @property {number} filesScanned - Total files examined.
 * @property {number} filesUpdated - Files whose headers were changed.
 * @property {boolean} dryRun - Whether this was a dry run.
 * @property {object[]} changes - Per-file change details (each with `file`, `changed`, and optional `sample` fields).
 * @property {object} metadata - Resolved project metadata used during the run.
 * @internal
 */

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "../..");

/**
 * Print CLI help.
 * @internal
 * @returns {void}
 * @example
 * showHelp();
 */
function showHelp() {
	console.log(`
Slothlet File Header Fixer (v2)
Delegates execution to @cldmv/fix-headers while preserving legacy flags.

USAGE:
  node tools/fix-headers.mjs [OPTIONS]

OPTIONS:
  --dry-run     Compute changes without writing files (also enables --diff)
  --verbose     Show per-file issue details and error list
  --diff        Show unified diff output for changed files
  --help, -h    Show this help message
`);
}

/**
 * Parse CLI arguments into runner options.
 * @internal
 * @param {string[]} args - Raw process arguments excluding node and script path.
 * @returns {{ help: boolean, dryRun: boolean, verbose: boolean, diff: boolean }} Parsed options.
 * @example
 * const opts = parseArguments(["--dry-run", "--verbose"]);
 */
function parseArguments(args) {
	let help = false;
	let dryRun = false;
	let verbose = false;
	let diff = false;

	for (const arg of args) {
		if (arg === "--help" || arg === "-h") {
			help = true;
		} else if (arg === "--dry-run") {
			dryRun = true;
			diff = true; // dry-run always implies diff
		} else if (arg === "--verbose") {
			verbose = true;
		} else if (arg === "--diff") {
			diff = true;
		}
	}

	return { help, dryRun, verbose, diff };
}

/**
 * Build fixHeaders options from parsed CLI args and project header config.
 * @internal
 * @param {{ dryRun: boolean }} parsed - Parsed CLI arguments.
 * @returns {FixHeadersOptions} Options for @cldmv/fix-headers.
 * @example
 * const options = buildOptions({ dryRun: true });
 */
function buildOptions(parsed) {
	return {
		cwd: projectRoot,
		dryRun: parsed.dryRun,
		projectName: "@cldmv/slothlet",
		company: "CLDMV",
		companyName: "Catalyzed Motivation Inc.",
		copyrightStartYear: 2013,
		includeExtensions: [".mjs", ".cjs", ".jsonv", ".jsonc"],
		includeFolders: FILE_HEADER_CHECK_FOLDERS.map((f) => f.path),
		excludeFolders: FILE_HEADER_IGNORE_FOLDERS
	};
}

/**
 * Print the run result summary to stdout.
 * @internal
 * @param {FixHeadersResult} result - Result from @cldmv/fix-headers.
 * @param {{ verbose: boolean, diff: boolean, dryRun: boolean }} opts - Display options.
 * @returns {void}
 * @example
 * printSummary(result, { verbose: true, diff: false, dryRun: false });
 */
function printSummary(result, opts) {
	if (opts.dryRun) {
		console.log("🔍 DRY RUN MODE - No files will be modified\n");
	}

	if (opts.verbose || opts.diff) {
		const changed = result.changes.filter((c) => c.changed);
		if (changed.length > 0) {
			console.log("Files with changes:\n");
			for (const entry of changed) {
				console.log(`  ✓ ${entry.file}`);
			}
			console.log();
		}
	}

	console.log("📊 Statistics:");
	console.log(`  Files scanned:  ${result.filesScanned}`);
	console.log(`  Files updated:  ${result.filesUpdated}`);
	console.log();

	if (opts.dryRun && result.filesUpdated > 0) {
		console.log("✅ Dry run complete. Run without --dry-run to apply fixes.");
	} else if (result.filesUpdated > 0) {
		console.log(`✅ Fixed ${result.filesUpdated} file(s).`);
	} else {
		console.log("✅ All files have proper headers!");
	}

	console.log();
}

/**
 * Execute the compatibility wrapper.
 * @internal
 * @returns {Promise<void>} Resolves when all header processing is complete.
 * @example
 * await main();
 */
async function main() {
	const parsed = parseArguments(process.argv.slice(2));

	if (parsed.help) {
		showHelp();
		process.exit(0);
	}

	console.log("\n=== File Header Fixer ===\n");

	const options = buildOptions(parsed);
	const result = await fixHeaders(options);

	printSummary(result, parsed);
}

main().catch((err) => {
	console.error("Fatal error:", err);
	process.exit(1);
});
