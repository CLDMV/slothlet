#!/usr/bin/env node

/**
 * @fileoverview Script to replace single quotes with double quotes across the codebase.
 * @module @cldmv/slothlet/tools/fix-quotes
 * @package
 */

import { readFileSync, writeFileSync } from "node:fs";
import { glob } from "glob";

/**
 * Main entry point for the quote fixing utility.
 * @package
 * @async
 * @returns {Promise<void>}
 */
async function main() {
	console.log("🔍 Finding JavaScript files to fix quotes...");

	// Get all JavaScript files
	const patterns = ["**/*.mjs", "**/*.cjs", "**/*.js"];

	let allFiles = [];

	for (const pattern of patterns) {
		const files = await glob(pattern, {
			ignore: ["node_modules/**", "dist/**", "coverage/**", ".git/**", "tmp-tests/**"]
		});
		allFiles.push(...files);
	}

	// Remove duplicates
	allFiles = [...new Set(allFiles)];

	console.log(`📁 Found ${allFiles.length} JavaScript files to process`);

	let totalChanges = 0;
	let changedFiles = 0;

	for (const file of allFiles) {
		try {
			const originalContent = readFileSync(file, "utf8");
			let content = originalContent;
			let fileChanges = 0;

			// Fix import/export module specifiers with single quotes
			content = content.replace(/import\s+([^"']*)\s+from\s+'([^']+)'/g, (match, imports, specifier) => {
				fileChanges++;
				return `import ${imports} from "${specifier}"`;
			});

			content = content.replace(/export\s+([^"']*)\s+from\s+'([^']+)'/g, (match, exports, specifier) => {
				fileChanges++;
				return `export ${exports} from "${specifier}"`;
			});

			// Fix require() calls with single quotes
			content = content.replace(/require\s*\(\s*'([^']+)'\s*\)/g, (match, specifier) => {
				fileChanges++;
				return `require("${specifier}")`;
			});

			// Fix dynamic import() calls with single quotes
			content = content.replace(/import\s*\(\s*'([^']+)'\s*\)/g, (match, specifier) => {
				fileChanges++;
				return `import("${specifier}")`;
			});

			// Fix string literals in template literals and other contexts where single quotes are used
			// This is more complex as we need to be careful not to change valid cases

			// Fix JSDoc @example patterns with single quotes in import/require statements
			content = content.replace(/(\* import[^']*from\s+)'([^']+)'/g, (match, prefix, specifier) => {
				fileChanges++;
				return `${prefix}"${specifier}"`;
			});

			content = content.replace(/(\* const[^']*require\s*\(\s*)'([^']+)'(\s*\))/g, (match, prefix, specifier, suffix) => {
				fileChanges++;
				return `${prefix}"${specifier}"${suffix}`;
			});

			// Fix JSDoc @example patterns with import() dynamic imports
			content = content.replace(/(\* [^']*import\s*\(\s*)'([^']+)'(\s*\))/g, (match, prefix, specifier, suffix) => {
				fileChanges++;
				return `${prefix}"${specifier}"${suffix}`;
			});

			// Fix dir paths in examples like { dir: './path' }
			content = content.replace(/(\{\s*dir:\s*)'([^']+)'/g, (match, prefix, path) => {
				fileChanges++;
				return `${prefix}"${path}"`;
			});

			// Fix string literals in console.log and similar function calls in JSDoc examples
			content = content.replace(/(\* [^']*console\.log\([^']*)'([^']*)'([^']*\);)/g, (match, prefix, str, suffix) => {
				fileChanges++;
				return `${prefix}"${str}"${suffix}`;
			});

			// Fix object property values in examples like { user: 'alice' }
			content = content.replace(/(\{\s*[a-zA-Z_$][a-zA-Z0-9_$]*:\s*)'([^']+)'/g, (match, prefix, value) => {
				fileChanges++;
				return `${prefix}"${value}"`;
			});

			// Fix more complex cases with multiple properties
			content = content.replace(/([a-zA-Z_$][a-zA-Z0-9_$]*:\s*)'([^']+)'/g, (match, prefix, value) => {
				// Only if it looks like an object property
				if (prefix.includes(":")) {
					fileChanges++;
					return `${prefix}"${value}"`;
				}
				return match;
			});

			// Fix template literal patterns with single quotes that should be double quotes
			content = content.replace(/(return\s+`[^`]*:\s*)\$\{([^}]+)\}([^`]*`)/g, (match) => {
				// This handles cases like return `alpha: ${name}`;
				// We don't need to change this as it's a template literal
				return match;
			});

			// Save file if changes were made
			if (fileChanges > 0) {
				writeFileSync(file, content, "utf8");
				console.log(`✅ Fixed ${fileChanges} quotes in ${file}`);
				changedFiles++;
				totalChanges += fileChanges;
			}
		} catch (error) {
			console.error(`❌ Error processing ${file}:`, error.message);
		}
	}

	console.log(`\n🎉 Quote fixing complete!`);
	console.log(`📊 Fixed ${totalChanges} quotes across ${changedFiles} files`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
	main().catch(console.error);
}
