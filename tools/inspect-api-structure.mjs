/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tools/inspect-api-structure.mjs
 *	@Date: 2025-10-23 11:11:42 -07:00 (1761243102)
 *	@Author: Nate Hyson <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Hyson <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2025-10-23 11:14:09 -07:00 (1761243249)
 *	-----
 *	@Copyright: Copyright (c) 2013-2025 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview API structure inspection utility for slothlet development.
 * This tool loads any api_tests folder and displays the complete API structure
 * to help verify behavior during development.
 * @module @cldmv/slothlet/tools/inspect-api-structure
 */

import slothlet from "@cldmv/slothlet";
import chalk from "chalk";
import { pathToFileURL } from "url";

/**
 * Display the structure of an object or function recursively.
 * @param {any} obj - Object to inspect
 * @param {string} [path=""] - Current path for display
 * @param {number} [depth=0] - Current recursion depth
 * @param {number} [maxDepth=3] - Maximum depth to traverse
 * @param {WeakSet} [visited=new WeakSet()] - Visited objects to prevent cycles
 * @returns {string[]} Array of formatted strings describing the structure
 */
function inspectApiStructure(obj, path = "", depth = 0, maxDepth = 3, visited = new WeakSet()) {
	const indent = "  ".repeat(depth);
	const results = [];

	// Prevent infinite recursion
	if (depth > maxDepth || (obj && typeof obj === "object" && visited.has(obj))) {
		results.push(`${indent}${chalk.yellow("[circular or max depth]")}`);
		return results;
	}

	if (obj && typeof obj === "object") {
		visited.add(obj);
	}

	// Handle functions (including callable objects)
	if (typeof obj === "function") {
		const functionInfo = [];

		// Show if it's async
		if (obj.constructor.name === "AsyncFunction") {
			functionInfo.push(chalk.cyan("async"));
		}

		// Show parameter count
		functionInfo.push(chalk.blue(`(${obj.length} params)`));

		// Show function name if different from path
		if (obj.name && obj.name !== path.split(".").pop()) {
			functionInfo.push(chalk.green(`name: ${obj.name}`));
		}

		results.push(`${indent}${chalk.magenta("function")} ${functionInfo.join(" ")}`);

		// Check for properties on the function
		const ownProps = Object.getOwnPropertyNames(obj).filter(
			(prop) => prop !== "length" && prop !== "name" && prop !== "prototype" && prop !== "constructor"
		);

		if (ownProps.length > 0) {
			results.push(`${indent}${chalk.gray("  Properties:")}`);
			for (const prop of ownProps) {
				try {
					const value = obj[prop];
					const newPath = path ? `${path}.${prop}` : prop;
					results.push(`${indent}  ${chalk.yellow(prop)}:`);
					results.push(...inspectApiStructure(value, newPath, depth + 2, maxDepth, visited));
				} catch (_) {
					results.push(`${indent}  ${chalk.yellow(prop)}: ${chalk.red("[error accessing]")}`);
				}
			}
		}
	}
	// Handle objects
	else if (obj && typeof obj === "object") {
		const keys = Object.keys(obj);
		if (keys.length === 0) {
			results.push(`${indent}${chalk.gray("empty object")}`);
		} else {
			for (const key of keys) {
				try {
					const value = obj[key];
					const newPath = path ? `${path}.${key}` : key;

					// Type indicator
					let typeInfo = "";
					if (typeof value === "function") {
						typeInfo = chalk.magenta("function");
					} else if (Array.isArray(value)) {
						typeInfo = chalk.blue(`array[${value.length}]`);
					} else if (value && typeof value === "object") {
						typeInfo = chalk.cyan("object");
					} else {
						typeInfo = chalk.gray(typeof value);
					}

					results.push(`${indent}${chalk.yellow(key)}: ${typeInfo}`);

					if (depth < maxDepth) {
						results.push(...inspectApiStructure(value, newPath, depth + 1, maxDepth, visited));
					}
				} catch (_) {
					results.push(`${indent}${chalk.yellow(key)}: ${chalk.red("[error accessing]")}`);
				}
			}
		}
	}
	// Handle primitives
	else {
		const valueStr = typeof obj === "string" ? `"${obj}"` : String(obj);
		results.push(`${indent}${chalk.gray(typeof obj)}: ${chalk.white(valueStr)}`);
	}

	return results;
}

/**
 * Main inspection function that loads an API and displays its structure.
 * @param {string} apiName - Name of the API folder in api_tests (e.g., "api_test", "api_test_cjs")
 * @param {object} [options] - Options for display
 * @param {number} [options.maxDepth=3] - Maximum depth to traverse
 * @param {boolean} [options.showMethods=false] - Whether to show available methods for functions
 * @returns {Promise<void>}
 */
async function inspectApi(apiName, options = {}) {
	const { maxDepth = 3 } = options;

	console.log(chalk.bold.blue(`\n=== Inspecting API: ${apiName} ===\n`));

	try {
		const apiPath = `./api_tests/${apiName}`;
		console.log(chalk.gray(`Loading from: ${apiPath}`));

		// Load the API
		const api = await slothlet({ dir: apiPath });

		console.log(chalk.green("✅ API loaded successfully\n"));

		// Display basic info
		console.log(chalk.bold("API Type:"), typeof api);
		if (typeof api === "function") {
			console.log(chalk.bold("Function Name:"), api.name || "(anonymous)");
			console.log(chalk.bold("Parameter Count:"), api.length);
			if (api.constructor.name === "AsyncFunction") {
				console.log(chalk.bold("Async:"), chalk.cyan("yes"));
			}
		}

		console.log(chalk.bold("\nAPI Structure:"));
		console.log(chalk.gray("─".repeat(50)));

		// Display the structure
		const structure = inspectApiStructure(api, apiName, 0, maxDepth);
		for (const line of structure) {
			console.log(line);
		}

		console.log(chalk.gray("─".repeat(50)));

		// Show callable paths
		console.log(chalk.bold("\nCallable Paths:"));
		const callablePaths = findCallablePaths(api);
		if (callablePaths.length === 0) {
			console.log(chalk.gray("  No callable functions found"));
		} else {
			for (const path of callablePaths) {
				console.log(`  ${chalk.green(path)}`);
			}
		}

		// Show shutdown method if available
		if (typeof api.shutdown === "function") {
			console.log(chalk.yellow("\n💡 Remember to call api.shutdown() when done"));
		}
	} catch (error) {
		console.error(chalk.red("❌ Error loading API:"), error.message);
		if (error.code === "MODULE_NOT_FOUND") {
			console.error(chalk.gray("Make sure the API folder exists and contains valid modules"));
		}
	}
}

/**
 * Find all callable paths in an API structure.
 * @param {any} obj - Object to search
 * @param {string} [basePath="api"] - Base path for display
 * @param {WeakSet} [visited=new WeakSet()] - Visited objects to prevent cycles
 * @returns {string[]} Array of callable paths
 */
function findCallablePaths(obj, basePath = "api", visited = new WeakSet()) {
	const paths = [];

	if (!obj || visited.has(obj)) return paths;

	if (typeof obj === "object") {
		visited.add(obj);
	}

	// If the object itself is callable, add it
	if (typeof obj === "function") {
		paths.push(`${basePath}()`);
	}

	// Search properties
	if (obj && typeof obj === "object") {
		for (const [key, value] of Object.entries(obj)) {
			if (key.startsWith("_") || key === "shutdown") continue;

			const newPath = `${basePath}.${key}`;

			if (typeof value === "function") {
				paths.push(`${newPath}()`);

				// Check for properties on functions
				const subPaths = findCallablePaths(value, newPath, visited);
				paths.push(...subPaths);
			} else if (value && typeof value === "object") {
				const subPaths = findCallablePaths(value, newPath, visited);
				paths.push(...subPaths);
			}
		}
	}

	return paths;
}

/**
 * Main entry point for the utility.
 * @returns {Promise<void>}
 */
async function main() {
	const args = process.argv.slice(2);

	if (args.length === 0) {
		console.log(chalk.bold("Usage:"));
		console.log("  node tools/inspect-api-structure.mjs <api-name> [options]");
		console.log("\nExamples:");
		console.log("  node tools/inspect-api-structure.mjs api_test");
		console.log("  node tools/inspect-api-structure.mjs api_test_cjs");
		console.log("  node tools/inspect-api-structure.mjs api_test_mixed");
		console.log("\nOptions:");
		console.log("  --depth <n>     Maximum depth to traverse (default: 3)");
		console.log("  --show-methods  Show available methods for functions");
		return;
	}

	const apiName = args[0];
	const options = {};

	// Parse options
	for (let i = 1; i < args.length; i++) {
		if (args[i] === "--depth" && i + 1 < args.length) {
			options.maxDepth = parseInt(args[i + 1], 10);
			i++; // Skip next arg
		} else if (args[i] === "--show-methods") {
			options.showMethods = true;
		}
	}

	await inspectApi(apiName, options);
}

// Run if called directly
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
	main().catch((error) => {
		console.error(chalk.red("Error:"), error);
		process.exit(1);
	});
}
