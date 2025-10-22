/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tools/prepend-license.mjs
 *	@Date: 2025-09-09 13:22:38 -07:00 (1757449358)
 *	@Author: Nate Hyson <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Hyson <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2025-10-22 07:01:45 -07:00 (1761141705)
 *	-----
 *	@Copyright: Copyright (c) 2013-2025 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview License header prepending utility for build artifacts that automatically detects owner information and adds Apache License headers.
 * @module @cldmv/slothlet/tools/prepend-license
 * @package
 * @internal
 * @description
 * Automatically prepends Apache License Version 2.0 headers to all applicable source files in a target directory.
 * Intelligently extracts owner information from package.json and handles various file types with appropriate
 * comment syntax.
 *
 * Key features:
 * - Auto-detects owner from package.json author/contributors fields
 * - Supports multiple file types with appropriate comment syntax (.js, .css, .html, .json, etc.)
 * - Preserves shebang lines when present
 * - Skips files that already have Apache license headers
 * - Intelligent comment removal that doesn't break string literals containing "//"
 * - Configurable via command line arguments (--owner, --year)
 *
 * Technical implementation:
 * - Uses regex-based parsing to identify existing license headers
 * - Implements safe comment removal that preserves string content
 * - Recursively walks directory trees while skipping node_modules and .git
 * - Reads license template from .configs/license-header.txt
 * - Supports various comment syntaxes based on file extensions
 *
 * @example
 * // Apply to default dist/ directory with auto-detected owner
 * node tools/prepend-license.mjs
 *
 * @example
 * // Apply to specific directory with custom owner and year
 * node tools/prepend-license.mjs --owner "ACME Corp" --year "2024" ./build
 *
 * @example
 * // Apply to current directory
 * node tools/prepend-license.mjs .
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TEXT_EXTS = new Set([".js", ".mjs", ".cjs", ".css", ".scss", ".less", ".html", ".jsonc", ".yml", ".yaml"]);

const APACHE_MARKER = "Licensed under the Apache License, Version 2.0";
const root = path.join(__dirname, "..");
const licensePath = path.join(root, ".configs", "license-header.txt");

/**
 * Parse command line arguments for owner, year, and target directory.
 * @internal
 * @private
 * @param {string[]} argv - Command line arguments array
 * @returns {{dir: string|null, owner: string|null, year: string|null}} Parsed arguments
 */
function parseArgv(argv) {
	const out = { dir: null, owner: null, year: null };
	for (let i = 2; i < argv.length; i++) {
		const a = argv[i];
		if (a === "--owner") out.owner = argv[++i] ?? null;
		else if (a.startsWith("--owner=")) out.owner = a.slice(8);
		else if (a === "--year") out.year = argv[++i] ?? null;
		else if (a.startsWith("--year=")) out.year = a.slice(7);
		else if (!a.startsWith("-") && !out.dir) out.dir = a; // first non-flag = target dir
	}
	return out;
}

/**
 * Parse person string in package.json format.
 * @internal
 * @private
 * @param {string} s - Person string like "Name <email> (Company)"
 * @returns {object} Parsed person object with name and optional company properties
 */
function parsePersonString(s) {
	const companyMatch = s.match(/\(([^)]+)\)/);
	const nameMatch = s.match(/^([^<(]+)/);
	return {
		name: (nameMatch ? nameMatch[1] : s).trim(),
		company: companyMatch ? companyMatch[1].trim() : undefined
	};
}

/**
 * Extracts the author name from package.json author field.
 * @internal
 * @private
 * @param {object} pkg - The package.json object
 * @returns {string|undefined} The author name or undefined if not found
 */
function getAuthorName(pkg) {
	const a = pkg.author;
	if (!a) return undefined;
	if (typeof a === "string") return parsePersonString(a).name;
	if (typeof a === "object") return a.name?.trim() || undefined;
	return undefined;
}

/**
 * Extracts the author company from package.json author field.
 * @internal
 * @private
 * @param {object} pkg - The package.json object
 * @returns {string|undefined} The author company or undefined if not found
 */
function getAuthorCompany(pkg) {
	const a = pkg.author;
	if (a && typeof a === "object" && a.company && String(a.company).trim()) {
		return String(a.company).trim();
	}
	return undefined;
}

/**
 * Extracts the first contributor from package.json contributors array.
 * @internal
 * @private
 * @param {object} pkg - The package.json object
 * @returns {object|undefined} Object with name and company properties, or undefined if not found
 */
function getFirstContributor(pkg) {
	if (!Array.isArray(pkg.contributors) || pkg.contributors.length === 0) return undefined;
	const c = pkg.contributors[0];
	if (typeof c === "string") return parsePersonString(c);
	if (c && typeof c === "object") {
		return {
			name: c.name?.trim(),
			company: c.company?.trim() || c.organization?.trim()
		};
	}
	return undefined;
}

/**
 * Creates an owner string from package.json author and contributors information.
 * @internal
 * @private
 * @param {object} pkg - The package.json object
 * @returns {string|undefined} Owner string in format "company/author" or just company/author, or undefined
 */
function makeOwnerFromPkg(pkg) {
	const authorName = getAuthorName(pkg);
	const authorCompany = getAuthorCompany(pkg);

	const firstContrib = getFirstContributor(pkg);
	const contribCompany = firstContrib?.company;
	const contribName = firstContrib?.name;

	// company precedence: author.company -> contributors[0].company -> contributors[0].name
	const company = authorCompany || contribCompany || contribName;
	const author = authorName;

	if (company && author) return `${company}/${author}`;
	if (company) return company;
	if (author) return author;

	// final fallbacks
	if (pkg.name && typeof pkg.name === "string") return pkg.name.replace(/^@[^/]+\//, "");
	return path.basename(root);
}

/**
 * Gets a valid year string from CLI input or current date.
 * @internal
 * @private
 * @param {string|undefined} cliYear - Year provided via CLI
 * @returns {string} Four-digit year string
 */
function getYear(cliYear) {
	const y = cliYear && String(cliYear).trim();
	if (y && /^\d{4}$/.test(y)) return y;
	return String(new Date().getFullYear());
}

/**
 * Resolves owner information from CLI input or package.json.
 * @internal
 * @private
 * @async
 * @param {string|undefined} cliOwner - Owner provided via CLI
 * @returns {Promise<string>} Owner string or fallback directory name
 */
async function resolveOwner(cliOwner) {
	if (cliOwner && String(cliOwner).trim()) return String(cliOwner).trim();
	try {
		const pkgRaw = await fs.readFile(path.join(root, "package.json"), "utf8");
		const pkg = JSON.parse(pkgRaw);
		return makeOwnerFromPkg(pkg);
	} catch {
		return path.basename(root);
	}
}

/**
 * Loads and processes the license template file.
 * @internal
 * @private
 * @async
 * @param {string} owner - Owner string to substitute in template
 * @param {string} year - Year string to substitute in template
 * @returns {Promise<string>} Processed license template
 */
async function loadTemplate(owner, year) {
	const tpl = await fs.readFile(licensePath, "utf8");
	return tpl.replaceAll("[{date}]", year).replaceAll("[{owner}]", owner);
}

/**
 * Recursively walks directory tree yielding file paths.
 * @internal
 * @private
 * @async
 * @generator
 * @param {string} dir - Directory to walk
 * @yields {string} File paths found during traversal
 */
async function* walk(dir) {
	const entries = await fs.readdir(dir, { withFileTypes: true });
	for (const d of entries) {
		const p = path.join(dir, d.name);
		if (d.isDirectory()) {
			if (d.name === "node_modules" || d.name === ".git") continue;
			yield* walk(p);
		} else {
			yield p;
		}
	}
}

/**
 * Checks if a file appears to be a text file based on extension.
 * @internal
 * @private
 * @param {string} file - File path to check
 * @returns {boolean} True if file extension indicates text file
 */
function looksTextFile(file) {
	const ext = path.extname(file).toLowerCase();
	return TEXT_EXTS.has(ext);
}

/**
 * Prepend license header to a single file.
 * @internal
 * @private
 * @param {string} file - File path to process
 * @param {string} banner - License banner content
 * @returns {Promise<void>}
 */
async function prependLicenseToFile(file, banner) {
	if (!looksTextFile(file)) return;
	let content = await fs.readFile(file, "utf8");

	// More careful comment removal that doesn't break strings containing //
	// Remove block comments first
	content = content.replace(/\/\*[\s\S]*?\*\//g, "");

	// Remove line comments, but only if // is not inside a string
	// This is a simplified approach - split by lines and process each line
	const lines = content.split("\n");
	const processedLines = lines.map((line) => {
		// Simple heuristic: if the line has quotes, be more careful
		if (line.includes('"') || line.includes("'") || line.includes("`")) {
			// Don't remove // if it might be inside a string
			// This is not perfect but safer for most cases
			let inString = false;
			let stringChar = null;
			let result = "";

			for (let i = 0; i < line.length; i++) {
				const char = line[i];
				const nextChar = line[i + 1];

				if (!inString && (char === '"' || char === "'" || char === "`")) {
					inString = true;
					stringChar = char;
					result += char;
				} else if (inString && char === stringChar && line[i - 1] !== "\\") {
					inString = false;
					stringChar = null;
					result += char;
				} else if (!inString && char === "/" && nextChar === "/") {
					// Found a line comment outside of strings, remove rest of line
					break;
				} else {
					result += char;
				}
			}
			return result;
		} else {
			// No quotes, safe to use simple regex
			return line.replace(/\/\/.*$/, "");
		}
	});
	content = processedLines.join("\n");

	if (content.includes(APACHE_MARKER)) return;

	let shebang = "";
	if (content.startsWith("#!")) {
		const idx = content.indexOf("\n");
		if (idx !== -1) {
			shebang = content.slice(0, idx + 1);
			content = content.slice(idx + 1);
		} else {
			shebang = content + "\n";
			content = "";
		}
	}

	const EOL = content.includes("\r\n") ? "\r\n" : "\n";

	/**
	 * Wraps banner content in appropriate comment syntax based on file type.
	 * Supports JavaScript, CSS, HTML, JSON, YAML, and Markdown file types with their respective comment styles.
	 * @internal
	 * @private
	 * @param {string} content - Banner content to wrap in comments
	 * @param {string} fileExt - File extension to determine comment syntax (e.g., '.js', '.css', '.html')
	 * @returns {string} Wrapped banner with appropriate comment syntax and proper line endings
	 */
	function wrapBanner(content, fileExt) {
		switch (fileExt) {
			case ".js":
			case ".mjs":
			case ".cjs":
			case ".ts":
			case ".mts":
			case ".cts":
			case ".css":
			case ".scss":
			case ".less":
				return `/*${EOL}${banner.replace(/\r?\n/g, EOL)}${EOL}*/${EOL}${EOL}`;
			case ".html":
			case ".hbs":
				return `<!--${EOL}${banner.replace(/\r?\n/g, EOL)}${EOL}-->${EOL}${EOL}`;
			case ".json":
			case ".jsonc":
			case ".yml":
			case ".yaml":
			case ".md":
				return (
					banner
						.split(/\r?\n/)
						.map((l) => `# ${l}`)
						.join(EOL) +
					EOL +
					EOL
				);
			default:
				// default to /* ... */
				return `/*${EOL}${banner.replace(/\r?\n/g, EOL)}${EOL}*/${EOL}${EOL}`;
		}
	}

	const ext = path.extname(file).toLowerCase();
	const header = wrapBanner(content, ext);
	const out = shebang + header + content;
	await fs.writeFile(file, out, "utf8");
	process.stdout.write(`prepended: ${file}\n`);
}

/**
 * Main entry point for the license prepending utility.
 * Processes command line arguments, resolves owner information, and applies license headers
 * to all applicable files in the target directory.
 * @package
 * @async
 * @returns {Promise<void>}
 * @throws {Error} When target directory is not found or file processing fails
 *
 * @example
 * // Run with default settings (targets dist/ directory)
 * await main();
 *
 * @example
 * // Process arguments and run
 * // Command: node tools/prepend-license.mjs --owner "ACME" --year "2024" ./build
 * process.argv = ['node', 'prepend-license.mjs', '--owner', 'ACME', '--year', '2024', './build'];
 * await main();
 */
async function main() {
	const { dir, owner: ownerArg, year: yearArg } = parseArgv(process.argv);
	const targetDir = dir || path.join(root, "dist");

	const stat = await fs.stat(targetDir).catch(() => null);
	if (!stat || !stat.isDirectory()) {
		console.error(`error: target directory not found: ${targetDir}`);
		process.exit(1);
	}

	const owner = await resolveOwner(ownerArg);
	const year = getYear(yearArg);
	const banner = await loadTemplate(owner, year);

	for await (const file of walk(targetDir)) {
		await prependLicenseToFile(file, banner).catch((err) => {
			console.error(`failed: ${file}\n${err.stack || err}`);
		});
	}
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
