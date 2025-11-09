#!/usr/bin/env node
/**
 * @fileoverview Comprehensive codebase audit tool for identifying orphaned functions and unused code.
 * @module audit/function-analyzer
 */

import { readdir, readFile, stat } from "fs/promises";
import { join, relative, extname, dirname } from "path";
import { pathToFileURL, fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, "..");
const srcDir = join(rootDir, "src");

/**
 * Extract function declarations, exports, and imports from JavaScript/TypeScript code
 * @param {string} content - File content
 * @param {string} filePath - File path for context
 * @returns {object} Analysis result
 */
function analyzeFileContent(content, filePath) {
	const result = {
		filePath,
		functions: [],
		exports: [],
		imports: [],
		calls: [],
		dependencies: new Set()
	};

	// Remove comments and strings to avoid false positives
	const cleanContent = content
		.replace(/\/\*[\s\S]*?\*\//g, "") // Block comments
		.replace(/\/\/.*$/gm, "") // Line comments
		.replace(/`[^`]*`/g, '""') // Template literals
		.replace(/"[^"]*"/g, '""') // Double quoted strings
		.replace(/'[^']*'/g, "''"); // Single quoted strings

	// Extract function declarations
	const functionPatterns = [
		/(?:export\s+)?(?:async\s+)?function\s+(\w+)/g,
		/(?:export\s+)?const\s+(\w+)\s*=\s*(?:async\s+)?(?:function|\([^)]*\)\s*=>)/g,
		/(?:export\s+)?let\s+(\w+)\s*=\s*(?:async\s+)?(?:function|\([^)]*\)\s*=>)/g,
		/(\w+)\s*:\s*(?:async\s+)?(?:function|\([^)]*\)\s*=>)/g // Object methods
	];

	functionPatterns.forEach((pattern) => {
		let match;
		while ((match = pattern.exec(cleanContent)) !== null) {
			result.functions.push({
				name: match[1],
				type: "function",
				exported: match[0].includes("export")
			});
		}
	});

	// Extract exports (including default exports)
	const exportPatterns = [
		/export\s+(?:default\s+)?(?:function\s+)?(\w+)/g,
		/export\s*{\s*([^}]+)\s*}/g,
		/module\.exports\.(\w+)/g,
		/module\.exports\s*=\s*(\w+)/g
	];

	exportPatterns.forEach((pattern) => {
		let match;
		while ((match = pattern.exec(cleanContent)) !== null) {
			if (pattern.source.includes("{")) {
				// Handle destructured exports
				const exports = match[1].split(",").map((e) => e.trim().split(/\s+as\s+/)[0]);
				exports.forEach((exp) => {
					if (exp && !exp.includes("*")) {
						result.exports.push({
							name: exp,
							type: "named"
						});
					}
				});
			} else {
				result.exports.push({
					name: match[1],
					type: pattern.source.includes("default") ? "default" : "named"
				});
			}
		}
	});

	// Extract imports
	const importPatterns = [
		/import\s+(?:{\s*([^}]+)\s*}|(\w+))\s+from\s+["']([^"']+)["']/g,
		/import\s*\(\s*["']([^"']+)["']\s*\)/g,
		/require\s*\(\s*["']([^"']+)["']\s*\)/g
	];

	importPatterns.forEach((pattern) => {
		let match;
		while ((match = pattern.exec(cleanContent)) !== null) {
			const modulePath = match[3] || match[1];
			result.dependencies.add(modulePath);

			if (match[1]) {
				// Named imports
				const imports = match[1].split(",").map((i) => i.trim().split(/\s+as\s+/)[0]);
				imports.forEach((imp) => {
					if (imp && !imp.includes("*")) {
						result.imports.push({
							name: imp,
							from: modulePath,
							type: "named"
						});
					}
				});
			} else if (match[2]) {
				// Default import
				result.imports.push({
					name: match[2],
					from: modulePath,
					type: "default"
				});
			}
		}
	});

	// Extract function calls
	const callPattern = /(\w+)\s*\(/g;
	let match;
	while ((match = callPattern.exec(cleanContent)) !== null) {
		// Skip common keywords and built-ins
		const name = match[1];
		if (!["if", "for", "while", "switch", "catch", "console", "JSON", "Object", "Array", "Promise", "Error"].includes(name)) {
			result.calls.push(name);
		}
	}

	return result;
}

/**
 * Recursively scan directory for JavaScript files
 * @param {string} dir - Directory to scan
 * @returns {Promise<string[]>} Array of file paths
 */
async function scanDirectory(dir) {
	const files = [];

	try {
		const entries = await readdir(dir);

		for (const entry of entries) {
			const fullPath = join(dir, entry);
			const stats = await stat(fullPath);

			if (stats.isDirectory() && !entry.startsWith(".") && entry !== "node_modules") {
				const subFiles = await scanDirectory(fullPath);
				files.push(...subFiles);
			} else if (stats.isFile() && /\.(mjs|cjs|js|ts)$/.test(entry)) {
				files.push(fullPath);
			}
		}
	} catch (error) {
		console.warn(`Warning: Could not scan directory ${dir}:`, error.message);
	}

	return files;
}

/**
 * Analyze all files in the src directory
 * @returns {Promise<object[]>} Array of analysis results
 */
async function analyzeCodebase() {
	console.log("🔍 Scanning src directory for JavaScript files...");
	const files = await scanDirectory(srcDir);

	console.log(`📁 Found ${files.length} files to analyze`);

	const analyses = [];

	for (const file of files) {
		try {
			const content = await readFile(file, "utf-8");
			const analysis = analyzeFileContent(content, relative(rootDir, file));
			analyses.push(analysis);
			console.log(`✅ Analyzed: ${analysis.filePath}`);
		} catch (error) {
			console.warn(`⚠️  Could not analyze ${file}:`, error.message);
		}
	}

	return analyses;
}

/**
 * Find orphaned functions (defined but never called)
 * @param {object[]} analyses - Array of file analyses
 * @returns {object[]} Array of orphaned functions
 */
function findOrphanedFunctions(analyses) {
	console.log("\n🔍 Identifying orphaned functions...");

	// Collect all function definitions and calls
	const allFunctions = new Map();
	const allCalls = new Set();
	const allExports = new Set();

	analyses.forEach((analysis) => {
		// Record function definitions
		analysis.functions.forEach((func) => {
			if (!allFunctions.has(func.name)) {
				allFunctions.set(func.name, []);
			}
			allFunctions.get(func.name).push({
				...func,
				filePath: analysis.filePath
			});
		});

		// Record exports
		analysis.exports.forEach((exp) => {
			allExports.add(exp.name);
		});

		// Record calls
		analysis.calls.forEach((call) => {
			allCalls.add(call);
		});
	});

	// Find functions that are defined but never called and not exported
	const orphaned = [];

	allFunctions.forEach((definitions, funcName) => {
		const isCalled = allCalls.has(funcName);
		const isExported = allExports.has(funcName);

		if (!isCalled && !isExported) {
			orphaned.push(
				...definitions.map((def) => ({
					...def,
					reason: "Not called and not exported"
				}))
			);
		}
	});

	return orphaned;
}

/**
 * Find unused imports
 * @param {object[]} analyses - Array of file analyses
 * @returns {object[]} Array of unused imports
 */
function findUnusedImports(analyses) {
	console.log("\n🔍 Identifying unused imports...");

	const unused = [];

	analyses.forEach((analysis) => {
		const usedNames = new Set([...analysis.functions.map((f) => f.name), ...analysis.calls]);

		analysis.imports.forEach((imp) => {
			if (!usedNames.has(imp.name)) {
				unused.push({
					...imp,
					filePath: analysis.filePath,
					reason: "Imported but never used"
				});
			}
		});
	});

	return unused;
}

/**
 * Generate audit report
 * @param {object[]} analyses - Array of file analyses
 * @returns {object} Comprehensive audit report
 */
function generateAuditReport(analyses) {
	console.log("\n📊 Generating comprehensive audit report...");

	const orphanedFunctions = findOrphanedFunctions(analyses);
	const unusedImports = findUnusedImports(analyses);

	// Collect all functions by file
	const functionsByFile = {};
	analyses.forEach((analysis) => {
		functionsByFile[analysis.filePath] = analysis.functions;
	});

	// Collect all dependencies
	const allDependencies = new Set();
	analyses.forEach((analysis) => {
		analysis.dependencies.forEach((dep) => allDependencies.add(dep));
	});

	return {
		summary: {
			totalFiles: analyses.length,
			totalFunctions: analyses.reduce((sum, a) => sum + a.functions.length, 0),
			totalExports: analyses.reduce((sum, a) => sum + a.exports.length, 0),
			totalImports: analyses.reduce((sum, a) => sum + a.imports.length, 0),
			orphanedFunctions: orphanedFunctions.length,
			unusedImports: unusedImports.length
		},
		orphanedFunctions,
		unusedImports,
		functionsByFile,
		allDependencies: Array.from(allDependencies).sort(),
		analyses
	};
}

/**
 * Main execution function
 */
async function main() {
	console.log("🚀 Starting comprehensive codebase audit...");
	console.log(`📂 Root directory: ${rootDir}`);
	console.log(`📂 Src directory: ${srcDir}\n`);

	try {
		const analyses = await analyzeCodebase();
		const report = generateAuditReport(analyses);

		// Write detailed report to file
		const reportPath = join(rootDir, "audit", "function-analysis-report.json");
		await writeFile(reportPath, JSON.stringify(report, null, 2));

		// Print summary
		console.log("\n" + "=".repeat(60));
		console.log("📈 CODEBASE AUDIT SUMMARY");
		console.log("=".repeat(60));
		console.log(`📁 Total files analyzed: ${report.summary.totalFiles}`);
		console.log(`🔧 Total functions found: ${report.summary.totalFunctions}`);
		console.log(`📤 Total exports: ${report.summary.totalExports}`);
		console.log(`📥 Total imports: ${report.summary.totalImports}`);
		console.log(`🗑️  Orphaned functions: ${report.summary.orphanedFunctions}`);
		console.log(`❌ Unused imports: ${report.summary.unusedImports}`);

		if (report.orphanedFunctions.length > 0) {
			console.log("\n🗑️  ORPHANED FUNCTIONS:");
			report.orphanedFunctions.forEach((func) => {
				console.log(`   - ${func.name} in ${func.filePath} (${func.reason})`);
			});
		}

		if (report.unusedImports.length > 0) {
			console.log("\n❌ UNUSED IMPORTS:");
			report.unusedImports.forEach((imp) => {
				console.log(`   - ${imp.name} from "${imp.from}" in ${imp.filePath}`);
			});
		}

		console.log(`\n📄 Detailed report saved to: ${reportPath}`);
		console.log("✅ Audit complete!");
	} catch (error) {
		console.error("❌ Audit failed:", error);
		process.exit(1);
	}
}

// Add missing import for writeFile
import { writeFile } from "fs/promises";

// Run if called directly
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
	main();
}

export { analyzeCodebase, generateAuditReport };
