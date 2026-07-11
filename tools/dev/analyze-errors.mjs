/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tools/dev/analyze-errors.mjs
 *	@Date: 2026-01-17T17:51:34-08:00 (1768701094)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-12 17:32:41 -07:00 (1773361961)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Analyzes all SlothletError and SlothletWarning usage across the codebase and
 * validates against translations. Checks for:
 * proper error construction, hint availability, stub vs real error classification,
 * translation coverage, unused translations, and placeholder consistency.
 * @module @cldmv/slothlet/tools/analyze-errors
 * @title npm run analyze
 *
 * @example
 * // Run via npm script
 * npm run analyze
 *
 * @example
 * // Limit output (default: 10)
 * npm run analyze -- --limit=25
 *
 * @example
 * // Verbose output
 * npm run analyze -- --verbose
 *
 * @example
 * // Combined
 * npm run analyze -- --verbose --limit=50
 *
 * @description
 * **CLI Options:**
 *
 * | Option | Description |
 * | --- | --- |
 * | `--limit=<n>` | Limit reported issues per category (default: 10) |
 * | `--verbose` | Show extended context for each issue |
 */

import { readFile, readdir, stat } from "node:fs/promises";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { FILE_HEADER_CHECK_FOLDERS, FILE_HEADER_IGNORE_FOLDERS, FILE_HEADER_EXTENSIONS } from "../lib/header-config.mjs";

const execAsync = promisify(exec);

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const rootDir = join(__dirname, "../..");
const srcDir = join(rootDir, "src");

// CLI args
const limitArg = process.argv.find((arg) => arg.startsWith("--limit="));
const LIMIT = limitArg ? parseInt(limitArg.split("=")[1], 10) : 10;
const VERBOSE = process.argv.includes("--verbose");

// Load translations to check hints
const translationsPath = join(srcDir, "lib/i18n/languages/en-us.json");
const translationsRaw = await readFile(translationsPath, "utf-8");
const translationsData = JSON.parse(translationsRaw);
const translations = translationsData.translations || {};

// Find all hint keys
const hintKeys = Object.keys(translations).filter((k) => k.startsWith("HINT_"));

/**
 * Check if a path should be ignored
 * @internal
 */
function shouldIgnorePath(filePath, ignoreFolders) {
	const relPath = relative(rootDir, filePath);
	return ignoreFolders.some((ignoreFolder) => {
		const normalizedIgnore = ignoreFolder.replace(/\\/g, "/");
		const normalizedRel = relPath.replace(/\\/g, "/");
		return (
			normalizedRel === normalizedIgnore ||
			normalizedRel.startsWith(normalizedIgnore + "/") ||
			// Also ignore the folder when it is nested anywhere (e.g. api_tests/.../node_modules/...
			// fixtures that mimic installed packages), matched as a full path segment so a file like
			// "tmplog.mjs" is not caught.
			normalizedRel.split("/").includes(normalizedIgnore)
		);
	});
}

/**
 * Recursively find all .mjs files
 * @internal
 */
async function findMjsFiles(dir, files = [], extensions = [".mjs"]) {
	const entries = await readdir(dir);

	for (const entry of entries) {
		const fullPath = join(dir, entry);
		const stats = await stat(fullPath);

		if (stats.isDirectory()) {
			await findMjsFiles(fullPath, files, extensions);
		} else if (extensions.some((ext) => entry.endsWith(ext))) {
			files.push(fullPath);
		}
	}

	return files;
}

/**
 * Find all .mjs files in specified folders with optional recursion
 * @internal
 */
async function findMjsFilesInFolders(folderConfigs, ignoreFolders, extensions = [".mjs"]) {
	const allFiles = [];

	for (const config of folderConfigs) {
		const folderPath = join(rootDir, config.path);

		try {
			const stats = await stat(folderPath);

			if (!stats.isDirectory()) {
				continue;
			}

			if (config.recursive) {
				// Recursive search
				const files = await findMjsFiles(folderPath, [], extensions);
				// Filter out ignored paths
				const filteredFiles = files.filter((file) => !shouldIgnorePath(file, ignoreFolders));
				allFiles.push(...filteredFiles);
			} else {
				// Non-recursive - only get direct .mjs files
				const entries = await readdir(folderPath);
				for (const entry of entries) {
					if (extensions.some((ext) => entry.endsWith(ext))) {
						const fullPath = join(folderPath, entry);
						if (!shouldIgnorePath(fullPath, ignoreFolders)) {
							allFiles.push(fullPath);
						}
					}
				}
			}
		} catch (____error) {
			// Folder doesn't exist, skip it
			if (VERBOSE) {
				console.log(`⚠️  Folder not found: ${config.path}`);
			}
		}
	}

	return allFiles;
}

// Shared cache for file contents across detector passes. Several detectors below iterate
// overlapping file lists (src files, tests/vitests files, tools files) independently, and one
// (#164 invalid-key-format check) re-reads the entire src file list once per invalid-format
// translation key found - multiplicative. This script is read-only (no writeFile/--fix anywhere),
// so caching per absolute path for the lifetime of a single invocation is safe: no mutation can
// invalidate a cached read between detector passes.
const fileContentCache = new Map();

/**
 * Read a file's contents, reusing a cached read for the same absolute path within this
 * script invocation. Multiple detector passes below iterate overlapping file lists (src files,
 * tests/vitests files, tools files), so caching avoids re-reading the same file from disk
 * repeatedly.
 * @param {string} file - Absolute path to read
 * @returns {Promise<string>} File contents (utf-8)
 * @internal
 */
async function readCached(file) {
	if (!fileContentCache.has(file)) {
		fileContentCache.set(file, await readFile(file, "utf-8"));
	}
	return fileContentCache.get(file);
}

/**
 * Parse console.warn calls from file content
 * @internal
 */
function parseConsoleWarns(content, filePath) {
	const warns = [];

	// Find console.warn statements
	const warnPattern = /console\.warn\s*\(/g;

	let match;
	while ((match = warnPattern.exec(content)) !== null) {
		// Check if this match is inside a comment
		const beforeMatch = content.substring(0, match.index);
		const lastLineStart = beforeMatch.lastIndexOf("\n") + 1;
		const currentLine = content.substring(lastLineStart, match.index + match[0].length);

		// Skip if it's in a line comment
		if (currentLine.trim().startsWith("//")) {
			continue;
		}

		// Skip if it's in a block comment
		const blockCommentStart = beforeMatch.lastIndexOf("/*");
		const blockCommentEnd = beforeMatch.lastIndexOf("*/");
		if (blockCommentStart > blockCommentEnd) {
			continue;
		}

		// Skip if in translations.mjs (circular dependency - can't use SlothletWarning there)
		if (filePath.includes("i18n\\translations.mjs") || filePath.includes("i18n/translations.mjs")) {
			continue;
		}

		// Skip if inside SlothletWarning class (false positive - that's the warning implementation itself)
		const classPattern = /(?:export\s+)?class\s+SlothletWarning(?:\s+extends\s+\w+)?\s*\{/;
		const classMatch = classPattern.exec(content);
		if (classMatch) {
			const classStart = classMatch.index;
			// Find the matching closing brace of the class
			let braceDepth = 0;
			let classEnd = -1;
			let foundOpenBrace = false;
			for (let i = classMatch.index + classMatch[0].length; i < content.length; i++) {
				if (content[i] === "{") {
					braceDepth++;
					foundOpenBrace = true;
				} else if (content[i] === "}") {
					if (braceDepth === 0 && foundOpenBrace) {
						classEnd = i;
						break;
					}
					braceDepth--;
				}
			}
			// Skip if console.warn is inside the SlothletWarning class
			if (classEnd !== -1 && match.index > classStart && match.index < classEnd) {
				continue;
			}
		}

		const startIndex = match.index;
		const parenStart = content.indexOf("(", startIndex);
		if (parenStart === -1) continue;

		// Track parenthesis depth to find matching closing paren
		let depth = 0;
		let parenEnd = -1;

		for (let i = parenStart; i < content.length; i++) {
			const char = content[i];
			if (char === "(") depth++;
			else if (char === ")") {
				depth--;
				if (depth === 0) {
					parenEnd = i;
					break;
				}
			}
		}

		if (parenEnd === -1) continue;

		// Extract the full statement
		let endIndex = parenEnd + 1;
		if (content[endIndex] === ";") endIndex++;

		const fullMatch = content.substring(startIndex, endIndex);

		// Find line number
		const lineNumber = beforeMatch.split("\n").length;

		// Extract the warning message (first argument)
		const argsContent = content.substring(parenStart + 1, parenEnd);
		const firstArg = argsContent.split(",")[0].trim();

		warns.push({
			filePath,
			lineNumber,
			fullMatch,
			firstArg
		});
	}

	return warns;
}

/**
 * Parse console.log statements and check if they're inside SlothletDebug class
 * @param {string} content - File content
 * @param {string} filePath - File path
 * @returns {Array} Array of improper console.log statements (outside SlothletDebug)
 * @internal
 */
function parseConsoleLogs(content, filePath) {
	const logs = [];

	// Find console.log statements
	const logPattern = /console\.log\s*\(/g;

	let match;
	while ((match = logPattern.exec(content)) !== null) {
		// Check if this match is inside a comment
		const beforeMatch = content.substring(0, match.index);
		const lastLineStart = beforeMatch.lastIndexOf("\n") + 1;
		const currentLine = content.substring(lastLineStart, match.index + match[0].length);

		// Skip if it's in a line comment
		if (currentLine.trim().startsWith("//")) {
			continue;
		}

		// Skip if it's in a block comment
		const blockCommentStart = beforeMatch.lastIndexOf("/*");
		const blockCommentEnd = beforeMatch.lastIndexOf("*/");
		if (blockCommentStart > blockCommentEnd) {
			continue;
		}

		// Skip if inside SlothletDebug class (that's where console.log should be)
		const classPattern = /(?:export\s+)?class\s+SlothletDebug(?:\s+extends\s+\w+)?\s*\{/;
		const classMatch = classPattern.exec(content);
		if (classMatch) {
			const classStart = classMatch.index;
			// Find the matching closing brace of the class
			let braceDepth = 0;
			let classEnd = -1;
			let foundOpenBrace = false;
			for (let i = classMatch.index + classMatch[0].length; i < content.length; i++) {
				if (content[i] === "{") {
					braceDepth++;
					foundOpenBrace = true;
				} else if (content[i] === "}") {
					if (braceDepth === 0 && foundOpenBrace) {
						classEnd = i;
						break;
					}
					braceDepth--;
				}
			}
			// Skip if console.log is inside the SlothletDebug class
			if (classEnd !== -1 && match.index > classStart && match.index < classEnd) {
				continue;
			}
		}

		// If we got here, this console.log is NOT inside SlothletDebug class
		const startIndex = match.index;
		const parenStart = content.indexOf("(", startIndex);
		if (parenStart === -1) continue;

		// Track parenthesis depth to find matching closing paren
		let depth = 0;
		let parenEnd = -1;

		for (let i = parenStart; i < content.length; i++) {
			const char = content[i];
			if (char === "(") depth++;
			else if (char === ")") {
				depth--;
				if (depth === 0) {
					parenEnd = i;
					break;
				}
			}
		}

		if (parenEnd === -1) continue;

		// Extract the full statement
		let endIndex = parenEnd + 1;
		if (content[endIndex] === ";") endIndex++;

		const fullMatch = content.substring(startIndex, endIndex);

		// Find line number
		const lineNumber = beforeMatch.split("\n").length;

		// Extract the log message (first argument)
		const argsContent = content.substring(parenStart + 1, parenEnd);
		const firstArg = argsContent.split(",")[0].trim();

		logs.push({
			filePath,
			lineNumber,
			fullMatch,
			firstArg
		});
	}

	return logs;
}

/**
 * Parse console.error calls from file content.
 * These are always violations – errors must use SlothletError / SlothletWarning
 * and must never be printed directly.
 * @param {string} content - File content
 * @param {string} filePath - File path
 * @returns {Array} Array of improper console.error statements
 * @internal
 */
function parseConsoleErrors(content, filePath) {
	const errors = [];

	const errorPattern = /console\.error\s*\(/g;

	let match;
	while ((match = errorPattern.exec(content)) !== null) {
		const beforeMatch = content.substring(0, match.index);
		const lastLineStart = beforeMatch.lastIndexOf("\n") + 1;
		const currentLine = content.substring(lastLineStart, match.index + match[0].length);

		// Skip line comments
		if (currentLine.trim().startsWith("//")) continue;

		// Skip block comments
		const blockCommentStart = beforeMatch.lastIndexOf("/*");
		const blockCommentEnd = beforeMatch.lastIndexOf("*/");
		if (blockCommentStart > blockCommentEnd) continue;

		const startIndex = match.index;
		const parenStart = content.indexOf("(", startIndex);
		if (parenStart === -1) continue;

		let depth = 0;
		let parenEnd = -1;
		for (let i = parenStart; i < content.length; i++) {
			const char = content[i];
			if (char === "(") depth++;
			else if (char === ")") {
				depth--;
				if (depth === 0) {
					parenEnd = i;
					break;
				}
			}
		}
		if (parenEnd === -1) continue;

		let endIndex = parenEnd + 1;
		if (content[endIndex] === ";") endIndex++;

		const fullMatch = content.substring(startIndex, endIndex);
		const lineNumber = beforeMatch.split("\n").length;
		const argsContent = content.substring(parenStart + 1, parenEnd);
		const firstArg = argsContent.split(",")[0].trim();

		errors.push({ filePath, lineNumber, fullMatch, firstArg });
	}

	return errors;
}

/**
 * Parse bare `new Error(...)` calls that should use `new this.SlothletError(...)`.
 * @param {string} content - File content
 * @param {string} filePath - File path
 * @returns {Array} Array of bare new Error usages
 * @internal
 */
function parseBareNewErrors(content, filePath) {
	const found = [];

	// Skip resolve-from-caller.mjs: it uses `new Error()` specifically for V8 stack capture
	// via Error.prepareStackTrace / Error.captureStackTrace — not as an actual thrown error.
	if (filePath.includes("resolve-from-caller.mjs")) {
		return found;
	}

	// Match `new Error(` that is NOT preceded by Slothlet/throw-rethrow patterns
	// We want to catch: `new Error(`, `const x = new Error(`, `throw new Error(` – all are violations
	// But NOT SlothletError, SlothletWarning, ErrorEvent, etc.
	const pattern = /(?<![A-Za-z])new\s+Error\s*\(/g;

	let match;
	while ((match = pattern.exec(content)) !== null) {
		const beforeMatch = content.substring(0, match.index);
		const lastLineStart = beforeMatch.lastIndexOf("\n") + 1;
		const currentLine = content.substring(lastLineStart, match.index + match[0].length);

		// Skip line comments
		if (currentLine.trim().startsWith("//")) continue;

		// Skip block comments
		const blockCommentStart = beforeMatch.lastIndexOf("/*");
		const blockCommentEnd = beforeMatch.lastIndexOf("*/");
		if (blockCommentStart > blockCommentEnd) continue;

		// Skip if it looks like `new ErrorEvent(` or similar subclasses
		// (already excluded by the negative lookbehind `(?<![A-Za-z])` – but double-check)
		const afterNew = content.substring(match.index + match[0].length - 1);
		if (/^Error[A-Z]/.test(afterNew)) continue;

		// Skip new Error() that is passed as a direct argument to SlothletError/SlothletWarning.
		// This is the legitimate pattern for wrapping an external string payload (e.g. IPC message)
		// into an Error object for use as the originalError 3rd param.
		// Walk backwards to find the enclosing unclosed '(' and check if it belongs to a Slothlet call.
		{
			let depth = 0;
			let isInsideSlothletCall = false;
			for (let i = match.index - 1; i >= 0; i--) {
				if (content[i] === ")") depth++;
				else if (content[i] === "(") {
					if (depth === 0) {
						const before = content.substring(0, i);
						if (/(?:SlothletError|SlothletWarning)\s*$/.test(before)) {
							isInsideSlothletCall = true;
						}
						break;
					}
					depth--;
				}
			}
			if (isInsideSlothletCall) continue;
		}

		const startIndex = match.index;
		const parenStart = content.indexOf("(", startIndex);
		if (parenStart === -1) continue;

		let depth = 0;
		let parenEnd = -1;
		for (let i = parenStart; i < content.length; i++) {
			const char = content[i];
			if (char === "(") depth++;
			else if (char === ")") {
				depth--;
				if (depth === 0) {
					parenEnd = i;
					break;
				}
			}
		}
		if (parenEnd === -1) continue;

		let endIndex = parenEnd + 1;
		if (content[endIndex] === ";") endIndex++;

		const fullMatch = content.substring(startIndex, endIndex);
		const lineNumber = beforeMatch.split("\n").length;
		const argsContent = content.substring(parenStart + 1, parenEnd);
		const firstArg = argsContent.split(",")[0].trim();

		found.push({ filePath, lineNumber, fullMatch, firstArg });
	}

	return found;
}

/**
 * Check if file has proper file header
 * @param {string} content - File content
 * @param {string} filePath - File path
 * @returns {boolean} True if file has proper header
 * @internal
 */
function hasProperFileHeader(content, ____filePath) {
	// Expected header format (first 12 lines). Opener is `/**` (JS: .mjs/.cjs) or `/*`
	// (.jsonc/.jsonv) — the `\*?` makes the second asterisk optional.
	// The @Filename can be /src/, /tools/, /tests/, /api_tests/, /.configs/, or root (/)
	const headerPattern =
		/^\/\*\*?\s*\n\s*\*\s*@Project:\s*@cldmv\/slothlet\s*\n\s*\*\s*@Filename:\s*\/.+\n\s*\*\s*@Date:\s*.+\n\s*\*\s*@Author:\s*.+<CLDMV>\s*\n\s*\*\s*@Email:\s*<Shinrai@users\.noreply\.github\.com>\s*\n\s*\*\s*-----\s*\n\s*\*\s*@Last modified by:\s*.+<CLDMV>\s*\(.+\)\s*\n\s*\*\s*@Last modified time:\s*.+\n\s*\*\s*-----\s*\n\s*\*\s*@Copyright:\s*Copyright\s*\(c\)\s*2013-2026\s*Catalyzed Motivation Inc\.\s*All rights reserved\.\s*\n\s*\*\//;

	// Strip shebang line (and any blank lines after it) so the header pattern can anchor to ^ correctly
	const normalizedContent = content.startsWith("#!") ? content.replace(/^#![^\n]*\n\s*/, "") : content;

	return headerPattern.test(normalizedContent);
}

/**
 * Parse SlothletError and SlothletWarning throws from file content
 * @internal
 */
function parseErrorThrows(content, filePath) {
	const errors = [];

	// Matches all access patterns:
	//   throw new SlothletError(...)            - direct (standalone import)
	//   throw new this.SlothletError(...)       - via ComponentBase getter
	//   new this.SlothletError(...)             - non-throw form, e.g. reject(new this.SlothletError(...))
	//   new this.slothlet.SlothletError(...)    - via double-hop (handler/builder classes)
	//   new slothlet.SlothletError(...)         - closure variable (api_builder.mjs)
	//   new wrapper.slothlet.SlothletError(...) - via proxy wrapper (unified-wrapper.mjs)
	// Same patterns for SlothletWarning.
	// NOTE: the non-throw SlothletError alternative may produce duplicate allErrors entries
	// for throw-sites already matched by the first alternative; this is harmless since
	// usedErrorCodes is a Set (deduplicates) and Total Errors display uses a separate filter.
	const throwPattern =
		/(?:throw\s+(?:await\s+)?(?:new\s+)?(?:(?:wrapper|this)(?:\.slothlet)?\.)?SlothletError|new\s+(?:(?:wrapper|this)(?:\.slothlet)?\.)?SlothletWarning|new\s+(?:(?:wrapper|this)(?:\.slothlet)?\.)?SlothletError|(?:throw\s+new\s+)?slothlet\.SlothletError)(?:\.create)?/g;

	const throwStarts = [];
	let match;
	while ((match = throwPattern.exec(content)) !== null) {
		// Check if this match is inside a comment
		const beforeMatch = content.substring(0, match.index);
		const lastLineStart = beforeMatch.lastIndexOf("\n") + 1;
		const currentLine = content.substring(lastLineStart, match.index + match[0].length);

		// Skip if it's in a line comment
		if (currentLine.trim().startsWith("//")) {
			continue;
		}

		// Skip if it's in a block comment
		const blockCommentStart = beforeMatch.lastIndexOf("/*");
		const blockCommentEnd = beforeMatch.lastIndexOf("*/");
		if (blockCommentStart > blockCommentEnd) {
			continue;
		}

		throwStarts.push(match.index);
	}

	// For each throw start, find the complete statement
	for (const startIndex of throwStarts) {
		// Find the opening parenthesis after SlothletError
		let parenStart = content.indexOf("(", startIndex);
		if (parenStart === -1) continue;

		// Track parenthesis depth to find matching closing paren
		let depth = 0;
		let parenEnd = -1;

		for (let i = parenStart; i < content.length; i++) {
			const char = content[i];
			if (char === "(") depth++;
			else if (char === ")") {
				depth--;
				if (depth === 0) {
					parenEnd = i;
					break;
				}
			}
		}

		if (parenEnd === -1) continue;

		// Extract the full throw statement including semicolon if present
		let endIndex = parenEnd + 1;
		if (content[endIndex] === ";") endIndex++;

		const fullMatch = content.substring(startIndex, endIndex);

		// Extract error code
		const codeMatch = fullMatch.match(/"([^"]+)"/);
		if (!codeMatch) continue;
		const errorCode = codeMatch[1];

		// Find line number
		const beforeMatch = content.substring(0, startIndex);
		const lineNumber = beforeMatch.split("\n").length;

		// Check if it has stub: true in context (not just in options parameter)
		const isStub = /stub:\s*true/.test(fullMatch);

		// Check if it has validationError: true in context (not just in options parameter)
		const isValidation = /validationError:\s*true/.test(fullMatch);

		// Check if context has hardcoded hint
		const hasHardcodedHint = /hint:\s*"/.test(fullMatch);

		// Count commas at depth 1 to determine parameters (inside main SlothletError call only)
		let paramCount = 1; // At least error code
		depth = 0;
		for (let i = parenStart; i <= parenEnd; i++) {
			const char = content[i];
			if (char === "(") depth++;
			else if (char === ")") depth--;
			else if (char === "," && depth === 1) paramCount++;
		}

		// Has originalError if 3+ params and 3rd param isn't { stub: true }
		const hasOriginalError = paramCount >= 3 && !isStub;

		errors.push({
			filePath,
			lineNumber,
			errorCode,
			fullMatch,
			isStub,
			isValidation,
			hasHardcodedHint,
			hasOriginalError
		});
	}

	return errors;
}

/**
 * Determine whether the delimiter at `idx` is backslash-escaped, by counting the run of consecutive
 * backslashes immediately before it. Backslashes pair off, so an even count (including zero) leaves
 * the delimiter UNescaped while an odd count escapes it: `\"` is an escaped quote, but `\\"` is an
 * escaped backslash followed by a real quote. A single `str[idx - 1] === "\\"` test gets the latter
 * wrong — it sees the nearest backslash and wrongly reports "escaped" (#136 review).
 * @internal
 * @param {string} str - Source text being scanned.
 * @param {number} idx - Index of the delimiter under test.
 * @returns {boolean} True when the character at `idx` is escaped (odd run of preceding backslashes).
 */
function isEscaped(str, idx) {
	let backslashes = 0;
	for (let j = idx - 1; j >= 0 && str[j] === "\\"; j--) backslashes++;
	return backslashes % 2 === 1;
}

/**
 * Remove JS line (`// …`) and block (`/* … *\/`) comments from a source fragment, leaving string
 * literals (including their contents) intact. Used so comments inside a SlothletError context object
 * aren't mis-parsed as properties.
 * @internal
 * @param {string} code - Source fragment.
 * @returns {string} The fragment with comments stripped.
 */
function stripComments(code) {
	let out = "";
	let inString = false;
	let stringChar = "";
	let inLine = false;
	let inBlock = false;
	for (let i = 0; i < code.length; i++) {
		const c = code[i];
		const n = code[i + 1];
		if (inLine) {
			if (c === "\n") {
				inLine = false;
				out += c;
			}
			continue;
		}
		if (inBlock) {
			if (c === "*" && n === "/") {
				inBlock = false;
				i++;
			}
			continue;
		}
		if (inString) {
			out += c;
			if (c === stringChar && !isEscaped(code, i)) {
				inString = false;
				stringChar = "";
			}
			continue;
		}
		if (c === '"' || c === "'" || c === "`") {
			inString = true;
			stringChar = c;
			out += c;
			continue;
		}
		if (c === "/" && n === "/") {
			inLine = true;
			i++;
			continue;
		}
		if (c === "/" && n === "*") {
			inBlock = true;
			i++;
			continue;
		}
		out += c;
	}
	return out;
}

/**
 * Extract the top-level comma-separated arguments of the first call in a `new SlothletError(...)`
 * match, respecting nested braces/brackets/parens and string literals so commas inside them don't
 * split an argument.
 * @internal
 * @param {string} fullMatch - The matched `new SlothletError(...)` source text.
 * @returns {string[]} Trimmed top-level argument expressions (empty if unparseable).
 */
function getTopLevelParams(fullMatch) {
	const startIdx = fullMatch.indexOf("(");
	if (startIdx === -1) return [];
	let depth = 0;
	let endIdx = -1;
	// Track string state while scanning for the matching ")": a ")" inside a string literal (e.g.
	// `"reason )"`) must not be counted, or the scan ends early on a truncated `inner`. Mirrors the
	// comma-splitting loop below and uses the same backslash-parity escape rule (#136 review).
	// (Distinct names from the comma loop's inString/stringChar — same function scope.)
	let inStr = false;
	let strChar = "";
	for (let i = startIdx; i < fullMatch.length; i++) {
		const ch = fullMatch[i];
		if (inStr) {
			if (ch === strChar && !isEscaped(fullMatch, i)) {
				inStr = false;
				strChar = "";
			}
			continue;
		}
		if (ch === '"' || ch === "'" || ch === "`") {
			inStr = true;
			strChar = ch;
			continue;
		}
		if (ch === "(") depth++;
		else if (ch === ")") {
			depth--;
			if (depth === 0) {
				endIdx = i;
				break;
			}
		}
	}
	if (endIdx === -1) return [];

	const inner = fullMatch.substring(startIdx + 1, endIdx);
	const params = [];
	let current = "";
	let d = 0;
	let inString = false;
	let stringChar = "";
	for (let i = 0; i < inner.length; i++) {
		const char = inner[i];
		if ((char === '"' || char === "'" || char === "`") && !isEscaped(inner, i)) {
			if (inString && char === stringChar) {
				inString = false;
				stringChar = "";
			} else if (!inString) {
				inString = true;
				stringChar = char;
			}
		}
		if (!inString) {
			if (char === "{" || char === "[" || char === "(") d++;
			else if (char === "}" || char === "]" || char === ")") d--;
		}
		if (char === "," && d === 0 && !inString) {
			params.push(current.trim());
			current = "";
		} else {
			current += char;
		}
	}
	if (current.trim()) params.push(current.trim());
	return params;
}

/**
 * Detect the fragile single-neighbor escape check: deciding whether a quote/backtick is escaped by
 * testing one fixed-offset neighbor (`x[i - 1] === "\\"`, `x[i + 1] !== '\\'`, …) instead of counting
 * the consecutive-backslash run. That misreads an even run of backslashes — `\\"` is an escaped
 * backslash followed by a REAL quote, not an escaped quote — the exact class of bug #136 surfaced in
 * this tool's own scanners. The correct forms don't match: a parity loop or a forward scan that
 * consumes the char after a backslash both index without a `± 1` offset. Use {@link isEscaped}.
 *
 * Scans line by line, skipping comment lines (JSDoc ` * …`, `// …`, `/* …`) and any trailing `// …`
 * so the JSDoc that documents this antipattern can't self-trip. A line-oriented scan is deliberate:
 * a whole-file comment stripper would have to tell regex literals from division to stay in sync
 * (this file is full of regex literals containing quotes), and getting that wrong blanks real code
 * and MISSES a live bug — a false negative, the worst outcome for an audit. Code lines never begin
 * with `*`/`//`/`/*`, so real occurrences are never skipped; the only cost is a possible false
 * positive on an exotically-formatted block comment, which is harmless and easily silenced.
 * @internal
 * @param {string} content - Raw file source.
 * @param {string} filePath - Absolute path, for reporting.
 * @returns {Array<{filePath: string, lineNumber: number, snippet: string}>} One entry per match.
 */
function findFragileEscapeChecks(content, filePath) {
	// [ident ± 1] <eq-op> "\\"  — index a fixed neighbor, compare to a single-backslash string literal.
	const re = /\[\s*[A-Za-z_$][\w$]*\s*[-+]\s*1\s*\]\s*(?:===|!==|==|!=)\s*(["'])\\\\\1/;
	const lines = content.split("\n");
	const found = [];
	for (let li = 0; li < lines.length; li++) {
		const trimmed = lines[li].trimStart();
		if (trimmed.startsWith("*") || trimmed.startsWith("//") || trimmed.startsWith("/*")) continue;
		// Drop a trailing line comment so an idiom quoted there (documentation, not executed) is ignored.
		const codePart = lines[li].split("//")[0];
		if (re.test(codePart)) {
			const snippet = lines[li].trim();
			found.push({ filePath, lineNumber: li + 1, snippet: snippet.length > 100 ? snippet.slice(0, 100) + "…" : snippet });
		}
	}
	return found;
}

/**
 * Detect malformed block-comment `v8 ignore start` / `v8 ignore stop` ranges.
 *
 * `ast-v8-to-istanbul` (vitest's v8 coverage) tracks ignore depth as a counter: a `start` increments
 * it, a `stop` decrements it, and code is excluded while depth > 0. So a MISSING `stop` (or a second
 * `start` before the first one closes — the ranges do NOT nest) leaves the depth stuck above zero and
 * silently excludes everything from that point to END-OF-FILE from the coverage map. The excluded
 * lines are counted as neither covered nor uncovered, so a file's reported coverage becomes a fraction
 * of its real lines while still reading as "100%" — exactly how api_builder.mjs (a missing stop) hid
 * ~2,800 lines. Flags three failure modes: a nested `start` (one opened while another is still open),
 * a stray `stop` (none open), and any `start` left unclosed at EOF.
 *
 * @internal
 * @param {string} content - File source.
 * @param {string} filePath - Absolute path, for reporting.
 * @returns {Array<{filePath: string, lineNumber: number, kind: string, detail: string}>} One per anomaly.
 */
function findUnbalancedV8Ignores(content, filePath) {
	const issues = [];
	const lines = content.split("\n");
	// Match only an actual directive comment opener: `/*` (optional ws) then `v8 ignore start|stop`.
	// Prose mentions ("a v8 ignore-next comment") and JSDoc lines (` * v8 ignore`) never match.
	const directive = /\/\*\s*v8 ignore (start|stop)\b/;
	let depth = 0;
	let openLine = null; // line where depth became 1 (for the unclosed report)
	let nestedReported = false; // one nested-start report per open episode (avoid cascade noise)
	for (let i = 0; i < lines.length; i++) {
		const m = lines[i].match(directive);
		if (!m) continue;
		const ln = i + 1;
		if (m[1] === "start") {
			if (depth === 0) {
				openLine = ln;
				nestedReported = false;
			} else if (!nestedReported) {
				issues.push({
					filePath,
					lineNumber: ln,
					kind: "nested start",
					detail: `'v8 ignore start' while the start at line ${openLine} is still open — these ranges don't nest, and a missing 'stop' makes the coverage map ignore to end-of-file`
				});
				nestedReported = true;
			}
			depth++;
		} else {
			if (depth === 0) {
				issues.push({ filePath, lineNumber: ln, kind: "stray stop", detail: "'v8 ignore stop' with no matching open 'v8 ignore start'" });
			} else {
				depth--;
				if (depth === 0) {
					openLine = null;
					nestedReported = false;
				}
			}
		}
	}
	if (depth > 0) {
		issues.push({
			filePath,
			lineNumber: openLine,
			kind: "unclosed start",
			detail:
				"'v8 ignore start' is never closed by a matching 'v8 ignore stop' — the coverage map ignores everything from here to end-of-file"
		});
	}
	return issues;
}

/**
 * Analyze error and determine status
 * @internal
 */
function analyzeError(error) {
	const issues = [];

	// Check for old async SlothletError.create pattern (should be removed)
	if (error.fullMatch.includes("SlothletError.create")) {
		issues.push("❌ Uses deprecated SlothletError.create (should be synchronous: new SlothletError(...))");
		return { status: "❌ DEPRECATED PATTERN", issues };
	}

	// Stub errors should be tracked for replacement
	if (error.isStub) {
		const stubHint = error.hasHardcodedHint
			? "Has custom hint - preserve this when implementing the feature"
			: "No custom hint - add proper hint when implementing";
		return {
			status: "⚠️  STUB (Needs Implementation)",
			issues: [`📝 ${stubHint}. Remove stub:true and add proper error handling when feature is implemented.`],
			isStubWarning: true
		};
	}

	// Validation errors don't need originalError
	if (error.isValidation) {
		return { status: "✅ OK (Validation)", issues: [] };
	}

	// Warnings don't need originalError (they're informational, not wrapping errors)
	if (error.errorCode.startsWith("WARNING_") || error.fullMatch.includes("SlothletWarning")) {
		// Still check for translation and hint
		const hasTranslation = checkTranslationExists(error.errorCode);
		const hasHint = checkHintExists(error.errorCode);

		if (!hasTranslation) {
			issues.push("❌ Missing error translation (needs error code key in translations)");
		}
		if (!hasHint) {
			issues.push("❌ No hint in translations (needs HINT_ key)");
		}

		const status = issues.length === 0 ? "✅ OK (Warning)" : "❌ Issues";
		return { status, issues, hasHint, hasTranslation };
	}

	// Rethrows of existing SlothletErrors are fine (bare "throw error;" or "throw err;")
	const isRethrow =
		error.code === "SlothletError" &&
		(error.context.includes("throw error;") || error.context.includes("throw err;") || /throw\s+(error|err)\s*;/.test(error.context));
	if (isRethrow) {
		return { status: "✅ OK (Rethrow)", issues: [] };
	}

	// Real errors with underlying failures need originalError
	if (!error.hasOriginalError) {
		issues.push("Missing originalError parameter");
	}

	// Check if hardcoded hint exists (only allowed for stubs)
	if (error.hasHardcodedHint && !error.isStub) {
		issues.push("Has hardcoded hint - should use i18n instead (hint only allowed in stub errors)");
	}

	// Check if error code translation exists
	const hasTranslation = checkTranslationExists(error.errorCode);
	if (!hasTranslation && !error.isStub) {
		issues.push("❌ Missing error translation (needs error code key in translations)");
	}

	// Check if a hint exists in translations
	const hasHint = checkHintExists(error.errorCode);
	if (!hasHint && !error.hasHardcodedHint && !error.isStub) {
		issues.push("❌ No hint in translations (needs HINT_ key)");
	}

	const status = issues.length === 0 ? "✅ OK" : "❌ Issues";
	return { status, issues, hasHint, hasTranslation };
}

/**
 * Check if translation exists for error code
 * @internal
 */
function checkTranslationExists(errorCode) {
	return Object.prototype.hasOwnProperty.call(translations, errorCode);
}

/**
 * Check if hint exists for error code
 * @internal
 */
function checkHintExists(errorCode) {
	// Convention: CONTEXT_NOT_FOUND → HINT_CONTEXT_NOT_FOUND
	const hintKey = `HINT_${errorCode}`;
	return hintKeys.includes(hintKey);
}

// Main execution
console.log("\n=== SlothletError Analysis ===\n");

// Get all files from src/ for error analysis
const files = await findMjsFiles(srcDir);
const allErrors = [];

for (const filePath of files) {
	const content = await readCached(filePath);
	const errors = parseErrorThrows(content, filePath);
	allErrors.push(...errors);
}

// Also find direct t() and translate() usage for warnings, debug, and other translations
const directTranslationUsage = new Set();
for (const filePath of files) {
	const content = await readCached(filePath);
	// Match t("KEY", ...) or t('KEY', ...) - direct shorthand calls
	const tCallPattern = /\bt\(\s*["']([A-Z0-9_]+)["']/g;
	// Match translate("KEY", ...) or translate('KEY', ...) - direct full-function calls
	const translateCallPattern = /\btranslate\(\s*["']([A-Z0-9_]+)["']/g;
	let match;
	while ((match = tCallPattern.exec(content)) !== null) {
		directTranslationUsage.add(match[1]);
	}
	while ((match = translateCallPattern.exec(content)) !== null) {
		directTranslationUsage.add(match[1]);
	}
	// Extract key: "KEY" from .debug() calls using balanced-paren extraction so property values
	// that contain nested {} (e.g. `Object.keys(impl || {})`) don't break detection.
	// Anchored to .debug( so only debug call objects are scanned — not unrelated key: properties.
	const debugCallAnchor = /\.debug\(/g;
	let debugAnchorMatch;
	while ((debugAnchorMatch = debugCallAnchor.exec(content)) !== null) {
		const openParen = debugAnchorMatch.index + debugAnchorMatch[0].length - 1;
		let depth = 0;
		let end = -1;
		for (let i = openParen; i < content.length; i++) {
			if (content[i] === "(") depth++;
			else if (content[i] === ")") {
				depth--;
				if (depth === 0) {
					end = i;
					break;
				}
			}
		}
		if (end === -1) continue;
		const callBody = content.slice(openParen + 1, end);
		// Scan for ALL quoted ALL_UPPER_SNAKE_CASE strings in the call body.
		// Using /g + while loop handles both direct key: "KEY" and ternary
		// key: cond ? "KEY_A" : "KEY_B" patterns. Requiring at least one
		// underscore excludes the lowercase category arg ("modes", "api", etc.).
		// [A-Z0-9_] handles keys containing digits (e.g. RULE_13_*).
		const upperKeyPattern = /["']([A-Z][A-Z0-9_]*_[A-Z0-9_]+)["']/g;
		let upperKeyMatch;
		while ((upperKeyMatch = upperKeyPattern.exec(callBody)) !== null) {
			directTranslationUsage.add(upperKeyMatch[1]);
		}
	}
}

// Also scan tests/vitests for translation keys used directly in tests (e.g. as SlothletError
// codes in unit tests, or translate("KEY") calls). These are legitimate usages even though
// they don't appear as throws in src/ — without this, test-only keys get flagged as orphaned.
// NOTE: stored in a SEPARATE set so it only feeds the "unused" check, not "missing" check.
// (Tests may intentionally use fake/sentinel keys like INVALID_CONFIG_TOTALLY_UNKNOWN_KEY_ZZ
// to verify error-code fallback behaviour — those should not be required to have translations.)
const testTranslationUsage = new Set();
const testFiles = await findMjsFiles(join(rootDir, "tests", "vitests"));
// Patterns: new SlothletError("KEY") / new SlothletWarning("KEY") / t("KEY") / translate("KEY")
const testErrorCodePattern = /new\s+Slothlet(?:Error|Warning)\(\s*["']([A-Z0-9_]+)["']/g;
const testTCallPattern = /\bt\(\s*["']([A-Z0-9_]+)["']/g;
const testTranslateCallPattern = /\btranslate\(\s*["']([A-Z0-9_]+)["']/g;
for (const filePath of testFiles) {
	const content = await readCached(filePath);
	let m;
	while ((m = testErrorCodePattern.exec(content)) !== null) testTranslationUsage.add(m[1]);
	while ((m = testTCallPattern.exec(content)) !== null) testTranslationUsage.add(m[1]);
	while ((m = testTranslateCallPattern.exec(content)) !== null) testTranslationUsage.add(m[1]);
}

console.log(`Found ${allErrors.length} error throws\n`);
if (VERBOSE) {
	console.log(`Available hints: ${hintKeys.join(", ")}\n`);
	console.log(`Direct t() usage: ${directTranslationUsage.size} translation keys\n`);
}

// Filter to only errors with issues unless --verbose
const errorsToShow = VERBOSE
	? allErrors
	: allErrors.filter((e) => {
			const analysis = analyzeError(e);
			return analysis.issues.length > 0 && !analysis.isStubWarning;
		});

// Separate stub warnings for summary
const stubErrors = allErrors.filter((e) => analyzeError(e).isStubWarning);

if (errorsToShow.length > 0) {
	console.log(`Showing first ${Math.min(LIMIT, errorsToShow.length)} of ${errorsToShow.length} errors\n`);
}
console.log("=".repeat(80));

let shown = 0;
for (const error of errorsToShow) {
	if (shown >= LIMIT) break;

	const analysis = analyzeError(error);
	const relPath = relative(rootDir, error.filePath);

	console.log(`\n[${shown + 1}] ${relPath}:${error.lineNumber}`);
	console.log(`    Code: ${error.errorCode}`);
	console.log(`    Status: ${analysis.status}`);
	console.log(`    Has Translation: ${analysis.hasTranslation ? "✅ Yes" : "❌ No"}`);
	console.log(`    Has Hint: ${analysis.hasHint ? "✅ Yes" : "❌ No"}`);

	if (analysis.issues.length > 0) {
		console.log(`    Issues:`);
		analysis.issues.forEach((issue) => console.log(`      - ${issue}`));
	}

	console.log(`    Call:\n${error.fullMatch}`);

	shown++;
}

console.log("\n" + "=".repeat(80));

// Count errors with issues
const errorsWithIssues = allErrors.filter((e) => analyzeError(e).issues.length > 0);

const mode = VERBOSE ? "all errors" : "errors with issues only";
console.log(`\nShown: ${shown} ${mode} (${allErrors.length} total)`);

if (!VERBOSE && errorsWithIssues.length > LIMIT) {
	console.log(`\nTo see more, run: node tools/analyze-errors.mjs --limit=${errorsWithIssues.length}`);
}

// Summary stats
const stubCount = allErrors.filter((e) => e.isStub).length;

console.log(`\nSummary:`);
console.log(`  Total Errors: ${allErrors.length}`);
console.log(`  Stubs: ${stubCount}`);
console.log(`  With Issues: ${errorsWithIssues.length}`);
console.log(`  OK: ${allErrors.length - errorsWithIssues.length}`);

if (stubCount > 0) {
	console.log(`\n⚠️  ${stubCount} stub error(s) need implementation:`);
	stubErrors.slice(0, 5).forEach((error) => {
		const analysis = analyzeError(error);
		const relPath = relative(rootDir, error.filePath);
		console.log(`  - ${error.errorCode} (${relPath}:${error.lineNumber})`);
		console.log(`    ${analysis.issues[0]}`);
	});
	if (stubCount > 5) {
		console.log(`  ... and ${stubCount - 5} more. Use --verbose to see all.`);
	}
}

if (!VERBOSE && errorsWithIssues.length === 0 && stubCount === 0) {
	console.log(`\n✅ All errors are properly configured!`);
} else if (!VERBOSE && errorsWithIssues.length === 0 && stubCount > 0) {
	console.log(`\n✅ All non-stub errors are properly configured!`);
}

// ===== TRANSLATION ANALYSIS =====

console.log("\n\n" + "=".repeat(80));
console.log("=== Translation Analysis ===");
console.log("=".repeat(80) + "\n");

// Collect all error codes used in codebase (from SlothletError + direct t() calls)
const usedErrorCodes = new Set([...allErrors.map((e) => e.errorCode), ...directTranslationUsage]);

// Keys intentionally used via console.warn in translations.mjs itself (circular dependency -
// SlothletWarning cannot be imported in the i18n module, so these are used as raw string lookups).
const CIRCULAR_I18N_KEYS = new Set(["WARNING_LANGUAGE_LOAD_FAILED", "WARNING_LANGUAGE_UNAVAILABLE"]);
for (const key of CIRCULAR_I18N_KEYS) usedErrorCodes.add(key);

// Get all translation keys (excluding HINT_ keys, but including DEBUG_ since they can be used directly)
const translationKeys = Object.keys(translations).filter((k) => !k.startsWith("HINT_"));

// Find missing translations
const missingTranslations = [...usedErrorCodes].filter((code) => !translations[code]);

// Find unused translations (translations that exist but are never used)
const unusedTranslations = translationKeys.filter((key) => !usedErrorCodes.has(key));

// Check placeholder consistency
console.log("\n📋 Placeholder Consistency Check:\n");
const placeholderIssues = [];

for (const error of allErrors) {
	const translation = translations[error.errorCode];
	if (!translation) continue;

	// Extract placeholders from translation (e.g., {apiPath}, {error})
	const translationPlaceholders = (translation.match(/\{([^}]+)\}/g) || []).map((p) => p.slice(1, -1)).sort();

	// Extract context keys from error usage
	// SlothletError signature: new SlothletError(code, context = {}, originalError = null, options = { validationError, stub })
	let usedPlaceholders = [];

	// Try to extract the full parameter list by finding balanced parentheses
	const startIdx = error.fullMatch.indexOf("(");
	if (startIdx !== -1) {
		let depth = 0;
		let endIdx = -1;
		for (let i = startIdx; i < error.fullMatch.length; i++) {
			if (error.fullMatch[i] === "(") depth++;
			if (error.fullMatch[i] === ")") {
				depth--;
				if (depth === 0) {
					endIdx = i;
					break;
				}
			}
		}

		if (endIdx !== -1) {
			const paramsContent = error.fullMatch.substring(startIdx + 1, endIdx);

			// Split by top-level commas (not inside nested braces/parens)
			const params = [];
			let current = "";
			let braceDepth = 0;
			let parenDepth = 0;

			for (let i = 0; i < paramsContent.length; i++) {
				const char = paramsContent[i];
				if (char === "{") braceDepth++;
				if (char === "}") braceDepth--;
				if (char === "(") parenDepth++;
				if (char === ")") parenDepth--;

				if (char === "," && braceDepth === 0 && parenDepth === 0) {
					params.push(current.trim());
					current = "";
				} else {
					current += char;
				}
			}
			if (current.trim()) {
				params.push(current.trim());
			}

			// Extract context from 2nd parameter (index 1)
			if (params.length >= 2) {
				const contextParam = params[1].trim();

				// Only process if it's an object literal { ... }
				if (contextParam.startsWith("{") && contextParam.endsWith("}")) {
					// Strip JS comments first: a `// …` or `/* … */` inside the context literal would
					// otherwise be split as a bogus "property" (commas/braces in the comment confuse the
					// key extraction). Comments are legitimate here, so the parser must ignore them.
					const objectContent = stripComments(contextParam.slice(1, -1)).trim();

					// Extract key names from object literal (both longhand and shorthand)
					// Split by comma, but respect nested structures (braces, brackets, parentheses, strings)
					const properties = [];
					let current = "";
					let depth = 0;
					let inString = false;
					let stringChar = "";

					for (let i = 0; i < objectContent.length; i++) {
						const char = objectContent[i];

						// Track string boundaries
						if ((char === '"' || char === "'" || char === "`") && !isEscaped(objectContent, i)) {
							if (inString && char === stringChar) {
								inString = false;
								stringChar = "";
							} else if (!inString) {
								inString = true;
								stringChar = char;
							}
						}

						// Track nesting depth (only when not in string)
						if (!inString) {
							if (char === "{" || char === "[" || char === "(") depth++;
							if (char === "}" || char === "]" || char === ")") depth--;
						}

						// Split on commas only at depth 0 and outside strings
						if (char === "," && depth === 0 && !inString) {
							properties.push(current.trim());
							current = "";
						} else {
							current += char;
						}
					}
					if (current.trim()) {
						properties.push(current.trim());
					}

					// Extract key from each property (either "key:" or just "key")
					usedPlaceholders = properties
						.map((prop) => {
							// Check for longhand (key: value)
							const colonIdx = prop.indexOf(":");
							if (colonIdx !== -1) {
								// Extract key only (left side of colon)
								const key = prop.substring(0, colonIdx).trim();
								// Extract just identifier, ignore computed property syntax
								const identMatch = key.match(/^(\w+)/);
								return identMatch ? identMatch[1] : key;
							}
							// Shorthand property (just identifier)
							// Extract just the identifier, ignoring any inline expressions like || or ?.
							// Match the first valid identifier
							const identMatch = prop.match(/^(\w+)/);
							return identMatch ? identMatch[1] : prop.trim();
						})
						.filter(Boolean);
				}
			}

			// Check 4th parameter (options) for new API (rare, code is migrating)
			if (params.length >= 4) {
				// New API: options object in 4th param
				// Remove validationError and stub from usedPlaceholders if in options
				usedPlaceholders = usedPlaceholders.filter((p) => p !== "validationError" && p !== "stub");
			}

			// Special handling for metadata/system parameters:
			// - stub: Flag extracted from context, marks placeholder errors needing work
			// - validationError: Flag extracted from context, skips hint detection
			// Note: 'hint' CAN be passed to override auto-detection, so don't filter it
			usedPlaceholders = usedPlaceholders.filter((p) => p !== "stub" && p !== "validationError");

			usedPlaceholders.sort();
		}
	}

	// Compare placeholder arrays
	const translationSet = new Set(translationPlaceholders);
	const usedSet = new Set(usedPlaceholders);

	// Special handling for {error} placeholder:
	// - Non-validation errors: {error} is auto-added from originalError param, so ignore if missing from usage
	// - Validation errors: Should NOT have {error} in translation (no originalError)
	let missingInUsage = translationPlaceholders.filter((p) => !usedSet.has(p));
	let validationErrorIssue = null;

	if (error.isValidation && translationPlaceholders.includes("error")) {
		validationErrorIssue = "Validation error should not have {error} in translation (no originalError param)";
	} else if (!error.isValidation) {
		// Filter out 'error' from missing - it's auto-added from originalError
		missingInUsage = missingInUsage.filter((p) => p !== "error");
	}

	const extraInUsage = usedPlaceholders.filter((p) => !translationSet.has(p));

	// Check for forbidden placeholders (error/message should be in originalError param, not context)
	const forbiddenInContext = usedPlaceholders.filter((p) => p === "error" || p === "message");

	if (missingInUsage.length > 0 || extraInUsage.length > 0 || forbiddenInContext.length > 0 || validationErrorIssue) {
		const relPath = relative(rootDir, error.filePath);
		placeholderIssues.push({
			code: error.errorCode,
			file: `${relPath}:${error.lineNumber}`,
			missingInUsage,
			extraInUsage,
			forbiddenInContext,
			validationErrorIssue,
			translationPlaceholders,
			usedPlaceholders
		});
	}
}

if (placeholderIssues.length > 0) {
	console.log(`❌ Found ${placeholderIssues.length} placeholder mismatches:\n`);
	placeholderIssues.slice(0, Math.min(LIMIT, placeholderIssues.length)).forEach((issue, idx) => {
		console.log(`[${idx + 1}] ${issue.code} (${issue.file})`);
		if (issue.validationErrorIssue) {
			console.log(`    🚫 ${issue.validationErrorIssue}`);
		}
		if (issue.forbiddenInContext && issue.forbiddenInContext.length > 0) {
			console.log(`    🚫 FORBIDDEN in context (use 3rd param originalError instead): ${issue.forbiddenInContext.join(", ")}`);
		}
		if (issue.missingInUsage.length > 0) {
			console.log(`    ⚠️  Translation expects but usage missing: ${issue.missingInUsage.join(", ")}`);
		}
		if (issue.extraInUsage.length > 0) {
			console.log(`    ⚠️  Usage provides but translation doesn't use: ${issue.extraInUsage.join(", ")}`);
		}
		console.log(`    Translation: [${issue.translationPlaceholders.join(", ")}]`);
		console.log(`    Usage:       [${issue.usedPlaceholders.join(", ")}]`);
		console.log();
	});
} else {
	console.log(`✅ All placeholders match between usage and translations\n`);
}

// Missing translations report
if (missingTranslations.length > 0) {
	console.log(`\n❌ Missing Translations (${missingTranslations.length}):\n`);
	missingTranslations.forEach((code) => {
		const locations = allErrors
			.filter((e) => e.errorCode === code)
			.map((e) => {
				const relPath = relative(rootDir, e.filePath);
				return `${relPath}:${e.lineNumber}`;
			});
		console.log(`  ${code}`);
		console.log(`    Used in: ${locations.join(", ")}`);
	});
	console.log();
} else {
	console.log(`\n✅ All error codes have translations\n`);
}

// Unused translations report
// Detection coverage notes:
//   - HINT_* keys are EXCLUDED from this check - they are resolved dynamically by the error
//     system via `HINT_${errorCode}` convention and via hint-detector.mjs rule matching.
//   - DEBUG_MODE_* and FLATTEN_REASON_* keys are detected via key: "KEY" property scan (this.debug() calls).
//   - WARNING_LANGUAGE_LOAD_FAILED / WARNING_LANGUAGE_UNAVAILABLE are excluded because they
//     are used via console.warn in translations.mjs itself (circular dependency workaround).
//   - Any key still appearing here has no SlothletError throw or t("KEY") literal usage in src/.
const hintKeyCount = Object.keys(translations).filter((k) => k.startsWith("HINT_")).length;

if (unusedTranslations.length > 0) {
	console.log(`\n⚠️  Unused Translations (${unusedTranslations.length} of ${translationKeys.length} non-HINT_ keys):\n`);
	console.log(`  (${hintKeyCount} HINT_* keys excluded - resolved dynamically by the error system)`);
	console.log(
		`  (${CIRCULAR_I18N_KEYS.size} circular i18n keys excluded - used directly in translations.mjs: ${[...CIRCULAR_I18N_KEYS].join(", ")})\n`
	);

	// Group by prefix family for easier analysis
	const groups = {};
	for (const key of unusedTranslations) {
		// Determine prefix family: take everything up to the second underscore segment, or falling back to the first
		const parts = key.split("_");
		// Group by first 1-2 segments: e.g. INVALID_CONFIG, MODULE, RUNTIME, WARNING, INTERNAL, etc.
		let family;
		if (
			parts.length >= 2 &&
			(parts[0] === "INVALID" ||
				parts[0] === "NO" ||
				parts[0] === "WARNING" ||
				parts[0] === "INTERNAL" ||
				parts[0] === "FLATTEN" ||
				parts[0] === "DEBUG" ||
				parts[0] === "HINT")
		) {
			family = `${parts[0]}_${parts[1] || ""}`;
		} else {
			family = parts[0];
		}
		if (!groups[family]) groups[family] = [];
		groups[family].push(key);
	}

	for (const [family, keys] of Object.entries(groups).sort()) {
		console.log(`  [${family}*] (${keys.length})`);
		for (const key of keys) {
			const val = translations[key];
			const preview = val.substring(0, 70) + (val.length > 70 ? "..." : "");
			console.log(`    ${key}`);
			console.log(`      "${preview}"`);
		}
		console.log();
	}

	console.log(`  Note: These keys have no SlothletError throw or t("KEY") literal in src/.`);
	console.log(`        They may be: stale/removed keys, reserved for future use, or used via`);
	console.log(`        a dynamic pattern not covered by this analyzer.`);
	console.log();
} else {
	console.log(`\n✅ All translations are used\n`);
	console.log(`  (${hintKeyCount} HINT_* keys excluded - resolved dynamically by the error system)\n`);
}

// Summary
// ===== INVALID KEY FORMAT ANALYSIS =====
// ===== TRANSLATION CONTENT QUALITY =====
console.log("\n" + "=".repeat(80));
console.log("=== Translation Content Quality (Non-English Locales) ===");
console.log("=".repeat(80) + "\n");

// Load all locale files and check for untranslated keys (values matching English)
const localesDir = join(srcDir, "lib", "i18n", "languages");
const localeFiles = (await readdir(localesDir)).filter((f) => f.endsWith(".json") && f !== "en-us.json");

const untranslatedByLocale = {};

for (const localeFile of localeFiles) {
	const localeCode = localeFile.replace(".json", "");
	const localeFilePath = join(localesDir, localeFile);
	const localeContent = await readFile(localeFilePath, "utf-8");
	const localeData = JSON.parse(localeContent);
	const localeTranslations = localeData.translations || {};

	// Locales that are allowed to match English (e.g., en-gb is British English variant)
	const allowIdenticalTo = ["en-gb"];

	if (!allowIdenticalTo.includes(localeCode)) {
		const untranslated = [];

		// Check each key in English
		for (const key of translationKeys) {
			// Skip HINT_ keys - they're metadata, not user-facing translations
			if (key.startsWith("HINT_")) {
				continue;
			}

			const enUsValue = translations[key];
			const localeValue = localeTranslations[key];

			// Value should not be identical to English
			if (localeValue === enUsValue) {
				untranslated.push(key);
			}
		}

		if (untranslated.length > 0) {
			untranslatedByLocale[localeCode] = untranslated;
		}
	}
}

const untranslatedLocaleCount = Object.keys(untranslatedByLocale).length;
const untranslatedKeyCount = Object.values(untranslatedByLocale).reduce((sum, keys) => sum + keys.length, 0);

if (untranslatedLocaleCount > 0) {
	console.log(`❌ Found untranslated keys in ${untranslatedLocaleCount} locale(s):\n`);

	for (const [localeCode, untranslated] of Object.entries(untranslatedByLocale)) {
		console.log(`  [${localeCode}] ${untranslated.length} untranslated key(s):`);
		const shown = untranslated.slice(0, Math.min(LIMIT, untranslated.length));
		shown.forEach((key) => console.log(`    - ${key}`));
		if (untranslated.length > LIMIT) {
			console.log(`    ... and ${untranslated.length - LIMIT} more`);
		}
		console.log();
	}

	console.log(`\n📝 To fix:\n   Ensure all translation keys in non-English locale files are properly`);
	console.log(`   localized. Keys should not have values matching the English version.\n`);
} else {
	console.log(`✅ All non-English locales are properly localized (no keys match English)\n`);
}

console.log("\n" + "=".repeat(80));
console.log("=== Invalid Translation Key Format ===");
console.log("=".repeat(80) + "\n");

// Check for non-capitalized translation keys (should be UPPER_CASE_WITH_UNDERSCORES)
const validKeyPattern = /^[A-Z][A-Z0-9]*(_[A-Z0-9]+)*$/;
const invalidKeys = [];

// Check all translation keys
for (const key of translationKeys) {
	if (!validKeyPattern.test(key)) {
		// Find where this key is used
		const usageLocations = [];

		// Check in error throws
		for (const error of allErrors) {
			if (error.errorCode === key) {
				const relPath = relative(rootDir, error.filePath);
				usageLocations.push(`${relPath}:${error.lineNumber}`);
			}
		}

		// Check in direct t() calls (src/) or test-file usage
		if (directTranslationUsage.has(key) || testTranslationUsage.has(key)) {
			// Find which files use this key in t() calls
			for (const file of files) {
				const content = await readCached(file);
				const tCallPattern = new RegExp(`\\bt\\(\\s*["']${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["']`, "g");
				let match;
				while ((match = tCallPattern.exec(content)) !== null) {
					const beforeMatch = content.substring(0, match.index);
					const lineNumber = beforeMatch.split("\n").length;
					const relPath = relative(rootDir, file);
					usageLocations.push(`${relPath}:${lineNumber}`);
				}
			}
		}

		invalidKeys.push({
			key,
			translation: translations[key],
			usageLocations: [...new Set(usageLocations)] // Remove duplicates
		});
	}
}

if (invalidKeys.length > 0) {
	console.log(`❌ Found ${invalidKeys.length} translation keys with invalid format:\n`);
	console.log(`   Convention: UPPER_CASE_WITH_UNDERSCORES (e.g., ERROR_INVALID_CONFIG)\n`);

	invalidKeys.forEach((item, idx) => {
		console.log(`[${idx + 1}] ${item.key}`);
		console.log(`    Translation: "${item.translation.substring(0, 60)}${item.translation.length > 60 ? "..." : ""}"`);
		if (item.usageLocations.length > 0) {
			console.log(`    Used in:`);
			item.usageLocations.forEach((loc) => console.log(`      - ${loc}`));
		} else {
			console.log(`    ⚠️  Not used in codebase (unused translation with invalid format)`);
		}
		console.log();
	});
} else {
	console.log(`✅ All translation keys follow proper naming convention (UPPER_CASE_WITH_UNDERSCORES)\n`);
}

// ===== CONSOLE.WARN DETECTION =====
console.log("\n" + "=".repeat(80));
console.log("=== Console.warn Detection (Should Use SlothletWarning) ===");
console.log("=".repeat(80) + "\n");

const allConsoleWarns = [];
for (const file of files) {
	const content = await readCached(file);
	const warns = parseConsoleWarns(content, file);
	allConsoleWarns.push(...warns);
}

if (allConsoleWarns.length > 0) {
	console.log(`⚠️  Found ${allConsoleWarns.length} console.warn calls in src folder:\n`);
	console.log(`   These should be converted to SlothletWarning with proper translation keys.\n`);

	allConsoleWarns.forEach((warn, idx) => {
		const relPath = relative(rootDir, warn.filePath);
		console.log(`[${idx + 1}] ${relPath}:${warn.lineNumber}`);
		console.log(`    Code: ${warn.fullMatch.substring(0, 80)}${warn.fullMatch.length > 80 ? "..." : ""}`);
		console.log(`    First Arg: ${warn.firstArg.substring(0, 60)}${warn.firstArg.length > 60 ? "..." : ""}`);
		console.log(`    ⚠️  Should use: new SlothletWarning("WARNING_KEY", { context })`);
		console.log();
	});
} else {
	console.log(`✅ No console.warn calls found in src folder\n`);
}

// ===== HARDCODED REASON STRINGS DETECTION =====
console.log("\n" + "=".repeat(80));
console.log("=== Hardcoded 'reason:' Strings Detection ===");
console.log("=".repeat(80) + "\n");

/**
 * Parse hardcoded reason: strings that should use i18n
 * @param {string} content - File content
 * @param {string} filePath - File path
 * @returns {Array} Array of hardcoded reason strings
 * @internal
 */
function parseHardcodedReasons(content, filePath) {
	const reasons = [];
	// Match: reason: "string" or reason: 'string' (not using await t())
	const reasonPattern = /reason:\s*["'`]([^"'`]+)["'`]/g;

	let match;
	while ((match = reasonPattern.exec(content)) !== null) {
		// Check if this match is inside a comment
		const beforeMatch = content.substring(0, match.index);
		const lastLineStart = beforeMatch.lastIndexOf("\n") + 1;
		const currentLine = content.substring(lastLineStart, match.index + match[0].length);

		// Skip if it's in a line comment
		if (currentLine.trim().startsWith("//")) {
			continue;
		}

		// Skip if it's in a block comment
		const blockCommentStart = beforeMatch.lastIndexOf("/*");
		const blockCommentEnd = beforeMatch.lastIndexOf("*/");
		if (blockCommentStart > blockCommentEnd) {
			continue;
		}

		// Find line number
		const lineNumber = beforeMatch.split("\n").length;

		reasons.push({
			filePath,
			lineNumber,
			reasonText: match[1],
			fullMatch: match[0]
		});
	}

	return reasons;
}

const allHardcodedReasons = [];
for (const file of files) {
	const content = await readCached(file);
	const reasons = parseHardcodedReasons(content, file);
	allHardcodedReasons.push(...reasons);
}

if (allHardcodedReasons.length > 0) {
	console.log(`❌ Found ${allHardcodedReasons.length} hardcoded reason: strings:\n`);
	console.log(`   These should use i18n translation keys.\n`);

	allHardcodedReasons.forEach((reason, idx) => {
		const relPath = relative(rootDir, reason.filePath);
		console.log(`[${idx + 1}] ${relPath}:${reason.lineNumber}`);
		console.log(`    Code: ${reason.fullMatch}`);
		console.log(`    Text: "${reason.reasonText}"`);
		console.log(`    ❌ Should use: reason: await t("FLATTEN_REASON_KEY")`);
		console.log();
	});
} else {
	console.log(`✅ No hardcoded reason: strings found\n`);
}

// ===== HARDCODED DEBUG MESSAGE STRINGS DETECTION =====
console.log("\n" + "=".repeat(80));
console.log("=== Hardcoded 'message:' Strings in debug() Calls Detection ===");
console.log("=".repeat(80) + "\n");

// Also find multi-line debug() calls where message: is on its own line
/**
 * Parse hardcoded message: strings inside debug() calls that should use i18n DEBUG_MODE_ keys.
 * Handles multi-line debug() call patterns where `message:` appears on its own line.
 * The correct pattern is: { key: "DEBUG_MODE_KEY", ...params } - no await t() needed.
 * @param {string} content - File content
 * @param {string} filePath - File path
 * @returns {Array} Array of hardcoded debug message strings
 * @internal
 */
function parseHardcodedDebugMessagesMultiline(content, filePath) {
	const messages = [];
	// Match: message: "string" inside a slothlet.debug block. The correct pattern is
	// { key: "DEBUG_MODE_KEY", ...params } - if message: is still a raw string literal, flag it.
	// Strategy: find all `message: "literal"` occurrences, then verify they're inside a debug call
	// by checking if `.debug(` appears within the preceding ~300 chars
	const messagePattern = /message:\s*["'`]([^"'`\n]+)["'`]/g;

	let match;
	while ((match = messagePattern.exec(content)) !== null) {
		const beforeMatch = content.substring(0, match.index);

		// Skip comments
		const lastLineStart = beforeMatch.lastIndexOf("\n") + 1;
		const currentLine = content.substring(lastLineStart, match.index + match[0].length);
		if (currentLine.trim().startsWith("//")) continue;
		const blockCommentStart = beforeMatch.lastIndexOf("/*");
		const blockCommentEnd = beforeMatch.lastIndexOf("*/");
		if (blockCommentStart > blockCommentEnd) continue;

		// Check if this is inside a debug() call (look back up to 300 chars)
		const lookback = beforeMatch.slice(-300);
		if (!lookback.includes(".debug(")) continue;

		// The regex only matches string literals, so { key: "DEBUG_MODE_KEY" } won't trigger this -
		// 'key:' and 'message: await t(...)' are both safe and won't be flagged.

		const lineNumber = beforeMatch.split("\n").length;
		messages.push({
			filePath,
			lineNumber,
			messageText: match[1],
			fullMatch: match[0]
		});
	}
	return messages;
}

const allHardcodedDebugMessages = [];
for (const file of files) {
	const content = await readCached(file);
	// Use multiline strategy (covers both inline and multiline debug calls)
	const msgs = parseHardcodedDebugMessagesMultiline(content, file);
	allHardcodedDebugMessages.push(...msgs);
}

if (allHardcodedDebugMessages.length > 0) {
	console.log(`❌ Found ${allHardcodedDebugMessages.length} hardcoded message: strings in debug() calls:\n`);
	console.log(`   These should use DEBUG_MODE_* translation keys via: key: "DEBUG_MODE_KEY", ...params\n`);

	allHardcodedDebugMessages.forEach((msg, idx) => {
		const relPath = relative(rootDir, msg.filePath);
		// Derive a suggested key: strip non-alphanum, uppercase, prefix DEBUG_MODE_
		const suggestedKey =
			"DEBUG_MODE_" +
			msg.messageText
				.toUpperCase()
				.replace(/[^A-Z0-9]+/g, "_")
				.replace(/^_+|_+$/g, "");
		console.log(`[${idx + 1}] ${relPath}:${msg.lineNumber}`);
		console.log(`    Text: "${msg.messageText}"`);
		console.log(`    ❌ Should use: { key: "${suggestedKey}", ...params }  (no await needed)`);
		console.log();
	});
} else {
	console.log(`✅ No hardcoded message: strings in debug() calls found\n`);
}

// ===== CONSOLE.LOG DETECTION (SRC FOLDER) =====
console.log("\n" + "=".repeat(80));
console.log("=== Console.log Detection (Outside SlothletDebug Class) - src folder ===");
console.log("=".repeat(80) + "\n");

const allConsoleLogs = [];
for (const file of files) {
	const content = await readCached(file);
	const logs = parseConsoleLogs(content, file);
	allConsoleLogs.push(...logs);
}

if (allConsoleLogs.length > 0) {
	console.log(`❌ Found ${allConsoleLogs.length} improper console.log calls in src folder:\n`);
	console.log(`   All console.log must be inside SlothletDebug class or use slothlet.debug().\n`);

	allConsoleLogs.forEach((log, idx) => {
		const relPath = relative(rootDir, log.filePath);
		console.log(`[${idx + 1}] ${relPath}:${log.lineNumber}`);
		console.log(`    Code: ${log.fullMatch.substring(0, 80)}${log.fullMatch.length > 80 ? "..." : ""}`);
		console.log(`    First Arg: ${log.firstArg.substring(0, 60)}${log.firstArg.length > 60 ? "..." : ""}`);
		console.log(`    ❌ Should use: this.slothlet.debug("code", { context })`);
		console.log();
	});
} else {
	console.log(`✅ All console.log calls are inside SlothletDebug class\n`);
}

// ===== CONSOLE.LOG DETECTION (VITEST FOLDER) =====
console.log("\n" + "=".repeat(80));
console.log("=== Console.log Detection - tests/vitests folder ===");
console.log("=".repeat(80) + "\n");

const vitestDir = join(rootDir, "tests", "vitests");
const vitestFiles = await findMjsFiles(vitestDir);

// Exclude test runners and helper utilities that legitimately need console output
const vitestExcludePatterns = [
	"tests/vitests/run-all-vitest.mjs", // Test runner - needs console output
	"tests/vitests/setup/debug-hook-paths.mjs" // Debug utility - intentional console output
];

const vitestConsoleLogs = [];
for (const file of vitestFiles) {
	const relPath = relative(rootDir, file);

	// Skip files that match exclusion patterns
	if (vitestExcludePatterns.some((pattern) => relPath === pattern)) {
		continue;
	}

	const content = await readCached(file);
	const logs = parseConsoleLogs(content, file);
	vitestConsoleLogs.push(...logs);
}

if (vitestConsoleLogs.length > 0) {
	console.log(`❌ Found ${vitestConsoleLogs.length} console.log calls in tests/vitests folder:\n`);
	console.log(`   Test files should not contain console.log statements (causes test output pollution).\n`);

	vitestConsoleLogs.forEach((log, idx) => {
		const relPath = relative(rootDir, log.filePath);
		console.log(`[${idx + 1}] ${relPath}:${log.lineNumber}`);
		console.log(`    Code: ${log.fullMatch.substring(0, 80)}${log.fullMatch.length > 80 ? "..." : ""}`);
		console.log(`    First Arg: ${log.firstArg.substring(0, 60)}${log.firstArg.length > 60 ? "..." : ""}`);
		console.log(`    ❌ Remove console.log or use proper test assertions`);
		console.log();
	});
} else {
	console.log(`✅ No console.log calls found in tests/vitests folder\n`);
}

// ===== CONSOLE.ERROR DETECTION (SRC FOLDER) =====
console.log("\n" + "=".repeat(80));
console.log("=== Console.error Detection (Should Use SlothletError/SlothletWarning) - src folder ===");
console.log("=".repeat(80) + "\n");

const allConsoleErrors = [];
for (const file of files) {
	const content = await readCached(file);
	const errs = parseConsoleErrors(content, file);
	allConsoleErrors.push(...errs);
}

if (allConsoleErrors.length > 0) {
	console.log(`❌ Found ${allConsoleErrors.length} improper console.error calls in src folder:\n`);
	console.log(`   All console.error must be replaced with SlothletError / SlothletWarning + proper translation keys.\n`);

	allConsoleErrors.forEach((err, idx) => {
		const relPath = relative(rootDir, err.filePath);
		console.log(`[${idx + 1}] ${relPath}:${err.lineNumber}`);
		console.log(`    Code: ${err.fullMatch.substring(0, 80)}${err.fullMatch.length > 80 ? "..." : ""}`);
		console.log(`    First Arg: ${err.firstArg.substring(0, 60)}${err.firstArg.length > 60 ? "..." : ""}`);
		console.log(`    ❌ Should use: throw new this.SlothletError("ERROR_KEY", { context })`);
		console.log();
	});
} else {
	console.log(`✅ No console.error calls found in src folder\n`);
}

// ===== BARE new Error() DETECTION (SRC FOLDER) =====
console.log("\n" + "=".repeat(80));
console.log("=== Bare `new Error()` Detection (Should Use SlothletError) - src folder ===");
console.log("=".repeat(80) + "\n");

const allBareNewErrors = [];
for (const file of files) {
	const content = await readCached(file);
	const errs = parseBareNewErrors(content, file);
	allBareNewErrors.push(...errs);
}

if (allBareNewErrors.length > 0) {
	console.log(`❌ Found ${allBareNewErrors.length} bare \`new Error()\` calls in src folder:\n`);
	console.log(`   All errors must use SlothletError with a translation key, not plain Error objects.\n`);

	allBareNewErrors.forEach((err, idx) => {
		const relPath = relative(rootDir, err.filePath);
		console.log(`[${idx + 1}] ${relPath}:${err.lineNumber}`);
		console.log(`    Code: ${err.fullMatch.substring(0, 80)}${err.fullMatch.length > 80 ? "..." : ""}`);
		console.log(`    First Arg: ${err.firstArg.substring(0, 60)}${err.firstArg.length > 60 ? "..." : ""}`);
		console.log(`    ❌ Should use: throw new this.SlothletError("ERROR_KEY", { context })`);
		console.log();
	});
} else {
	console.log(`✅ No bare \`new Error()\` calls found in src folder\n`);
}

// ===== FRAGILE ESCAPE-CHECK DETECTION (src + tools) =====
// #136: deciding "is this delimiter escaped?" from a single fixed neighbor misreads an even run of
// backslashes (an escaped backslash followed by a real quote). Scan src AND tools — this audit's own
// string scanners live in tools/ and are exactly where the bug hid — so the class can't reappear
// unnoticed. The correct form counts the backslash run (isEscaped); see the helper above.
console.log("\n" + "=".repeat(80));
console.log("=== Fragile Escape-Check Detection (count the backslash run, not one neighbor) - src + tools ===");
console.log("=".repeat(80) + "\n");

const escapeCheckFiles = [...files, ...(await findMjsFiles(join(rootDir, "tools")))];
const allFragileEscapeChecks = [];
for (const file of escapeCheckFiles) {
	const content = await readCached(file);
	allFragileEscapeChecks.push(...findFragileEscapeChecks(content, file));
}

if (allFragileEscapeChecks.length > 0) {
	console.log(`❌ Found ${allFragileEscapeChecks.length} fragile single-neighbor escape check(s) in src + tools:\n`);
	console.log(`   A single-neighbor test misreads an even run of backslashes — count the consecutive`);
	console.log(`   backslash run instead (odd ⇒ escaped). Use the isEscaped() helper.\n`);
	allFragileEscapeChecks.forEach((hit, idx) => {
		const relPath = relative(rootDir, hit.filePath);
		console.log(`[${idx + 1}] ${relPath}:${hit.lineNumber}`);
		console.log(`    Code: ${hit.snippet}`);
		console.log(`    ❌ Use: !isEscaped(str, i)  (odd run of preceding backslashes ⇒ escaped)`);
		console.log();
	});
} else {
	console.log(`✅ No fragile single-neighbor escape checks found in src + tools\n`);
}

// ===== VALIDATION ERROR WITH DROPPED originalError DETECTION (SRC FOLDER) =====
// A `validationError: true` throw must NOT also pass a real originalError (3rd arg) cause.
// Validation errors describe bad input and have no upstream cause; their translated templates
// intentionally omit the {error} placeholder (it is the only thing that surfaces a cause). So a
// caught error passed here is silently dropped from the message — the exact regression #136 flagged
// in generate-manifest (a `new Error(\`...: ${err.message}\`)` became a validation SlothletError that
// lost err.message). Fix: drop `validationError: true` (it is a wrapping error — surface {error}),
// or don't pass the cause.
console.log("\n" + "=".repeat(80));
console.log("=== Validation Error With Dropped `originalError` Detection - src folder ===");
console.log("=".repeat(80) + "\n");

const validationErrorsWithCause = [];
for (const error of allErrors) {
	if (!error.isValidation) continue;
	const params = getTopLevelParams(error.fullMatch);
	if (params.length < 3) continue;
	const third = params[2].trim();
	// A real cause is a non-null 3rd arg that is not an options/context object literal ({ ... }).
	if (third && third !== "null" && third !== "undefined" && !third.startsWith("{")) {
		validationErrorsWithCause.push({ ...error, cause: third });
	}
}

if (validationErrorsWithCause.length > 0) {
	console.log(`❌ Found ${validationErrorsWithCause.length} validation error(s) that pass an originalError cause:\n`);
	console.log(`   These drop the cause's message (validation templates have no {error} placeholder).`);
	console.log(`   Drop \`validationError: true\` and surface {error}, or don't pass the cause.\n`);
	validationErrorsWithCause.forEach((error, idx) => {
		const relPath = relative(rootDir, error.filePath);
		console.log(`[${idx + 1}] ${error.errorCode} (${relPath}:${error.lineNumber})`);
		console.log(`    Passes cause: ${error.cause}`);
		console.log();
	});
} else {
	console.log(`✅ No validation errors pass a dropped originalError cause\n`);
}

// ===== UNBALANCED v8 ignore start/stop DETECTION (SRC FOLDER) =====
// A missing `stop` (or a nested second `start`) leaves ast-v8-to-istanbul's ignore-depth counter
// stuck > 0 and silently drops everything to EOF from the coverage map — a file then reads "100%"
// while most of it is untracked (api_builder.mjs hid ~2,800 lines this way). MUST-FIX: it corrupts
// the coverage gate itself.
console.log("\n" + "=".repeat(80));
console.log("=== Unbalanced `v8 ignore start/stop` Detection - src folder ===");
console.log("=".repeat(80) + "\n");

const allUnbalancedV8Ignores = [];
for (const file of files) {
	const content = await readCached(file);
	allUnbalancedV8Ignores.push(...findUnbalancedV8Ignores(content, file));
}

if (allUnbalancedV8Ignores.length > 0) {
	console.log(`❌ Found ${allUnbalancedV8Ignores.length} malformed \`v8 ignore start/stop\` range(s) in src folder:\n`);
	console.log(`   Each leaves ast-v8-to-istanbul's ignore-depth > 0 and excludes code to end-of-file from`);
	console.log(`   the coverage map — the file reads as covered while large regions are untracked.\n`);
	allUnbalancedV8Ignores.forEach((hit, idx) => {
		const relPath = relative(rootDir, hit.filePath);
		console.log(`[${idx + 1}] ${relPath}:${hit.lineNumber}  (${hit.kind})`);
		console.log(`    ${hit.detail}`);
		console.log();
	});
} else {
	console.log(`✅ All \`v8 ignore start/stop\` ranges are balanced in src folder\n`);
}

// ===== FILE HEADER DETECTION =====
console.log("\n" + "=".repeat(80));
console.log("=== File Header Detection ===");
console.log("=".repeat(80) + "\n");

// Get all files from configured folders for header check
const headerCheckFiles = await findMjsFilesInFolders(FILE_HEADER_CHECK_FOLDERS, FILE_HEADER_IGNORE_FOLDERS, FILE_HEADER_EXTENSIONS);

const filesWithoutHeaders = [];
const filesWithDuplicateHeaders = [];
for (const file of headerCheckFiles) {
	const content = await readCached(file);
	if (!hasProperFileHeader(content, file)) {
		filesWithoutHeaders.push(file);
	}
	// A stacked/duplicate header = a second @Project header BLOCK immediately following the
	// first (e.g. fix:headers prepending a /** */ block above an existing /* */ one), which
	// the single-header regex above can't see (it anchors to ^). Match the block STRUCTURE,
	// not a bare @Project mention, so files that legitimately contain the header text (header
	// templates, this analyzer's own detection regex) aren't false-flagged.
	const normalizedForDup = content.startsWith("#!") ? content.replace(/^#![^\n]*\n\s*/, "") : content;
	const stackedHeader = /^\/\*\*?\s*\n\s*\*\s*@Project:\s*@cldmv\/slothlet[\s\S]*?\*\/\s*\/\*\*?\s*\n\s*\*\s*@Project:\s*@cldmv\/slothlet/;
	if (stackedHeader.test(normalizedForDup)) {
		filesWithDuplicateHeaders.push(file);
	}
}

if (filesWithoutHeaders.length > 0) {
	console.log(`❌ Found ${filesWithoutHeaders.length} files missing proper file header:\n`);
	console.log(`   All src files should have the standard file header with project metadata.\n`);

	filesWithoutHeaders.forEach((file, idx) => {
		const relPath = relative(rootDir, file);
		console.log(`[${idx + 1}] ${relPath}`);
	});

	console.log();
	console.log(`📝 Header Format Instructions:\n`);
	console.log(`   See src/slothlet.mjs for the correct header format.\n`);
	console.log(`   Required fields:`);
	console.log(`   - @Project: @cldmv/slothlet`);
	console.log(`   - @Filename: /[relative-path-from-root]`);
	console.log(`   - @Date: [First commit date of file from git history] (use: git log --follow --format=%aI --reverse [file] | head -1)`);
	console.log(`   - @Author: Nate Hyson <CLDMV>`);
	console.log(`   - @Email: <Shinrai@users.noreply.github.com>`);
	console.log(`   - @Last modified by: Nate Hyson <CLDMV> (Shinrai@users.noreply.github.com)`);
	console.log(`   - @Last modified time: [Current timestamp]`);
	console.log(`   - @Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.\n`);
	console.log(`   NOTE: The @Date field should be the first date the file appeared in git history.`);
	console.log(`         Use git log to find this: git log --follow --format=%aI --reverse [filename] | head -1\n`);
} else {
	console.log(`✅ All files have proper file headers\n`);
}

if (filesWithDuplicateHeaders.length > 0) {
	console.log(`⚠️  Found ${filesWithDuplicateHeaders.length} file(s) with a stacked/duplicate header:\n`);
	filesWithDuplicateHeaders.forEach((file, idx) => {
		console.log(`[${idx + 1}] ${relative(rootDir, file)}`);
	});
	console.log(`\n   fix:headers will NOT remove these — delete the extra header block by hand.\n`);
}

// ===== SYNTAX CHECK =====
console.log("\n" + "=".repeat(80));
console.log("=== JavaScript Syntax Check ===");
console.log("=".repeat(80) + "\n");

const syntaxErrors = [];
// node --check only understands JavaScript — restrict to .mjs/.cjs (headerCheckFiles
// now also includes .jsonc/.jsonv, which are not parseable as JS).
const jsSyntaxFiles = headerCheckFiles.filter((file) => file.endsWith(".mjs") || file.endsWith(".cjs"));
console.log(`Checking ${jsSyntaxFiles.length} files for syntax errors...`);

for (const file of jsSyntaxFiles) {
	try {
		// Use node --check to validate syntax
		// This properly handles ES6 modules
		await execAsync(`node --check "${file}"`);
	} catch (err) {
		// Extract useful error information
		let errorMessage = err.stderr || err.message || "Unknown syntax error";

		// Parse line and column from error message if available
		const lineMatch = errorMessage.match(/(?:line |:)(\d+)/i);
		const line = lineMatch ? lineMatch[1] : "unknown";

		// Clean up the error message
		errorMessage = errorMessage
			.replace(/^.*?SyntaxError:\s*/i, "")
			.split("\n")[0]
			.trim();

		syntaxErrors.push({
			filePath: file,
			error: errorMessage,
			line: line,
			fullError: err.stderr || err.message
		});
	}
}

if (syntaxErrors.length > 0) {
	console.log(`\n❌ Found ${syntaxErrors.length} files with syntax errors:\n`);

	for (const { filePath, error, line, fullError } of syntaxErrors) {
		const relPath = relative(rootDir, filePath);
		console.log(`📄 ${relPath}`);
		if (line !== "unknown") {
			console.log(`   Line: ${line}`);
		}
		console.log(`   Error: ${error}`);
		if (VERBOSE && fullError) {
			console.log(
				`   Full Output:\n${fullError
					.split("\n")
					.map((l) => `      ${l}`)
					.join("\n")}`
			);
		}
		console.log();
	}
} else {
	console.log(`\n✅ All files have valid JavaScript syntax\n`);
}

// ===== PRETTIER FORMAT CHECK =====
// Advisory (⚠️) like the file-header check: precommit's "Format (Prettier)" step auto-fixes
// via `npm run format`, so a dirty result here is reported, not gating — same as a missing
// header. `prettier --check` exits 1 and lists each offender as a "[warn] <path>" line.
const unformattedFiles = [];
try {
	await execAsync(`npx prettier --check . --config .configs/.prettierrc`, { cwd: rootDir, maxBuffer: 10 * 1024 * 1024 });
} catch (err) {
	const out = `${err.stdout || ""}\n${err.stderr || ""}`;
	for (const line of out.split("\n")) {
		const match = line.match(/^\[warn\]\s+(.+?)\s*$/);
		// Skip prettier's trailing "[warn] Code style issues found ..." summary line — it is
		// not a file path and would otherwise inflate the count by one.
		if (match && !match[1].startsWith("Code style issues")) unformattedFiles.push(match[1]);
	}
}

// ===== FINAL SUMMARY =====
console.log("=".repeat(80));
console.log("\n📊 Translation Statistics:");
console.log(`  Total Error Codes Used:      ${usedErrorCodes.size}`);
console.log(`  Total Translations:          ${translationKeys.length}`);
console.log(`  Unused Translations:         ${unusedTranslations.length} (may be intentional)`);
console.log(`  Untranslated Keys:           ${untranslatedKeyCount} across ${untranslatedLocaleCount} locale(s)`);

console.log("\n" + "=".repeat(80));
console.log("\n🔍 Quality Check Results:\n");

// Count actual issues
let hasIssues = false;

if (missingTranslations.length > 0) {
	console.log(`❌ Missing Translations:        ${missingTranslations.length} - MUST FIX`);
	hasIssues = true;
} else {
	console.log(`✅ Missing Translations:        0`);
}

if (placeholderIssues.length > 0) {
	console.log(`❌ Placeholder Mismatches:      ${placeholderIssues.length} - MUST FIX`);
	hasIssues = true;
} else {
	console.log(`✅ Placeholder Mismatches:      0`);
}

if (invalidKeys.length > 0) {
	console.log(`❌ Invalid Key Format:          ${invalidKeys.length} - MUST FIX`);
	hasIssues = true;
} else {
	console.log(`✅ Invalid Key Format:          0`);
}

if (untranslatedLocaleCount > 0) {
	console.log(`❌ Untranslated Locale Keys:    ${untranslatedKeyCount} across ${untranslatedLocaleCount} locale(s) - MUST FIX`);
	hasIssues = true;
} else {
	console.log(`✅ Untranslated Locale Keys:    0`);
}

if (allConsoleWarns.length > 0) {
	console.log(`⚠️  Console.warn Calls:          ${allConsoleWarns.length} - Should convert to SlothletWarning`);
	hasIssues = true;
} else {
	console.log(`✅ Console.warn Calls:          0`);
}

if (allHardcodedReasons.length > 0) {
	console.log(`❌ Hardcoded reason: Strings:   ${allHardcodedReasons.length} - MUST convert to i18n`);
	hasIssues = true;
} else {
	console.log(`✅ Hardcoded reason: Strings:   0`);
}

if (allHardcodedDebugMessages.length > 0) {
	console.log(`❌ Hardcoded debug message:     ${allHardcodedDebugMessages.length} - MUST use { key: "DEBUG_MODE_*", ...params }`);
	hasIssues = true;
} else {
	console.log(`✅ Hardcoded debug message:     0`);
}

if (allConsoleLogs.length > 0) {
	console.log(`⚠️  Improper Console.log (src):  ${allConsoleLogs.length} - Should use slothlet.debug()`);
	hasIssues = true;
} else {
	console.log(`✅ Improper Console.log (src):  0`);
}

if (allConsoleErrors.length > 0) {
	console.log(`❌ Improper Console.error (src): ${allConsoleErrors.length} - MUST use SlothletError/SlothletWarning`);
	hasIssues = true;
} else {
	console.log(`✅ Improper Console.error (src): 0`);
}

if (allBareNewErrors.length > 0) {
	console.log(`❌ Bare new Error() (src):       ${allBareNewErrors.length} - MUST use SlothletError with translation key`);
	hasIssues = true;
} else {
	console.log(`✅ Bare new Error() (src):       0`);
}

if (allFragileEscapeChecks.length > 0) {
	console.log(
		`❌ Fragile escape checks:        ${allFragileEscapeChecks.length} - MUST count the backslash run (isEscaped), not one neighbor`
	);
	hasIssues = true;
} else {
	console.log(`✅ Fragile escape checks:        0`);
}

if (validationErrorsWithCause.length > 0) {
	console.log(`❌ Validation Err w/ cause:      ${validationErrorsWithCause.length} - MUST drop validationError or surface {error}`);
	hasIssues = true;
} else {
	console.log(`✅ Validation Err w/ cause:      0`);
}

if (allUnbalancedV8Ignores.length > 0) {
	console.log(
		`❌ Unbalanced v8 ignore range:   ${allUnbalancedV8Ignores.length} - MUST balance start/stop (silently drops coverage to EOF)`
	);
	hasIssues = true;
} else {
	console.log(`✅ Unbalanced v8 ignore range:   0`);
}

if (vitestConsoleLogs.length > 0) {
	console.log(`⚠️  Console.log (vitest):        ${vitestConsoleLogs.length} - Remove from tests`);
	hasIssues = true;
} else {
	console.log(`✅ Console.log (vitest):        0`);
}

if (errorsWithIssues.length > 0) {
	console.log(`⚠️  Error Throws with Issues:   ${errorsWithIssues.length} - Review above`);
	hasIssues = true;
} else {
	console.log(`✅ Error Throws with Issues:   0`);
}

if (filesWithoutHeaders.length > 0) {
	console.log(`⚠️  Files without Headers:       ${filesWithoutHeaders.length} - Add proper file headers`);
	hasIssues = true;
} else {
	console.log(`✅ Files without Headers:       0`);
}

if (filesWithDuplicateHeaders.length > 0) {
	console.log(`⚠️  Files w/ duplicate header:   ${filesWithDuplicateHeaders.length} - remove the stacked header (fix:headers won't)`);
	hasIssues = true;
} else {
	console.log(`✅ Files w/ duplicate header:    0`);
}

if (unformattedFiles.length > 0) {
	console.log(`⚠️  Files not Prettier-clean:    ${unformattedFiles.length} - run \`npm run format\``);
	hasIssues = true;
} else {
	console.log(`✅ Files not Prettier-clean:     0`);
}

if (syntaxErrors.length > 0) {
	console.log(`❌ Files with Syntax Errors:    ${syntaxErrors.length} - Fix syntax issues`);
	hasIssues = true;
} else {
	console.log(`✅ Files with Syntax Errors:    0`);
}

console.log();

if (!hasIssues) {
	console.log("🎉 All checks passed! No issues found.\n");
} else {
	console.log("⚠️  Issues found - review output above for details.\n");
}

// Fail the run on any MUST-FIX (❌) category so the precommit gate stops the commit. Advisory (⚠️)
// categories — console.warn, src/vitest console.log, error-throws-with-issues, missing file headers —
// are reported but do not gate, matching the severities printed above.
const mustFixCount =
	missingTranslations.length +
	placeholderIssues.length +
	invalidKeys.length +
	untranslatedLocaleCount +
	allHardcodedReasons.length +
	allHardcodedDebugMessages.length +
	allConsoleErrors.length +
	allBareNewErrors.length +
	allFragileEscapeChecks.length +
	validationErrorsWithCause.length +
	allUnbalancedV8Ignores.length +
	syntaxErrors.length;

if (mustFixCount > 0) {
	console.log(`❌ ${mustFixCount} MUST-FIX issue(s) found — failing analyze (exit 1).\n`);
	process.exitCode = 1;
}
