#!/usr/bin/env node
/**
 * @fileoverview Master audit script that runs comprehensive codebase analysis.
 * @module audit/run-audit
 */

import { analyzeCodebase, generateAuditReport } from "./function-analyzer.mjs";
import { analyzeEntryPoints, generateConsolidatedCJS } from "./entry-point-analyzer.mjs";
import { writeFile } from "fs/promises";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, "..");

/**
 * Run comprehensive codebase audit
 */
async function runCompleteAudit() {
	console.log("🚀 Starting comprehensive slothlet codebase audit...");
	console.log(`📂 Project root: ${rootDir}\n`);

	const auditResults = {
		timestamp: new Date().toISOString(),
		projectRoot: rootDir,
		functionAnalysis: null,
		entryPointAnalysis: null,
		recommendations: []
	};

	try {
		// 1. Function and orphaned code analysis
		console.log("=" + "=".repeat(58) + "=");
		console.log("📊 PHASE 1: FUNCTION & ORPHANED CODE ANALYSIS");
		console.log("=" + "=".repeat(58) + "=");

		const codebaseAnalyses = await analyzeCodebase();
		const functionReport = generateAuditReport(codebaseAnalyses);
		auditResults.functionAnalysis = functionReport;

		// 2. Entry point consolidation analysis
		console.log("\n" + "=" + "=".repeat(58) + "=");
		console.log("📊 PHASE 2: ENTRY POINT CONSOLIDATION ANALYSIS");
		console.log("=" + "=".repeat(58) + "=");

		const entryPointReport = await analyzeEntryPoints();
		auditResults.entryPointAnalysis = entryPointReport;

		// 3. Generate recommendations
		console.log("\n" + "=" + "=".repeat(58) + "=");
		console.log("📊 PHASE 3: GENERATING RECOMMENDATIONS");
		console.log("=" + "=".repeat(58) + "=");

		generateRecommendations(auditResults);

		// 4. Write comprehensive report
		const reportPath = join(rootDir, "audit", "comprehensive-audit-report.json");
		await writeFile(reportPath, JSON.stringify(auditResults, null, 2));

		// 5. Generate action items
		await generateActionItems(auditResults);

		// 6. Print final summary
		printFinalSummary(auditResults);

		console.log(`\n📄 Comprehensive report saved to: ${reportPath}`);
		console.log("✅ Complete audit finished successfully!");
	} catch (error) {
		console.error("❌ Audit failed:", error);
		process.exit(1);
	}
}

/**
 * Generate actionable recommendations based on audit results
 * @param {object} auditResults - Complete audit results
 */
function generateRecommendations(auditResults) {
	const recommendations = [];

	// Function analysis recommendations
	const { functionAnalysis } = auditResults;
	if (functionAnalysis.orphanedFunctions.length > 0) {
		recommendations.push({
			category: "Code Cleanup",
			priority: "Medium",
			title: "Remove orphaned functions",
			description: `Found ${functionAnalysis.orphanedFunctions.length} functions that are defined but never called or exported`,
			impact: "Reduces bundle size and improves maintainability",
			files: functionAnalysis.orphanedFunctions.map((f) => f.filePath),
			action: "Review and remove unused function definitions"
		});
	}

	if (functionAnalysis.unusedImports.length > 0) {
		recommendations.push({
			category: "Code Cleanup",
			priority: "Low",
			title: "Remove unused imports",
			description: `Found ${functionAnalysis.unusedImports.length} imports that are never used`,
			impact: "Improves build performance and reduces bundle size",
			files: [...new Set(functionAnalysis.unusedImports.map((i) => i.filePath))],
			action: "Remove unused import statements"
		});
	}

	// Entry point consolidation recommendations
	const { entryPointAnalysis } = auditResults;
	if (!entryPointAnalysis.isConsolidated && entryPointAnalysis.differences.length > 0) {
		recommendations.push({
			category: "Architecture",
			priority: "High",
			title: "Consolidate entry points",
			description: `Found ${entryPointAnalysis.differences.length} differences between index.mjs and index.cjs`,
			impact: "Eliminates code duplication, ensures consistent behavior, reduces maintenance burden",
			files: ["index.mjs", "index.cjs"],
			action: "Implement requireESM pattern in index.cjs to import index.mjs",
			implementation: entryPointAnalysis.consolidationOptions[0] // Use first option (requireESM)
		});
	}

	// Runtime system recommendations (based on MERGE.md todo)
	// NOTE: Runtime merger is now complete - both AsyncLocalStorage and Live Bindings runtimes work correctly
	// as verified by tests/debug-dual-runtime.mjs. No further action needed.
	// recommendations.push({
	//     category: "Architecture",
	//     priority: "Critical",
	//     title: "Fix runtime system architecture",
	//     description: "Current runtime dispatcher violates MERGE.md specification",
	//     impact: "Simplifies codebase, improves performance, follows architectural guidelines",
	//     files: ["src/lib/runtime/runtime.mjs", "src/slothlet.mjs"],
	//     action: "Remove proxy dispatcher and implement simple runtime selection in slothlet.mjs",
	//     reference: "MERGE.md specification"
	// });

	// Auto-wrap helper analysis
	const autoWrapFiles = functionAnalysis.analyses.filter(
		(a) => a.filePath.includes("auto-wrap") || a.functions.some((f) => f.name.includes("wrap") || f.name.includes("Wrap"))
	);

	if (autoWrapFiles.length > 0) {
		recommendations.push({
			category: "Code Cleanup",
			priority: "Medium",
			title: "Review auto-wrap helper redundancy",
			description: "auto-wrap.mjs helper may be redundant with built-in EventEmitter patching",
			impact: "Reduces complexity and potential conflicts",
			files: autoWrapFiles.map((f) => f.filePath),
			action: "Analyze if auto-wrap functionality is already covered by als-eventemitter.mjs"
		});
	}

	auditResults.recommendations = recommendations;
}

/**
 * Generate actionable task list and code examples
 * @param {object} auditResults - Complete audit results
 */
async function generateActionItems(auditResults) {
	console.log("📝 Generating action items and code examples...");

	const actionItems = [];

	auditResults.recommendations.forEach((rec, index) => {
		actionItems.push({
			id: index + 1,
			title: rec.title,
			priority: rec.priority,
			category: rec.category,
			description: rec.description,
			estimatedEffort: estimateEffort(rec),
			files: rec.files,
			action: rec.action,
			implementation: rec.implementation
		});
	});

	// Generate consolidated index.cjs example
	if (auditResults.entryPointAnalysis.differences.length > 0) {
		const consolidatedCJS = generateConsolidatedCJS(auditResults.entryPointAnalysis);
		const examplePath = join(rootDir, "audit", "consolidated-index.cjs.example");
		await writeFile(examplePath, consolidatedCJS);

		actionItems.push({
			id: actionItems.length + 1,
			title: "Apply consolidated CJS pattern",
			priority: "High",
			category: "Implementation",
			description: "Replace current index.cjs with requireESM pattern",
			estimatedEffort: "15 minutes",
			files: ["index.cjs"],
			action: `Replace index.cjs content with consolidated pattern from ${examplePath}`,
			codeExample: examplePath
		});
	}

	const actionItemsPath = join(rootDir, "audit", "action-items.json");
	await writeFile(actionItemsPath, JSON.stringify(actionItems, null, 2));
	console.log(`📝 Action items saved to: ${actionItemsPath}`);
}

/**
 * Estimate effort required for a recommendation
 * @param {object} recommendation - Recommendation object
 * @returns {string} Effort estimate
 */
function estimateEffort(recommendation) {
	switch (recommendation.category) {
		case "Code Cleanup":
			return recommendation.files.length > 5 ? "2-4 hours" : "30-60 minutes";
		case "Architecture":
			return recommendation.priority === "Critical" ? "4-8 hours" : "2-4 hours";
		case "Implementation":
			return "15-30 minutes";
		default:
			return "1-2 hours";
	}
}

/**
 * Print final audit summary
 * @param {object} auditResults - Complete audit results
 */
function printFinalSummary(auditResults) {
	console.log("\n" + "🎯".repeat(30));
	console.log("🎯 FINAL AUDIT SUMMARY");
	console.log("🎯".repeat(30));

	const { functionAnalysis, entryPointAnalysis, recommendations } = auditResults;

	console.log(`📁 Total files analyzed: ${functionAnalysis.summary.totalFiles}`);
	console.log(`🔧 Total functions found: ${functionAnalysis.summary.totalFunctions}`);
	console.log(`🗑️  Orphaned functions: ${functionAnalysis.summary.orphanedFunctions}`);
	console.log(`❌ Unused imports: ${functionAnalysis.summary.unusedImports}`);
	console.log(`🔄 Entry point differences: ${entryPointAnalysis.differences.length}`);
	console.log(`✅ Entry point consolidation: ${entryPointAnalysis.isConsolidated ? 'COMPLETED' : 'PENDING'}`);
	console.log(`💡 Total recommendations: ${recommendations.length}`);

	console.log("\n🚨 PRIORITY ACTIONS:");
	const criticalRecs = recommendations.filter((r) => r.priority === "Critical");
	const highRecs = recommendations.filter((r) => r.priority === "High");

	criticalRecs.forEach((rec) => {
		console.log(`   🔴 CRITICAL: ${rec.title}`);
	});

	highRecs.forEach((rec) => {
		console.log(`   🟠 HIGH: ${rec.title}`);
	});

	console.log("\n💪 RECOMMENDED EXECUTION ORDER:");
	let stepNum = 1;
	if (!entryPointAnalysis.isConsolidated) {
		console.log(`   ${stepNum++}. Consolidate entry points (HIGH - eliminates duplication)`);
	}
	console.log(`   ${stepNum++}. Remove orphaned functions (MEDIUM - code cleanup)`);
	console.log(`   ${stepNum++}. Review auto-wrap helper redundancy (MEDIUM - architecture)`);
	console.log(`   ${stepNum++}. Remove unused imports (LOW - optimization)`);
}

// Run if called directly
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
	runCompleteAudit();
}

// Add missing import
import { pathToFileURL } from "url";

export { runCompleteAudit };
