/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tools/dev/analyze-errors.mjs
 *	@Date: 2026-01-17T17:51:34-08:00 (1768701094)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-12 16:30:47 -07:00 (1773358247)
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
import { FILE_HEADER_CHECK_FOLDERS, FILE_HEADER_IGNORE_FOLDERS } from "../lib/header-config.mjs";

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
		return normalizedRel.startsWith(normalizedIgnore + "/") || normalizedRel === normalizedIgnore;
	});
}

/**
 * Recursively find all .mjs files
 * @internal
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
 * @internal
 */
async function findMjsFilesInFolders(folderConfigs, ignoreFolders) {
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
				const files = await findMjsFiles(folderPath);
				// Filter out ignored paths
				const filteredFiles = files.filter((file) => !shouldIgnorePath(file, ignoreFolders));
				allFiles.push(...filteredFiles);
			} else {
				// Non-recursive - only get direct .mjs files
				const entries = await readdir(folderPath);
				for (const entry of entries) {
					if (entry.endsWith(".mjs")) {
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
	// Expected header format (first 12 lines)
	// The @Filename can be /src/, /tools/, /tests/, /api_tests/, or root level (/)
	const headerPattern =
		/^\/\*\*\s*\n\s*\*\s*@Project:\s*@cldmv\/slothlet\s*\n\s*\*\s*@Filename:\s*\/.+\n\s*\*\s*@Date:\s*.+\n\s*\*\s*@Author:\s*.+<CLDMV>\s*\n\s*\*\s*@Email:\s*<Shinrai@users\.noreply\.github\.com>\s*\n\s*\*\s*-----\s*\n\s*\*\s*@Last modified by:\s*.+<CLDMV>\s*\(.+\)\s*\n\s*\*\s*@Last modified time:\s*.+\n\s*\*\s*-----\s*\n\s*\*\s*@Copyright:\s*Copyright\s*\(c\)\s*2013-2026\s*Catalyzed Motivation Inc\.\s*All rights reserved\.\s*\n\s*\*\//;

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
	//   new SlothletError(...)                  - direct (standalone import)
	//   new this.SlothletError(...)             - via ComponentBase getter
	//   new this.slothlet.SlothletError(...)    - via double-hop (handler/builder classes)
	//   new slothlet.SlothletError(...)         - closure variable (api_builder.mjs)
	//   new wrapper.slothlet.SlothletError(...) - via proxy wrapper (unified-wrapper.mjs)
	// Same patterns for SlothletWarning.
	const throwPattern =
		/(?:throw\s+(?:await\s+)?(?:new\s+)?(?:(?:wrapper|this)(?:\.slothlet)?\.)?SlothletError|new\s+(?:(?:wrapper|this)(?:\.slothlet)?\.)?SlothletWarning|(?:throw\s+new\s+)?slothlet\.SlothletError)(?:\.create)?/g;

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
	const content = await readFile(filePath, "utf-8");
	const errors = parseErrorThrows(content, filePath);
	allErrors.push(...errors);
}

// Also find direct t() and translate() usage for warnings, debug, and other translations
const directTranslationUsage = new Set();
for (const filePath of files) {
	const content = await readFile(filePath, "utf-8");
	// Match t("KEY", ...) or t('KEY', ...) - direct shorthand calls
	const tCallPattern = /\bt\(\s*["']([A-Z_]+)["']/g;
	// Match translate("KEY", ...) or translate('KEY', ...) - direct full-function calls
	const translateCallPattern = /\btranslate\(\s*["']([A-Z_]+)["']/g;
	let match;
	while ((match = tCallPattern.exec(content)) !== null) {
		directTranslationUsage.add(match[1]);
	}
	while ((match = translateCallPattern.exec(content)) !== null) {
		directTranslationUsage.add(match[1]);
	}
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
					const objectContent = contextParam.slice(1, -1).trim();

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
						if ((char === '"' || char === "'" || char === "`") && (i === 0 || objectContent[i - 1] !== "\\")) {
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
//   - DEBUG_MODE_* and FLATTEN_REASON_* keys are detected via direct t("KEY") literal scan.
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

		// Check in direct t() calls
		if (directTranslationUsage.has(key)) {
			// Find which files use this key in t() calls
			for (const file of files) {
				const content = await readFile(file, "utf-8");
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
	const content = await readFile(file, "utf-8");
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
	const content = await readFile(file, "utf-8");
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
	const content = await readFile(file, "utf-8");
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
	const content = await readFile(file, "utf-8");
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

	const content = await readFile(file, "utf-8");
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
	const content = await readFile(file, "utf-8");
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
	const content = await readFile(file, "utf-8");
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

// ===== FILE HEADER DETECTION =====
console.log("\n" + "=".repeat(80));
console.log("=== File Header Detection ===");
console.log("=".repeat(80) + "\n");

// Get all files from configured folders for header check
const headerCheckFiles = await findMjsFilesInFolders(FILE_HEADER_CHECK_FOLDERS, FILE_HEADER_IGNORE_FOLDERS);

const filesWithoutHeaders = [];
for (const file of headerCheckFiles) {
	const content = await readFile(file, "utf-8");
	if (!hasProperFileHeader(content, file)) {
		filesWithoutHeaders.push(file);
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

// ===== SYNTAX CHECK =====
console.log("\n" + "=".repeat(80));
console.log("=== JavaScript Syntax Check ===");
console.log("=".repeat(80) + "\n");

const syntaxErrors = [];
console.log(`Checking ${headerCheckFiles.length} files for syntax errors...`);

for (const file of headerCheckFiles) {
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

// ===== FINAL SUMMARY =====
console.log("=".repeat(80));
console.log("\n📊 Translation Statistics:");
console.log(`  Total Error Codes Used:      ${usedErrorCodes.size}`);
console.log(`  Total Translations:          ${translationKeys.length}`);
console.log(`  Unused Translations:         ${unusedTranslations.length} (may be intentional)`);

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
