#!/usr/bin/env node
/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tools/fix-headers.mjs
 *	@Date: 2026-02-04T16:53:27-08:00 (1770252807)
 *	@Author: Nate Hyson <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Hyson <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-02-04T16:53:27-08:00 (1770252807)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */
/**
 * @fileoverview Fix file headers across the codebase
 * - Validates header format against expected standard
 * - Extracts actual git creation dates
 * - Fixes date format issues (timezone format)
 * - Adds missing Unix timestamps
 * - Removes duplicate headers
 * - Fixes broken JSDoc comments
 * - Normalizes excessive whitespace
 * - Supports dry-run mode for testing
 */

import { readFile, writeFile, readdir, stat } from "node:fs/promises";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { FILE_HEADER_CHECK_FOLDERS, FILE_HEADER_IGNORE_FOLDERS } from "./lib/header-config.mjs";

const execAsync = promisify(exec);

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const rootDir = join(__dirname, "..");

// CLI args
const DRY_RUN = process.argv.includes("--dry-run");
const VERBOSE = process.argv.includes("--verbose");

// Statistics tracking
const stats = {
	filesScanned: 0,
	filesWithHeaders: 0,
	filesWithoutHeaders: 0,
	filesWithBadDates: 0,
	filesWithWrongDates: 0,
	filesWithBadTimestamps: 0,
	filesWithBadTimezones: 0,
	filesFixed: 0,
	errors: []
};

/**
 * Check if a path should be ignored
 */
function shouldIgnorePath(filePath, ignoreFolders) {
	const relPath = relative(rootDir, filePath);
	const normalizedRelPath = relPath.replace(/\\/g, "/");

	return ignoreFolders.some((ignoreFolder) => {
		const normalizedIgnore = ignoreFolder.replace(/\\/g, "/");
		return (
			normalizedRelPath.startsWith(normalizedIgnore + "/") ||
			normalizedRelPath === normalizedIgnore ||
			normalizedRelPath.endsWith("/" + normalizedIgnore) ||
			normalizedRelPath.endsWith(normalizedIgnore)
		);
	});
}

/**
 * Recursively find all .mjs files
 */
async function findMjsFiles(dir, files = []) {
	const entries = await readdir(dir);

	for (const entry of entries) {
		const fullPath = join(dir, entry);
		const stats = await stat(fullPath);

		if (stats.isDirectory()) {
			await findMjsFiles(fullPath, files);
		} else if (entry.endsWith(".mjs")) {
			files.push(fullPath);
		}
	}

	return files;
}

/**
 * Find all .mjs files in specified folders with optional recursion
 */
async function findMjsFilesInFolders(folderConfigs, ignoreFolders) {
	const allFiles = [];

	for (const config of folderConfigs) {
		const folderPath = join(rootDir, config.path);

		try {
			const stats = await stat(folderPath);
			if (!stats.isDirectory()) continue;

			if (config.recursive) {
				// Recursive search
				const files = await findMjsFiles(folderPath);
				allFiles.push(...files.filter((f) => !shouldIgnorePath(f, ignoreFolders)));
			} else {
				// Non-recursive: only direct children
				const entries = await readdir(folderPath);
				for (const entry of entries) {
					const fullPath = join(folderPath, entry);
					const entryStats = await stat(fullPath);
					if (entryStats.isFile() && entry.endsWith(".mjs")) {
						if (!shouldIgnorePath(fullPath, ignoreFolders)) {
							allFiles.push(fullPath);
						}
					}
				}
			}
		} catch (err) {
			// Folder doesn't exist, skip
			continue;
		}
	}

	return allFiles;
}

/**
 * Get the first commit date for a file from git history
 * @param {string} filePath - Absolute file path
 * @returns {Promise<{date: string, timestamp: number} | null>}
 */
async function getGitCreationDate(filePath) {
	try {
		// Get first commit date with Unix timestamp
		const { stdout } = await execAsync(`git log --follow --format="%aI (%at)" --reverse "${filePath}" | head -1`, { cwd: rootDir });

		const match = stdout.trim().match(/^(.+?)\s+\((\d+)\)$/);
		if (match) {
			return {
				date: match[1],
				timestamp: parseInt(match[2], 10)
			};
		}
		return null;
	} catch (err) {
		if (VERBOSE) {
			console.error(`Error getting git date for ${filePath}:`, err.message);
		}
		return null;
	}
}

/**
 * Get current date/time with Unix timestamp
 * @returns {{date: string, timestamp: number}}
 */
function getCurrentDateTime() {
	const now = new Date();
	const timestamp = Math.floor(now.getTime() / 1000);

	// Format: 2026-02-04 16:49:44 -08:00
	const year = now.getFullYear();
	const month = String(now.getMonth() + 1).padStart(2, "0");
	const day = String(now.getDate()).padStart(2, "0");
	const hours = String(now.getHours()).padStart(2, "0");
	const minutes = String(now.getMinutes()).padStart(2, "0");
	const seconds = String(now.getSeconds()).padStart(2, "0");

	// Get timezone offset with colon (e.g., -08:00)
	const tzOffset = -now.getTimezoneOffset();
	const tzHours = String(Math.floor(Math.abs(tzOffset) / 60)).padStart(2, "0");
	const tzMinutes = String(Math.abs(tzOffset) % 60).padStart(2, "0");
	const tzSign = tzOffset >= 0 ? "+" : "-";
	const timezone = `${tzSign}${tzHours}:${tzMinutes}`;

	const date = `${year}-${month}-${day} ${hours}:${minutes}:${seconds} ${timezone}`;

	return { date, timestamp };
}

/**
 * Find all header blocks in content
 * @param {string} content - File content
 * @returns {Array<{start: number, end: number, text: string}>} Array of header matches
 */
function findAllHeaders(content) {
	// Regex to match /** ... */ blocks containing @Project tag
	const headerRegex = /\/\*\*[\s\S]*?\*\//g;
	const headers = [];
	let match;

	while ((match = headerRegex.exec(content)) !== null) {
		const headerText = match[0];
		// Only consider it a header if it has @Project tag
		if (headerText.includes("@Project:")) {
			headers.push({
				start: match.index,
				end: match.index + headerText.length,
				text: headerText
			});
		}
	}

	return headers;
}

/**
 * Parse header text to extract fields
 * @param {string} headerText - Header block text
 * @returns {object} Parsed header fields
 */
function parseHeaderFields(headerText) {
	const header = {
		project: null,
		filename: null,
		date: null,
		dateTimestamp: null,
		author: null,
		email: null,
		lastModifiedBy: null,
		lastModifiedTime: null,
		lastModifiedTimestamp: null,
		copyright: null
	};

	const projectMatch = headerText.match(/\*\s*@Project:\s*(.+)/);
	if (projectMatch) header.project = projectMatch[1].trim();

	const filenameMatch = headerText.match(/\*\s*@Filename:\s*(.+)/);
	if (filenameMatch) header.filename = filenameMatch[1].trim();

	const dateMatch = headerText.match(/\*\s*@Date:\s*(.+?)\s*(?:\((\d+)\))?$/m);
	if (dateMatch) {
		header.date = dateMatch[1].trim();
		if (dateMatch[2]) {
			header.dateTimestamp = parseInt(dateMatch[2], 10);
		}
	}

	const authorMatch = headerText.match(/\*\s*@Author:\s*(.+)/);
	if (authorMatch) header.author = authorMatch[1].trim();

	const emailMatch = headerText.match(/\*\s*@Email:\s*(.+)/);
	if (emailMatch) header.email = emailMatch[1].trim();

	const lastModByMatch = headerText.match(/\*\s*@Last modified by:\s*(.+)/);
	if (lastModByMatch) header.lastModifiedBy = lastModByMatch[1].trim();

	const lastModTimeMatch = headerText.match(/\*\s*@Last modified time:\s*(.+?)\s*(?:\((\d+)\))?$/m);
	if (lastModTimeMatch) {
		header.lastModifiedTime = lastModTimeMatch[1].trim();
		if (lastModTimeMatch[2]) {
			header.lastModifiedTimestamp = parseInt(lastModTimeMatch[2], 10);
		}
	}

	const copyrightMatch = headerText.match(/\*\s*@Copyright:\s*(.+)/);
	if (copyrightMatch) header.copyright = copyrightMatch[1].trim();

	return header;
}

/**
 * Check if date format is correct (ISO 8601 with colon in timezone)
 * @param {string} date - Date string
 * @returns {boolean}
 */
function isValidDateFormat(date) {
	// Should match: 2026-02-04 16:49:44 -08:00 or 2026-01-31T15:33:57-08:00
	// Should NOT match: 2026-01-15 22:14:31 -0800 (missing colon in timezone)
	const pattern = /^\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/;
	return pattern.test(date);
}

/**
 * Fix date format by adding colon to timezone if missing
 * @param {string} date - Date string
 * @returns {string} Fixed date string
 */
function fixDateFormat(date) {
	// Add colon to timezone if missing (e.g., -0800 -> -08:00)
	return date.replace(/([+-])(\d{2})(\d{2})$/, "$1$2:$3");
}

/**
 * Generate header for file
 * @param {string} filePath - Absolute file path
 * @param {object} existingHeader - Existing header data (if any)
 * @returns {Promise<string>} Generated header
 */
async function generateHeader(filePath, existingHeader) {
	const relPath = "/" + relative(rootDir, filePath).replace(/\\/g, "/");

	// Always get git creation date for accuracy
	let creationDate = existingHeader?.date;
	let creationTimestamp = existingHeader?.dateTimestamp;

	// Always verify from git to ensure accuracy
	const gitDate = await getGitCreationDate(filePath);
	if (gitDate) {
		creationDate = gitDate.date;
		creationTimestamp = gitDate.timestamp;
	} else if (!creationDate || !isValidDateFormat(creationDate) || !creationTimestamp) {
		// Fallback to current date if git fails and no valid existing date
		const current = getCurrentDateTime();
		creationDate = current.date;
		creationTimestamp = current.timestamp;
	}

	// Ensure creation date has colon in timezone
	if (!isValidDateFormat(creationDate)) {
		creationDate = fixDateFormat(creationDate);
	}

	// Get current date/time for last modified
	const lastMod = getCurrentDateTime();

	// Get current year for copyright
	const currentYear = new Date().getFullYear();

	const header = `/**
 *	@Project: @cldmv/slothlet
 *	@Filename: ${relPath}
 *	@Date: ${creationDate} (${creationTimestamp})
 *	@Author: Nate Hyson <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Hyson <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: ${lastMod.date} (${lastMod.timestamp})
 *	-----
 *	@Copyright: Copyright (c) 2013-${currentYear} Catalyzed Motivation Inc. All rights reserved.
 */`;

	return header;
}

/**
 * Fix broken JSDoc comments in content
 * @param {string} content - Content to fix
 * @returns {string} Fixed content
 */
function fixBrokenJSDoc(content) {
	// Match incomplete JSDoc blocks: /** ... (with text but no closing */)
	// This regex finds /** followed by content but NOT followed by */
	const brokenJSDocRegex = /\/\*\*\s*\n\s*\*\s*([^\n]+)\s*\n\s*(?![\s\S]*?\*\/)/;

	let fixed = content;
	let match;

	// Keep fixing until no more broken JSDoc blocks found
	while ((match = brokenJSDocRegex.exec(fixed)) !== null) {
		const brokenBlock = match[0];
		const description = match[1];
		// Replace with properly closed JSDoc
		const fixedBlock = `/**\n * ${description}\n */\n`;
		fixed = fixed.replace(brokenBlock, fixedBlock);
	}

	return fixed;
}

/**
 * Normalize excessive whitespace in content
 * @param {string} content - Content to normalize
 * @returns {string} Normalized content
 */
function normalizeWhitespace(content) {
	// Replace 3+ consecutive newlines with exactly 2 (1 blank line)
	return content.replace(/\n{3,}/g, "\n\n");
}

/**
 * Check and fix file header
 * @param {string} filePath - Absolute file path
 * @returns {Promise<{fixed: boolean, issues: string[]}>}
 */
async function checkAndFixHeader(filePath) {
	const issues = [];

	try {
		const content = await readFile(filePath, "utf-8");
		stats.filesScanned++;

		// Find all headers using regex
		const headers = findAllHeaders(content);

		// Check for shebang
		let hasShebang = false;
		let shebangLength = 0;
		if (content.startsWith("#!")) {
			hasShebang = true;
			const firstNewline = content.indexOf("\n");
			shebangLength = firstNewline + 1;
			// Skip blank line after shebang if present
			if (content[shebangLength] === "\n") {
				shebangLength++;
			}
		}

		if (headers.length === 0) {
			stats.filesWithoutHeaders++;
			issues.push("No header found");

			// Generate and add header
			const header = await generateHeader(filePath, null);
			const shebangPart = hasShebang ? content.substring(0, shebangLength) : "";
			const contentPart = content.substring(shebangLength);
			const newContent = shebangPart + header + "\n\n" + contentPart;

			if (!DRY_RUN) {
				await writeFile(filePath, newContent, "utf-8");
			}

			stats.filesFixed++;
			return { fixed: true, issues };
		}

		// Check for duplicate headers
		if (headers.length > 1) {
			issues.push(`Found ${headers.length} duplicate headers`);
		}

		stats.filesWithHeaders++;

		// Use the first header for validation
		const firstHeader = headers[0];
		const existingHeader = parseHeaderFields(firstHeader.text);

		// Check for issues
		let needsFixing = headers.length > 1; // Fix if duplicates found

		// Always verify creation date against git history
		if (existingHeader.date && existingHeader.dateTimestamp) {
			const gitDate = await getGitCreationDate(filePath);
			if (gitDate && gitDate.timestamp !== existingHeader.dateTimestamp) {
				issues.push(
					`Wrong creation date: ${existingHeader.date} (${existingHeader.dateTimestamp}) - git shows: ${gitDate.date} (${gitDate.timestamp})`
				);
				stats.filesWithWrongDates++;
				needsFixing = true;
			}
		}

		// Check date format
		if (existingHeader.date && !isValidDateFormat(existingHeader.date)) {
			issues.push(`Bad date format: ${existingHeader.date}`);
			stats.filesWithBadDates++;
			needsFixing = true;
		}

		// Check date has timestamp
		if (existingHeader.date && !existingHeader.dateTimestamp) {
			issues.push("Missing Unix timestamp in @Date");
			stats.filesWithBadTimestamps++;
			needsFixing = true;
		}

		// Check last modified time format
		if (existingHeader.lastModifiedTime && !isValidDateFormat(existingHeader.lastModifiedTime)) {
			issues.push(`Bad last modified time format: ${existingHeader.lastModifiedTime}`);
			stats.filesWithBadTimezones++;
			needsFixing = true;
		}

		// Check last modified time has timestamp
		if (existingHeader.lastModifiedTime && !existingHeader.lastModifiedTimestamp) {
			issues.push("Missing Unix timestamp in @Last modified time");
			stats.filesWithBadTimestamps++;
			needsFixing = true;
		}

		// Check filename path
		const expectedPath = "/" + relative(rootDir, filePath).replace(/\\/g, "/");
		if (existingHeader.filename !== expectedPath) {
			issues.push(`Wrong filename path: ${existingHeader.filename} (expected ${expectedPath})`);
			needsFixing = true;
		}

		// Check for excessive whitespace after header (3+ consecutive newlines)
		const lastHeader = headers[headers.length - 1];
		const afterHeaderContent = content.substring(lastHeader.end);
		if (/\n{3,}/.test(afterHeaderContent)) {
			issues.push("Excessive whitespace after header");
			needsFixing = true;
		}

		if (needsFixing) {
			// Generate corrected header
			const header = await generateHeader(filePath, existingHeader);

			// Remove ALL headers and replace with the corrected one
			const lastHeader = headers[headers.length - 1];
			const shebangPart = hasShebang ? content.substring(0, shebangLength) : "";
			let contentPart = content.substring(lastHeader.end);

			// Fix any broken JSDoc comments in the content
			contentPart = fixBrokenJSDoc(contentPart);

			// Normalize excessive whitespace (max 1 blank line between blocks)
			contentPart = normalizeWhitespace(contentPart);

			// Trim leading newlines from content part to avoid double spacing
			contentPart = contentPart.replace(/^\n+/, "");

			const newContent = shebangPart + header + "\n\n" + contentPart;

			if (!DRY_RUN) {
				await writeFile(filePath, newContent, "utf-8");
			}

			stats.filesFixed++;
			return { fixed: true, issues };
		}

		return { fixed: false, issues: [] };
	} catch (err) {
		stats.errors.push({ file: filePath, error: err.message });
		return { fixed: false, issues: [`Error: ${err.message}`] };
	}
}

/**
 * Main function
 */
async function main() {
	console.log("\n=== File Header Fixer ===\n");

	if (DRY_RUN) {
		console.log("🔍 DRY RUN MODE - No files will be modified\n");
	}

	console.log("✅ Always verifying creation dates against git history\n");

	console.log("Scanning files...\n");

	// Find all files
	const files = await findMjsFilesInFolders(FILE_HEADER_CHECK_FOLDERS, FILE_HEADER_IGNORE_FOLDERS);

	console.log(`Found ${files.length} files to check\n`);

	// Process files
	const results = [];
	for (const file of files) {
		const result = await checkAndFixHeader(file);
		if (result.fixed || result.issues.length > 0) {
			results.push({
				file: relative(rootDir, file),
				...result
			});
		}
	}

	// Print results
	console.log("\n=== Results ===\n");

	if (results.length > 0 && VERBOSE) {
		console.log("Files with issues:\n");
		for (const result of results) {
			console.log(`[${result.fixed ? "✓" : "✗"}] ${result.file}`);
			for (const issue of result.issues) {
				console.log(`    - ${issue}`);
			}
		}
		console.log();
	}

	// Print statistics
	console.log("📊 Statistics:");
	console.log(`  Files scanned: ${stats.filesScanned}`);
	console.log(`  Files with headers: ${stats.filesWithHeaders}`);
	console.log(`  Files without headers: ${stats.filesWithoutHeaders}`);
	console.log(`  Files with bad dates: ${stats.filesWithBadDates}`);
	console.log(`  Files with wrong creation dates: ${stats.filesWithWrongDates}`);
	console.log(`  Files with bad timestamps: ${stats.filesWithBadTimestamps}`);
	console.log(`  Files with bad timezones: ${stats.filesWithBadTimezones}`);
	console.log(`  Files fixed: ${stats.filesFixed}`);

	if (stats.errors.length > 0) {
		console.log(`  Errors: ${stats.errors.length}`);
		if (VERBOSE) {
			console.log("\nErrors:");
			for (const error of stats.errors) {
				console.log(`  ${error.file}: ${error.error}`);
			}
		}
	}

	console.log();

	if (DRY_RUN && stats.filesFixed > 0) {
		console.log("✅ Dry run complete. Run without --dry-run to apply fixes.");
	} else if (stats.filesFixed > 0) {
		console.log(`✅ Fixed ${stats.filesFixed} file(s).`);
	} else {
		console.log("✅ All files have proper headers!");
	}

	console.log();
}

// Run
main().catch((err) => {
	console.error("Fatal error:", err);
	process.exit(1);
});
