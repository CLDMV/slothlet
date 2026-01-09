/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tools/inspect-api-structure.mjs
 *	@Date: 2025-10-23 11:11:42 -07:00 (1761243102)
 *	@Author: Nate Hyson <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Hyson <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2025-10-24 14:51:51 -07:00 (1761342711)
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
 * @param {number} [maxDepth=8] - Maximum depth to traverse
 * @param {WeakSet} [visited=new WeakSet()] - Visited objects to prevent cycles
 * @returns {string[]} Array of formatted strings describing the structure
 */
function inspectApiStructure(obj, path = "", depth = 0, maxDepth = 8, visited = new WeakSet()) {
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
					// Try to detect if this is a lazy folder by checking the descriptor
					try {
						const descriptor = Object.getOwnPropertyDescriptor(obj, key);
						if (descriptor && "value" in descriptor && typeof descriptor.value === "function" && descriptor.value.name?.includes("lazy")) {
							results.push(`${indent}${chalk.yellow(key)}: ${chalk.blue("function (lazy folder)")}`);
							results.push(`${indent}  ${chalk.gray("Name:")} ${chalk.cyan(descriptor.value.name)}`);
							results.push(`${indent}  ${chalk.gray("[Access a property to trigger materialization]")}`);
						} else {
							results.push(`${indent}${chalk.yellow(key)}: ${chalk.red("[error accessing]")}`);
						}
					} catch {
						results.push(`${indent}${chalk.yellow(key)}: ${chalk.red("[error accessing]")}`);
					}
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
 * Force materialization of lazy folders by directly accessing their properties.
 * @param {any} api - The API object to materialize
 * @returns {Promise<void>}
 */
async function forceMaterializeLazyFolders(api) {
	if (!api || typeof api !== "object") return;

	console.log(chalk.gray("  Searching for lazy folders..."));

	// Get all property names and look for lazy folders
	const keys = Object.getOwnPropertyNames(api);

	for (const key of keys) {
		if (key.startsWith("__") || key === "shutdown" || key === "describe") {
			continue;
		}

		try {
			// Check if property descriptor indicates a lazy folder
			const descriptor = Object.getOwnPropertyDescriptor(api, key);
			if (descriptor && "value" in descriptor && typeof descriptor.value === "function" && descriptor.value.name?.includes("lazy")) {
				console.log(chalk.gray(`  Found lazy folder: ${key}, attempting materialization...`));

				try {
					const lazyProxy = descriptor.value;

					// Method 1: Try to use the _materialize method if available
					if (typeof lazyProxy._materialize === "function") {
						console.log(chalk.gray(`    Using _materialize() method...`));
						const materialized = await lazyProxy._materialize();
						if (materialized && typeof materialized === "object") {
							// Replace the lazy proxy with the materialized object
							api[key] = materialized;
							console.log(
								chalk.green(`  ✅ Successfully materialized ${key} using _materialize() with keys: ${Object.keys(materialized).join(", ")}`)
							);
							continue;
						}
					}

					// Method 2: Force materialization by accessing ANY property to trigger proxy
					console.log(chalk.gray(`    Trying property access to trigger materialization...`));
					try {
						// Access a non-existent property to trigger the proxy handler without side effects
						const _ = api[key].__force_materialization__;
						// Also try accessing common property patterns
						api[key].config || api[key].index || api[key].main || api[key].alpha || api[key].test;
					} catch {
						// Property access might throw, but it should still trigger materialization
					}

					// Method 3: Wait for any pending materialization
					await new Promise((resolve) => setTimeout(resolve, 50)); // Give lazy proxy time

					// Check if it's now materialized
					const newValue = api[key];
					if (typeof newValue === "object" && newValue !== null) {
						console.log(chalk.green(`  ✅ Successfully materialized ${key} to object with keys: ${Object.keys(newValue).join(", ")}`));
					} else {
						console.log(chalk.yellow(`  ⚠️ ${key} still appears to be a function after access attempts`));
					}
				} catch (error) {
					console.log(chalk.yellow(`  ⚠️ Could not materialize ${key}: ${error.message}`));
				}
			}
		} catch (_) {
			// Skip properties we can't examine
			continue;
		}
	}
}

/**
 * Main inspection function that loads an API and displays its structure.
 * @param {string} apiName - Name of the API folder in api_tests (e.g., "api_test", "api_test_cjs")
 * @param {object} [options] - Options for display
 * @param {number} [options.maxDepth=8] - Maximum depth to traverse
 * @param {boolean} [options.showMethods=false] - Whether to show available methods for functions
 * @param {object} [options.slothletConfig] - Configuration for slothlet initialization
 * @returns {Promise<void>}
 */
async function inspectApi(apiName, options = {}) {
	const { maxDepth = 8, lazy = true, slothletConfig = {} } = options;

	console.log(chalk.bold.blue(`\n=== Inspecting API: ${apiName} (${lazy ? "lazy" : "eager"} mode) ===\n`));

	try {
		const apiPath = `./api_tests/${apiName}`;
		console.log(chalk.gray(`Loading from: ${apiPath}`));

		// Build slothlet configuration
		const config = {
			dir: apiPath,
			lazy: lazy,
			...slothletConfig // Include any additional configuration parameters
		};

		console.log(chalk.gray(`Configuration:`, JSON.stringify(config, null, 2)));

		// Load the API
		const api = await slothlet(config);

		console.log(chalk.green("✅ API loaded successfully"));

		// Force materialization of lazy folders if in lazy mode
		if (lazy) {
			await forceMaterializeLazyFolders(api);
			console.log(chalk.green("✅ Lazy folders materialized\n"));
		} else {
			console.log(chalk.green("✅ Eager mode - all modules pre-loaded\n"));
		}

		console.log(api);

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
		const callablePaths = await findCallablePaths(api, "api", new WeakSet(), false, 0, maxDepth);
		if (callablePaths.length === 0) {
			console.log(chalk.gray("  No callable functions found"));
		} else {
			for (const path of callablePaths) {
				console.log(`  ${chalk.green(path)}`);
			}
		}

		// Shutdown the API instance to clean up resources
		if (typeof api.shutdown === "function") {
			await api.shutdown();
			console.log(chalk.green("✅ API instance shutdown cleanly"));
		}
	} catch (error) {
		console.error(chalk.red("❌ Error loading API:"), error.message);
		if (error.code === "MODULE_NOT_FOUND") {
			console.error(chalk.gray("Make sure the API folder exists and contains valid modules"));
		}
	}
}

/**
 * Recursively materializes lazy proxy structures by calling their _materialize methods.
 * @param {any} obj - Object to materialize
 * @param {WeakSet} [visited] - Visited objects tracker to prevent infinite recursion
 * @returns {Promise<void>}
 */
async function materializeLazyStructure(obj, visited = new WeakSet()) {
	// Avoid infinite recursion
	if (!obj || visited.has(obj)) return;

	// Only process objects and functions
	if (typeof obj !== "object" && typeof obj !== "function") return;

	visited.add(obj);

	// Check if this is a lazy proxy with a _materialize method
	if (typeof obj === "function" && obj._materialize && typeof obj._materialize === "function") {
		try {
			await obj._materialize();
			// After materialization, get the materialized value and recurse into it
			const materialized = obj.__materialized;
			if (materialized && materialized !== obj) {
				await materializeLazyStructure(materialized, visited);
			}
		} catch (_) {
			// Silently ignore materialization errors
		}
	}

	// Recursively materialize all properties
	if (obj && (typeof obj === "object" || typeof obj === "function")) {
		// Use Object.getOwnPropertyNames to get all properties including non-enumerable ones
		const propNames = [...new Set([...Object.getOwnPropertyNames(obj), ...Object.keys(obj)])];
		for (const prop of propNames) {
			try {
				const value = obj[prop];
				if (value && (typeof value === "object" || typeof value === "function")) {
					await materializeLazyStructure(value, visited);
				}
			} catch {
				// Ignore property access errors (getters that throw, etc.)
			}
		}
	}
}

/**
 * Finds all callable paths in an API object structure.
 * @param {any} obj - Object to traverse
 * @param {string} [basePath="api"] - Base path string
 * @param {WeakSet} [visited] - Visited objects tracker
 * @param {boolean} [skipSelf=false] - Skip adding the object itself as callable (to avoid duplicates)
 * @param {number} [depth=0] - Current depth
 * @param {number} [maxDepth=8] - Maximum depth to traverse
 * @returns {Promise<string[]>} Array of callable paths
 */
async function findCallablePaths(obj, basePath = "api", visited = new WeakSet(), skipSelf = false, depth = 0, maxDepth = 8) {
	const paths = [];

	// Stop if too deep or if we've already processed this object (but only for non-functions or deep objects)
	if (!obj || depth > maxDepth) return paths;

	// Only prevent revisiting for objects/functions at deeper levels to avoid infinite recursion
	if ((typeof obj === "object" || typeof obj === "function") && depth > 1 && visited.has(obj)) return paths;

	// Add to visited set (for both objects and functions to prevent cycles)
	if ((typeof obj === "object" || typeof obj === "function") && obj !== null) {
		visited.add(obj);
	}

	// Force materialization of lazy proxies using the exposed _materialize method
	await materializeLazyStructure(obj);

	// If the object itself is callable, add it (unless skipSelf is true)
	if (typeof obj === "function" && !skipSelf) {
		paths.push(`${basePath}()`);
	}

	// Search properties (works for both objects and functions since functions can have properties)
	if (obj && (typeof obj === "object" || typeof obj === "function")) {
		const entries = Object.entries(obj);

		for (const [key, value] of entries) {
			if (key.startsWith("_") || key === "shutdown") continue;

			const newPath = `${basePath}.${key}`;

			if (typeof value === "function") {
				paths.push(`${newPath}()`);

				// Check for properties on functions (but skip adding the function itself again)
				const subPaths = await findCallablePaths(value, newPath, visited, true, depth + 1, maxDepth);
				paths.push(...subPaths);
			} else if (value && typeof value === "object") {
				const subPaths = await findCallablePaths(value, newPath, visited, false, depth + 1, maxDepth);
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
		console.log("  node tools/inspect-api-structure.mjs api_test_cjs --eager");
		console.log("  node tools/inspect-api-structure.mjs api_test_mixed --lazy --allowApiOverwrite --hotReload");
		console.log("\nOptions:");
		console.log("  --depth <n>           Maximum depth to traverse (default: 3)");
		console.log("  --show-methods        Show available methods for functions");
		console.log("  --lazy                Use lazy loading mode (default)");
		console.log("  --eager               Use eager loading mode");
		console.log("  --allowApiOverwrite   Allow API property overwriting");
		console.log("  --hotReload           Enable hot reload and ownership tracking");
		console.log("  --apiDepth <n>        Set API depth limit (default: no limit)");
		console.log("  --debug               Enable debug mode");
		return;
	}

	const apiName = args[0];
	const options = { lazy: true }; // Default to lazy mode
	const slothletConfig = {}; // Configuration for slothlet initialization

	// Parse options
	for (let i = 1; i < args.length; i++) {
		if (args[i] === "--depth" && i + 1 < args.length) {
			options.maxDepth = parseInt(args[i + 1], 10);
			i++; // Skip next arg
		} else if (args[i] === "--apiDepth" && i + 1 < args.length) {
			slothletConfig.apiDepth = parseInt(args[i + 1], 10);
			i++; // Skip next arg
		} else if (args[i] === "--show-methods") {
			options.showMethods = true;
		} else if (args[i] === "--lazy") {
			options.lazy = true;
			slothletConfig.lazy = true;
		} else if (args[i] === "--eager") {
			options.lazy = false;
			slothletConfig.lazy = false;
		} else if (args[i] === "--allowApiOverwrite") {
			slothletConfig.allowApiOverwrite = true;
		} else if (args[i] === "--hotReload") {
			slothletConfig.hotReload = true;
		} else if (args[i] === "--debug") {
			slothletConfig.debug = true;
		}
	}

	// Pass slothlet configuration as part of options
	options.slothletConfig = slothletConfig;

	await inspectApi(apiName, options);

	await inspectApi(apiName, options);
}

// Run if called directly
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
	main().catch((error) => {
		console.error(chalk.red("Error:"), error);
		process.exit(1);
	});
}
