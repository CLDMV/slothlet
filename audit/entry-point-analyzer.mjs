#!/usr/bin/env node
/**
 * @fileoverview Entry point consolidation analyzer - compares index.mjs and index.cjs for redundancy.
 * @module audit/entry-point-analyzer
 */

import { readFile, writeFile } from "fs/promises";
import { join } from "path";

const rootDir = new URL("../", import.meta.url).pathname.slice(0, -1);

/**
 * Analyze differences between index.mjs and index.cjs
 * @returns {Promise<object>} Analysis results
 */
async function analyzeEntryPoints() {
	console.log("🔍 Analyzing entry point files...");

	const mjsPath = join(rootDir, "index.mjs");
	const cjsPath = join(rootDir, "index.cjs");

	const mjsContent = await readFile(mjsPath, "utf-8");
	const cjsContent = await readFile(cjsPath, "utf-8");

	// Extract key differences
	const analysis = {
		mjsFile: {
			path: mjsPath,
			lines: mjsContent.split("\n").length,
			hasNormalizeRuntime: mjsContent.includes("normalizeRuntimeType"),
			hasRuntimeSelection: mjsContent.includes("options.runtime"),
			importPattern: extractImportPattern(mjsContent),
			exports: extractExports(mjsContent, "esm")
		},
		cjsFile: {
			path: cjsPath,
			lines: cjsContent.split("\n").length,
			hasNormalizeRuntime: cjsContent.includes("normalizeRuntimeType"),
			hasRuntimeSelection: cjsContent.includes("options.runtime"),
			importPattern: extractImportPattern(cjsContent),
			exports: extractExports(cjsContent, "cjs")
		},
		differences: [],
		consolidationOptions: []
	};

	// Identify differences
	if (analysis.mjsFile.hasNormalizeRuntime !== analysis.cjsFile.hasNormalizeRuntime) {
		analysis.differences.push("normalizeRuntimeType function presence differs");
	}

	if (analysis.mjsFile.hasRuntimeSelection !== analysis.cjsFile.hasRuntimeSelection) {
		analysis.differences.push("Runtime selection logic differs");
	}

	if (JSON.stringify(analysis.mjsFile.importPattern) !== JSON.stringify(analysis.cjsFile.importPattern)) {
		analysis.differences.push("Import patterns differ");
	}

	// Generate consolidation recommendations
	generateConsolidationOptions(analysis);

	return analysis;
}

/**
 * Extract import patterns from file content
 * @param {string} content - File content
 * @returns {object} Import pattern analysis
 */
function extractImportPattern(content) {
	const patterns = {
		dynamicImports: [],
		staticImports: [],
		requires: []
	};

	// Dynamic imports
	const dynamicImportRegex = /import\s*\(\s*["']([^"']+)["']\s*\)/g;
	let match;
	while ((match = dynamicImportRegex.exec(content)) !== null) {
		patterns.dynamicImports.push(match[1]);
	}

	// Static imports
	const staticImportRegex = /import\s+.*?\s+from\s+["']([^"']+)["']/g;
	while ((match = staticImportRegex.exec(content)) !== null) {
		patterns.staticImports.push(match[1]);
	}

	// Requires
	const requireRegex = /require\s*\(\s*["']([^"']+)["']\s*\)/g;
	while ((match = requireRegex.exec(content)) !== null) {
		patterns.requires.push(match[1]);
	}

	return patterns;
}

/**
 * Extract export patterns from file content
 * @param {string} content - File content
 * @param {string} type - "esm" or "cjs"
 * @returns {object} Export pattern analysis
 */
function extractExports(content, type) {
	const patterns = {
		defaultExport: null,
		namedExports: []
	};

	if (type === "esm") {
		// ESM exports
		const defaultExportRegex = /export\s+default\s+(?:async\s+)?function\s+(\w+)/;
		const defaultMatch = content.match(defaultExportRegex);
		if (defaultMatch) {
			patterns.defaultExport = defaultMatch[1];
		}

		const namedExportRegex = /export\s*{\s*([^}]+)\s*}/g;
		let match;
		while ((match = namedExportRegex.exec(content)) !== null) {
			const exports = match[1].split(",").map((e) => e.trim());
			patterns.namedExports.push(...exports);
		}
	} else {
		// CJS exports
		const moduleExportsRegex = /module\.exports\s*=\s*(\w+)/;
		const defaultMatch = content.match(moduleExportsRegex);
		if (defaultMatch) {
			patterns.defaultExport = defaultMatch[1];
		}

		const namedExportRegex = /module\.exports\.(\w+)/g;
		let match;
		while ((match = namedExportRegex.exec(content)) !== null) {
			patterns.namedExports.push(match[1]);
		}
	}

	return patterns;
}

/**
 * Generate consolidation options and recommendations
 * @param {object} analysis - Analysis object to modify
 */
function generateConsolidationOptions(analysis) {
	// Option 1: CJS imports ESM (requireESM pattern)
	analysis.consolidationOptions.push({
		name: "CJS imports ESM (requireESM pattern)",
		description: "index.cjs uses createRequire or dynamic import to load index.mjs",
		benefits: [
			"Single source of truth in index.mjs",
			"Eliminates code duplication",
			"Easier maintenance",
			"Consistent behavior between entry points"
		],
		drawbacks: ["Slightly more complex CJS entry point", "Requires Node.js 12+ for createRequire", "May have small performance overhead"],
		implementation: "Use createRequire() or dynamic import() in index.cjs to load index.mjs",
		example: `
// index.cjs (simplified)
const { createRequire } = require('module');
const require = createRequire(import.meta.url);

module.exports = async function(...args) {
  const { default: esmEntry } = await import('./index.mjs');
  return esmEntry(...args);
};`
	});

	// Option 2: Shared core module
	analysis.consolidationOptions.push({
		name: "Shared core module",
		description: "Both index.mjs and index.cjs import from a shared core implementation",
		benefits: [
			"Explicit separation of entry logic and core logic",
			"Native module system usage for each entry point",
			"Clear architecture"
		],
		drawbacks: ["Additional file to maintain", "More complex project structure"],
		implementation: "Create src/slothlet-core.mjs with shared logic",
		example: `
// src/slothlet-core.mjs
export async function createSlothletInstance(options) { /* core logic */ }

// index.mjs
import { createSlothletInstance } from './src/slothlet-core.mjs';
export default createSlothletInstance;

// index.cjs  
const { createSlothletInstance } = require('./src/slothlet-core.mjs');
module.exports = createSlothletInstance;`
	});

	// Option 3: Keep separate but sync
	analysis.consolidationOptions.push({
		name: "Keep separate but synchronized",
		description: "Maintain both files but ensure they're functionally identical",
		benefits: ["No architectural changes needed", "Native module system usage", "Clear entry points"],
		drawbacks: ["Ongoing maintenance burden", "Risk of divergence", "Code duplication"],
		implementation: "Add tooling to verify both entry points produce identical results",
		example: `
// Add to package.json scripts:
"test:entry-points": "node tests/verify-entry-point-equivalence.mjs"`
	});
}

/**
 * Generate a consolidated index.cjs using requireESM pattern
 * @param {object} _ - Analysis results (unused for generation)
 * @returns {string} Generated CJS content
 */
function generateConsolidatedCJS(_) {
	return `/**
 * @fileoverview CommonJS entry point for @cldmv/slothlet - imports ESM implementation.
 * @module @cldmv/slothlet
 */

/**
 * CommonJS entry that dynamically imports the ESM implementation.
 * This ensures single source of truth in index.mjs while maintaining CJS compatibility.
 * @public
 * @async
 * @param {object} [options={}] - Configuration options for the slothlet instance
 * @returns {Promise<function|object>} The bound API object with live-binding context
 *
 * @example // CJS usage
 * const slothlet = require("@cldmv/slothlet");
 * const api = await slothlet({ dir: "./api", context: { user: "alice" } });
 * console.log(api.config.username); // Access configuration
 */
async function slothlet(options = {}) {
	// Dynamic import of ESM entry point
	const { default: esmSlothlet } = await import("./index.mjs");
	return esmSlothlet(options);
}

/**
 * CommonJS default export of the slothlet function.
 * @public
 */
module.exports = slothlet;

/**
 * Named export alias for the slothlet function.
 * Provides the same functionality as the default export.
 * @public
 * @type {Function}
 *
 * @example // CJS named destructuring
 * const { slothlet } = require("@cldmv/slothlet");
 * const api = await slothlet({ dir: "./api" });
 */
module.exports.slothlet = slothlet; // optional named alias
`;
}

/**
 * Main execution function
 */
async function main() {
	console.log("🚀 Analyzing entry point consolidation opportunities...");

	try {
		const analysis = await analyzeEntryPoints();

		// Write analysis report
		const reportPath = join(rootDir, "audit", "entry-point-analysis.json");
		await writeFile(reportPath, JSON.stringify(analysis, null, 2));

		// Generate consolidated CJS example
		const consolidatedCJS = generateConsolidatedCJS(analysis);
		const examplePath = join(rootDir, "audit", "consolidated-index.cjs.example");
		await writeFile(examplePath, consolidatedCJS);

		// Print summary
		console.log("\n" + "=".repeat(60));
		console.log("📈 ENTRY POINT ANALYSIS SUMMARY");
		console.log("=".repeat(60));
		console.log(`📁 index.mjs: ${analysis.mjsFile.lines} lines`);
		console.log(`📁 index.cjs: ${analysis.cjsFile.lines} lines`);
		console.log(`🔄 Differences found: ${analysis.differences.length}`);
		console.log(`💡 Consolidation options: ${analysis.consolidationOptions.length}`);

		if (analysis.differences.length > 0) {
			console.log("\n🔄 DIFFERENCES:");
			analysis.differences.forEach((diff) => {
				console.log(`   - ${diff}`);
			});
		}

		console.log("\n💡 CONSOLIDATION OPTIONS:");
		analysis.consolidationOptions.forEach((option, index) => {
			console.log(`   ${index + 1}. ${option.name}`);
			console.log(`      ${option.description}`);
		});

		console.log(`\n📄 Detailed analysis: ${reportPath}`);
		console.log(`📄 CJS consolidation example: ${examplePath}`);
		console.log("✅ Analysis complete!");

		// Recommendation
		console.log("\n💪 RECOMMENDED APPROACH:");
		console.log("   Use Option 1: CJS imports ESM (requireESM pattern)");
		console.log("   This provides single source of truth while maintaining compatibility.");
	} catch (error) {
		console.error("❌ Analysis failed:", error);
		process.exit(1);
	}
}

// Run if called directly
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
	main();
}

// Add missing import
import { pathToFileURL } from "url";

export { analyzeEntryPoints, generateConsolidatedCJS };
