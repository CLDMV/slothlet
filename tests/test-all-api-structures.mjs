/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/test-all-api-structures.mjs
 *	@Date: 2025-10-24 14:58:25 -07:00 (1761343105)
 *	@Author: Nate Hyson <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Hyson <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2025-10-25 12:45:37 -07:00 (1761421537)
 *	-----
 *	@Copyright: Copyright (c) 2013-2025 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Comprehensive API structure validation tool for slothlet development.
 * This tool runs the inspect-api-structure utility against all api_tests folders
 * in both lazy and eager modes to validate consistency and detect issues.
 * @module @cldmv/slothlet/tests/test-all-api-structures
 */

import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import chalk from "chalk";

/**
 * Get all api_tests folders.
 * @returns {Promise<string[]>} Array of folder names in api_tests
 */
async function getApiTestFolders() {
	try {
		const apiTestsDir = "./api_tests";
		const entries = await fs.readdir(apiTestsDir, { withFileTypes: true });
		return entries
			.filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
			.map((entry) => entry.name)
			.sort();
	} catch (error) {
		console.error(chalk.red("❌ Error reading api_tests directory:"), error.message);
		return [];
	}
}

/**
 * Run the inspect-api-structure tool for a specific folder and mode.
 * @param {string} folderName - Name of the api_tests folder
 * @param {boolean} lazy - Whether to use lazy mode
 * @returns {Promise<{success: boolean, output: string, error?: string}>}
 */
async function runInspection(folderName, lazy) {
	const mode = lazy ? "--lazy" : "--eager";
	const modeLabel = lazy ? "lazy" : "eager";

	console.log(chalk.gray(`  Running ${modeLabel} mode inspection...`));

	return new Promise((resolve) => {
		const currentFile = fileURLToPath(import.meta.url);
		const rootDir = path.resolve(path.dirname(currentFile), "..");
		const inspectToolPath = path.join(rootDir, "tools", "inspect-api-structure.mjs");

		const childProcess = spawn("node", [inspectToolPath, folderName, mode], {
			stdio: ["ignore", "pipe", "pipe"],
			cwd: rootDir
		});

		let stdout = "";
		let stderr = "";

		childProcess.stdout.on("data", (data) => {
			stdout += data.toString();
		});

		childProcess.stderr.on("data", (data) => {
			stderr += data.toString();
		});

		childProcess.on("close", (code) => {
			if (code === 0) {
				resolve({ success: true, output: stdout });
			} else {
				resolve({
					success: false,
					output: stdout,
					error: stderr || `Process exited with code ${code}`
				});
			}
		});

		// Add timeout to prevent hanging
		setTimeout(() => {
			childProcess.kill();
			resolve({
				success: false,
				output: stdout,
				error: "Process timeout after 30 seconds"
			});
		}, 30000);
	});
}

/**
 * Extract comprehensive API structure from inspection output.
 * @param {string} output - The inspection output text
 * @returns {object} Complete API structure information
 */
function extractApiStructure(output) {
	const structure = {
		apiType: "unknown",
		callablePathsCount: 0,
		callablePaths: [],
		hasCircularRefs: false,
		hasErrors: false,
		functionName: null,
		parameterCount: null
	};

	// Extract API type
	const apiTypeMatch = output.match(/API Type:\s*(\w+)/);
	if (apiTypeMatch) {
		structure.apiType = apiTypeMatch[1];
	}

	// Extract function details for callable APIs
	const functionNameMatch = output.match(/Function Name:\s*(\w+)/);
	if (functionNameMatch) {
		structure.functionName = functionNameMatch[1];
	}

	const paramCountMatch = output.match(/Parameter Count:\s*(\d+)/);
	if (paramCountMatch) {
		structure.parameterCount = parseInt(paramCountMatch[1], 10);
	}

	// Extract all callable paths
	const callableSection = output.match(/Callable Paths:([\s\S]*?)(?=💡|$)/);
	if (callableSection) {
		const paths = callableSection[1]
			.split("\n")
			.map((line) => line.trim())
			.filter((line) => line.startsWith("api.") || line === "api()")
			.sort(); // Sort for consistent comparison
		structure.callablePaths = paths;
		structure.callablePathsCount = paths.length;
	}

	// Check for circular references
	structure.hasCircularRefs = output.includes("[circular") || output.includes("[Circular");

	// Check for errors
	structure.hasErrors = output.includes("❌") || output.includes("Error:");

	return structure;
}

/**
 * Compare API structures between lazy and eager modes.
 * @param {object} lazyStructure - Structure from lazy mode
 * @param {object} eagerStructure - Structure from eager mode
 * @returns {object} Detailed comparison results
 */
function compareApiStructures(lazyStructure, eagerStructure) {
	const issues = [];

	// Compare API type
	if (lazyStructure.apiType !== eagerStructure.apiType) {
		issues.push(`API Type mismatch: lazy=${lazyStructure.apiType}, eager=${eagerStructure.apiType}`);
	}

	// Compare function details for callable APIs
	if (lazyStructure.functionName !== eagerStructure.functionName) {
		issues.push(`Function name mismatch: lazy=${lazyStructure.functionName}, eager=${eagerStructure.functionName}`);
	}

	if (lazyStructure.parameterCount !== eagerStructure.parameterCount) {
		issues.push(`Parameter count mismatch: lazy=${lazyStructure.parameterCount}, eager=${eagerStructure.parameterCount}`);
	}

	// Compare callable paths count
	const pathDiff = Math.abs(lazyStructure.callablePathsCount - eagerStructure.callablePathsCount);
	if (pathDiff > 0) {
		issues.push(`Callable paths count differs: lazy=${lazyStructure.callablePathsCount}, eager=${eagerStructure.callablePathsCount}`);
	}

	// Compare actual callable paths (detailed comparison)
	const lazyPaths = new Set(lazyStructure.callablePaths);
	const eagerPaths = new Set(eagerStructure.callablePaths);

	// Find paths only in lazy mode
	const onlyInLazy = [...lazyPaths].filter((path) => !eagerPaths.has(path));
	if (onlyInLazy.length > 0) {
		issues.push(`Paths only in lazy mode: ${onlyInLazy.join(", ")}`);
	}

	// Find paths only in eager mode
	const onlyInEager = [...eagerPaths].filter((path) => !lazyPaths.has(path));
	if (onlyInEager.length > 0) {
		issues.push(`Paths only in eager mode: ${onlyInEager.join(", ")}`);
	}

	// Check for errors
	if (lazyStructure.hasErrors || eagerStructure.hasErrors) {
		issues.push(`Errors detected: lazy=${lazyStructure.hasErrors}, eager=${eagerStructure.hasErrors}`);
	}

	return {
		consistent: issues.length === 0,
		issues: issues,
		lazyStructure: lazyStructure,
		eagerStructure: eagerStructure
	};
}

/**
 * Main execution function.
 * @returns {Promise<void>}
 */
async function main() {
	console.log(chalk.bold.blue("\n🔍 Comprehensive API Structure Validation\n"));

	const folders = await getApiTestFolders();

	if (folders.length === 0) {
		console.log(chalk.yellow("⚠️ No api_tests folders found"));
		return;
	}

	console.log(chalk.gray(`Found ${folders.length} api_tests folders: ${folders.join(", ")}\n`));

	const results = [];
	let totalTests = 0;
	let passedTests = 0;

	for (const folder of folders) {
		console.log(chalk.bold(`\n📁 Testing: ${folder}`));
		console.log(chalk.gray("─".repeat(50)));

		// Run lazy mode
		const lazyResult = await runInspection(folder, true);
		totalTests++;

		// Run eager mode
		const eagerResult = await runInspection(folder, false);
		totalTests++;

		if (lazyResult.success && eagerResult.success) {
			// Extract and compare API structures
			const lazyStructure = extractApiStructure(lazyResult.output);
			const eagerStructure = extractApiStructure(eagerResult.output);
			const comparison = compareApiStructures(lazyStructure, eagerStructure);

			if (comparison.consistent) {
				console.log(chalk.green(`✅ ${folder}: Both modes consistent`));
				console.log(chalk.gray(`   API Type: ${lazyStructure.apiType}, Paths: ${lazyStructure.callablePathsCount}`));
				passedTests += 2;
			} else {
				console.log(chalk.red(`❌ ${folder}: Inconsistency detected`));
				for (const issue of comparison.issues) {
					console.log(chalk.red(`   • ${issue}`));
				}
			}

			results.push({
				folder: folder,
				success: true,
				comparison: comparison
			});
		} else {
			// Handle failures
			console.log(chalk.red(`❌ ${folder}: Execution failed`));

			if (!lazyResult.success) {
				console.log(chalk.red(`   Lazy mode error: ${lazyResult.error}`));
			} else {
				passedTests++;
			}

			if (!eagerResult.success) {
				console.log(chalk.red(`   Eager mode error: ${eagerResult.error}`));
			} else {
				passedTests++;
			}

			results.push({
				folder: folder,
				success: false,
				lazyError: lazyResult.success ? null : lazyResult.error,
				eagerError: eagerResult.success ? null : eagerResult.error
			});
		}
	}

	// Summary report
	console.log(chalk.bold.blue("\n\n📊 Summary Report"));
	console.log(chalk.gray("═".repeat(50)));

	const successfulFolders = results.filter((r) => r.success);
	const consistentFolders = successfulFolders.filter((r) => r.comparison.consistent);

	console.log(chalk.bold(`Tests Run: ${totalTests}`));
	console.log(chalk.bold(`Tests Passed: ${passedTests}`));
	console.log(chalk.bold(`Folders Tested: ${folders.length}`));
	console.log(chalk.bold(`Consistent APIs: ${consistentFolders.length}/${successfulFolders.length}`));

	if (consistentFolders.length === successfulFolders.length && passedTests === totalTests) {
		console.log(chalk.bold.green("\n🎉 All tests passed! Lazy and eager modes are consistent."));
	} else {
		console.log(chalk.bold.red("\n⚠️ Issues detected. Review the results above."));
	}

	// Detailed inconsistency report
	const inconsistentFolders = successfulFolders.filter((r) => !r.comparison.consistent);
	if (inconsistentFolders.length > 0) {
		console.log(chalk.bold.yellow("\n🔍 Detailed Inconsistency Report:"));
		for (const result of inconsistentFolders) {
			console.log(chalk.yellow(`\n${result.folder}:`));
			for (const issue of result.comparison.issues) {
				console.log(chalk.yellow(`  • ${issue}`));
			}
		}
	}

	// Exit with error code if any tests failed or are inconsistent
	if (passedTests < totalTests || inconsistentFolders.length > 0) {
		process.exit(1);
	}
}

// Run if called directly
if (import.meta.url === new URL(import.meta.url).href) {
	main().catch((error) => {
		console.error(chalk.red("💥 Fatal error:"), error);
		process.exit(1);
	});
}
