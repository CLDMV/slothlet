/**
 * @fileoverview Analyze all SlothletError usage and output to console
 * Checks:
 * - Proper error construction (originalError passed when needed)
 * - Hint availability for each error code
 * - Stub vs real error classification
 */

import { readFile, readdir, stat } from "node:fs/promises";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const rootDir = join(__dirname, "..");
const src3Dir = join(rootDir, "src3");

// CLI args
const limitArg = process.argv.find((arg) => arg.startsWith("--limit="));
const LIMIT = limitArg ? parseInt(limitArg.split("=")[1], 10) : 10;
const VERBOSE = process.argv.includes("--verbose");

// Load translations to check hints
const translationsPath = join(src3Dir, "lib/i18n/languages/en-us.mjs");
const translationsModule = await import(`file://${translationsPath}`);
const translations = translationsModule.translations;

// Find all hint keys
const hintKeys = Object.keys(translations).filter((k) => k.startsWith("HINT_"));

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
 * Parse SlothletError throws from file content
 */
function parseErrorThrows(content, filePath) {
	const errors = [];

	// Find throw statements by looking for the throw keyword + SlothletError
	const throwStarts = [];
	const throwPattern = /throw\s+(?:await\s+)?(?:new\s+)?SlothletError(?:\.create)?/g;

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
 */
function analyzeError(error) {
	const issues = [];

	// Check for old async SlothletError.create pattern (should be removed)
	if (error.fullMatch.includes("SlothletError.create")) {
		issues.push("❌ Uses deprecated SlothletError.create (should be synchronous: new SlothletError(...))");
		return { status: "❌ DEPRECATED PATTERN", issues };
	}

	// Stub errors are fine (can have hardcoded hints)
	if (error.isStub) {
		return { status: "✅ OK (Stub)", issues: [] };
	}

	// Validation errors don't need originalError
	if (error.isValidation) {
		return { status: "✅ OK (Validation)", issues: [] };
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

	// Check if hardcoded hint exists (should use i18n instead)
	if (error.hasHardcodedHint) {
		issues.push("Has hardcoded hint (should use i18n)");
	}

	// Check if a hint exists in translations
	const hasHint = checkHintExists(error.errorCode);
	if (!hasHint && !error.hasHardcodedHint) {
		issues.push("No hint in translations (needs HINT_ key)");
	}

	const status = issues.length === 0 ? "✅ OK" : "❌ Issues";
	return { status, issues, hasHint };
}

/**
 * Check if hint exists for error code
 */
function checkHintExists(errorCode) {
	// Convention: CONTEXT_NOT_FOUND → HINT_CONTEXT_NOT_FOUND
	const hintKey = `HINT_${errorCode}`;
	return hintKeys.includes(hintKey);
}

// Main execution
console.log("\n=== SlothletError Analysis ===\n");

const files = await findMjsFiles(src3Dir);
const allErrors = [];

for (const filePath of files) {
	const content = await readFile(filePath, "utf-8");
	const errors = parseErrorThrows(content, filePath);
	allErrors.push(...errors);
}

console.log(`Found ${allErrors.length} error throws\n`);
if (VERBOSE) {
	console.log(`Available hints: ${hintKeys.join(", ")}\n`);
}

// Filter to only errors with issues unless --verbose
const errorsToShow = VERBOSE ? allErrors : allErrors.filter((e) => analyzeError(e).issues.length > 0);

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

if (!VERBOSE && errorsWithIssues.length === 0) {
	console.log(`\n✅ All errors are properly configured! Use --verbose to see all errors.`);
}
console.log();
