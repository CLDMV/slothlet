/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/setup/vitest-helper.mjs
 *	@Date: 2026-01-11T19:07:25-08:00 (1768187245)
 *	@Author: Nate Hyson <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Hyson <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-02-07 15:33:01 -08:00 (1770507181)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Vitest setup and test matrix configurations
 *
 * @description
 * Centralized test matrix configurations for vitest tests.
 * All slothlet vitest tests should use these matrices with describe.each/it.each patterns.
 *
 * @module tests/vitests/vitest-helper
 */

import path from "path";
import fs from "fs/promises";
import { readdirSync } from "fs";
import { fileURLToPath } from "url";
import { parse } from "jsonc-parser";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Shared test config (parsed once per test run)
const configPath = path.resolve(__dirname, "./api-test-config.jsonc");
const configContent = await fs.readFile(configPath, "utf8");
export const testConfig = parse(configContent);

/**
 * Determine which API test directory to use - always use api_tests (V3)
 * @type {string}
 */
export const API_TEST_BASE = "api_tests";

/**
 * Common test API directories with resolved absolute paths
 * Uses api_tests (V3) for all tests
 * @type {object}
 */
export const TEST_DIRS = {
	API_TEST: path.resolve(__dirname, `../../../${API_TEST_BASE}/api_test`),
	API_TEST_CJS: path.resolve(__dirname, `../../../${API_TEST_BASE}/api_test_cjs`),
	API_TEST_MIXED: path.resolve(__dirname, `../../../${API_TEST_BASE}/api_test_mixed`),
	API_TEST_COLLECTIONS: path.resolve(__dirname, `../../../${API_TEST_BASE}/api_test_collections`),
	API_SMART_FLATTEN: path.resolve(__dirname, `../../../${API_TEST_BASE}/smart_flatten/api_smart_flatten_addapi_with_folders`),
	API_TEST_COLLISIONS: path.resolve(__dirname, `../../../${API_TEST_BASE}/api_test_collisions`),
	API_TEST_ROOT_ISSUE: path.resolve(__dirname, `../../../${API_TEST_BASE}/api_test_root_issue`),
	API_TV_TEST: path.resolve(__dirname, `../../../${API_TEST_BASE}/api_tv_test`),
	SMART_FLATTEN: path.resolve(__dirname, `../../../${API_TEST_BASE}/smart_flatten`),
	API_TEST_PRIMITIVES: path.resolve(__dirname, `../../../${API_TEST_BASE}/api_test_primitives`)
};

/**
 * Configuration space definition for automatic matrix generation
 * @type {object}
 */
const CONFIG_SPACE = {
	mode: ["eager", "lazy"],
	runtime: ["async", "live"],
	// allowApiOverwrite: [false, true],
	// apiDepth: [1, 3, Infinity],
	// allowMutation: [false, true],
	// collision: [
	// 	{ initial: "merge", api: "merge" },      // Default - allow all overwrites
	// 	{ initial: "error", api: "error" }       // Strict - prevent overwrites
	// ],
	// hooks: [false, true]
	hook: [
		{ enabled: true }, // Default - enabled
		{ enabled: false } // disabled
	]
};

/**
 * Utility to traverse nested properties using a path array.
 * @param {object} obj
 * @param {string[]} pathParts
 * @returns {any}
 */
export function getNestedProperty(obj, pathParts) {
	return pathParts.reduce((current, key) => current && current[key], obj);
}

/**
 * Materialize an API property by accessing it and returning its value.
 * Handles functions, objects, and primitives correctly in both lazy and eager modes.
 * For functions, calls them with provided args. For objects/primitives, returns them directly.
 *
 * @param {object} api - Slothlet API instance
 * @param {string} path - Dot-separated path to the property (e.g., "folder.config.settings.getPluginConfig")
 * @param {...any} args - Arguments to pass if the property is a function
 * @returns {Promise<any>} The materialized value (called function result or direct value)
 *
 * @example
 * // Call a function
 * const result = await materialize(api, "math.add", 2, 3);
 *
 * @example
 * // Access an object (triggers materialization in lazy mode)
 * const config = await materialize(api, "folder.config");
 */
export async function materialize(api, path, ...args) {
	const parts = path.split(".");
	let target = api;
	for (let i = 0; i < parts.length - 1; i++) {
		target = target[parts[i]];
	}
	const value = target[parts[parts.length - 1]];

	// console.log(
	// 	`[MATERIALIZE] path="${path}" typeof value="${typeof value}" value.name="${value?.name}" value.constructor.name="${value?.constructor?.name}"`
	// );

	// Trigger materialization if _materialize exists (for lazy mode)
	if (typeof value?._materialize === "function") {
		// console.log(`[MATERIALIZE] Calling value._materialize()`);
		await value._materialize();
		// console.log(`[MATERIALIZE] _materialize() completed`);
	}

	// Check actual type using __type property (for lazy mode compatibility)
	// __type returns Symbol(inFlight) or Symbol(unmaterialized) for lazy wrappers,
	// or the actual type string ("function", "object", etc.) after materialization
	const typeInfo = value?.__type;
	// console.log(`[MATERIALIZE] typeof typeInfo="${typeof typeInfo}" typeInfo="${String(typeInfo)}" isSymbol=${typeof typeInfo === "symbol"}`);
	const isFunction = typeInfo === "function" || (typeof typeInfo !== "symbol" && typeof value === "function");
	// console.log(`[MATERIALIZE] isFunction=${isFunction} args.length=${args.length}`);

	if (isFunction && args.length > 0) {
		// It's a function with args - call it
		// console.log(`[MATERIALIZE] Calling value(${args.join(", ")})`);

		try {
			return await value(...args);
		} catch (_) {
			return await value(...args);
		}
	} else if (isFunction && args.length === 0) {
		// It's a function with no args - just return it (don't call)
		// This allows accessing function metadata without calling the function
		return value;
	} else {
		// It's an object or primitive - just return it (accessing it triggers materialization)
		return value;
	}
}

/**
 * Invoke a nested function on the API.
 * @param {object|Function} api
 * @param {string[]} pathParts
 * @param {any[]} args
 * @param {boolean} isAsync
 * @returns {Promise<any>|any}
 */
export async function callNestedFunction(api, pathParts, args, isAsync = false) {
	const fn = getNestedProperty(api, pathParts);

	if (pathParts.length === 0) {
		if (typeof api === "function") {
			return isAsync ? await api(...args) : api(...args);
		}
		throw new Error("API is not callable");
	}

	if (typeof fn === "function") {
		return isAsync ? await fn(...args) : fn(...args);
	}

	throw new Error(`Property at path ${pathParts.join(".")} is not a function`);
}

/**
 * Run an async callback while suppressing SlothletError console noise.
 *
 * @template T
 * @param {() => Promise<T>} callback - Async callback containing an expected SlothletError assertion.
 * @returns {Promise<T>} Callback result.
 */
export async function withSuppressedSlothletErrorOutput(callback) {
	const originalConsoleError = console.error;
	const originalStderrWrite = process.stderr.write.bind(process.stderr);

	/**
	 * Determine whether a log message matches noisy SlothletError output.
	 * @param {string} message - Message to inspect.
	 * @returns {boolean} True when message should be suppressed.
	 */
	const isSlothletErrorNoiseText = (message) => {
		return (
			message.includes("SlothletError") ||
			message.includes("ERROR [") ||
			message.includes("Stack Trace:") ||
			message.includes("Details:") ||
			message.includes("[slothlet] Lifecycle event handler error") ||
			message.includes("Path is already owned by another module") ||
			message.includes("================================================================================")
		);
	};

	console.error = (...args) => {
		const message = args
			.map((arg) => {
				if (typeof arg === "string") return arg;
				if (arg instanceof Error) return arg.message;
				try {
					return JSON.stringify(arg);
				} catch {
					return String(arg);
				}
			})
			.join(" ");

		const isSlothletErrorNoise = isSlothletErrorNoiseText(message);

		if (!isSlothletErrorNoise) {
			originalConsoleError(...args);
		}
	};

	process.stderr.write = (chunk, encoding, callbackArg) => {
		const text = typeof chunk === "string" ? chunk : chunk?.toString?.(encoding || "utf8") || "";
		if (isSlothletErrorNoiseText(text)) {
			if (typeof callbackArg === "function") callbackArg();
			return true;
		}
		return originalStderrWrite(chunk, encoding, callbackArg);
	};

	try {
		return await callback();
	} finally {
		console.error = originalConsoleError;
		process.stderr.write = originalStderrWrite;
	}
}

/**
 * Run a sync callback while suppressing SlothletError console noise.
 *
 * @template T
 * @param {() => T} callback - Sync callback containing an expected SlothletError assertion.
 * @returns {T} Callback result.
 */
export function withSuppressedSlothletErrorOutputSync(callback) {
	const originalConsoleError = console.error;
	const originalStderrWrite = process.stderr.write.bind(process.stderr);

	/**
	 * Determine whether a log message matches noisy SlothletError output.
	 * @param {string} message - Message to inspect.
	 * @returns {boolean} True when message should be suppressed.
	 */
	const isSlothletErrorNoiseText = (message) => {
		return (
			message.includes("SlothletError") ||
			message.includes("ERROR [") ||
			message.includes("Stack Trace:") ||
			message.includes("Details:") ||
			message.includes("[slothlet] Lifecycle event handler error") ||
			message.includes("Path is already owned by another module") ||
			message.includes("================================================================================")
		);
	};

	console.error = (...args) => {
		const message = args
			.map((arg) => {
				if (typeof arg === "string") return arg;
				if (arg instanceof Error) return arg.message;
				try {
					return JSON.stringify(arg);
				} catch {
					return String(arg);
				}
			})
			.join(" ");

		const isSlothletErrorNoise = isSlothletErrorNoiseText(message);

		if (!isSlothletErrorNoise) {
			originalConsoleError(...args);
		}
	};

	process.stderr.write = (chunk, encoding, callbackArg) => {
		const text = typeof chunk === "string" ? chunk : chunk?.toString?.(encoding || "utf8") || "";
		if (isSlothletErrorNoiseText(text)) {
			if (typeof callbackArg === "function") callbackArg();
			return true;
		}
		return originalStderrWrite(chunk, encoding, callbackArg);
	};

	try {
		return callback();
	} finally {
		console.error = originalConsoleError;
		process.stderr.write = originalStderrWrite;
	}
}

/**
 * Generate all possible combinations from configuration space
 * @param {object} configSpace - Object defining possible values for each config option
 * @returns {Array<{name: string, config: object}>} Complete matrix of all combinations
 */
function generateTestMatrix(configSpace) {
	const keys = Object.keys(configSpace);
	const values = Object.values(configSpace);

	// Generate cartesian product of all configuration values
	function cartesianProduct(arrays) {
		return arrays.reduce(
			(acc, array) => {
				return acc.flatMap((existing) => array.map((value) => [...existing, value]));
			},
			[[]]
		);
	}

	const combinations = cartesianProduct(values);

	return combinations.map((combination, ___index) => {
		// Create config object
		const config = {};
		keys.forEach((key, i) => {
			config[key] = combination[i];
		});

		// Enable diagnostics for non-mutate configs to expose api.slothlet.api/reload/hooks for testing
		// if (config.allowMutation === false) {
		config.diagnostics = true;
		// }

		// Generate descriptive name
		const nameParts = [];
		nameParts.push(config.mode.toUpperCase());
		if (config.runtime === "live") nameParts.push("LIVE");

		// Add collision mode indicator (only if not default merge/merge)
		if (config.collision && (config.collision.initial === "error" || config.collision.api === "error")) {
			nameParts.push("STRICT");
		}

		if (config.hook && config.hook.enabled) nameParts.push("HOOKS");

		const name = nameParts.join("_");

		return { name, config };
	});
}

/**
 * Full test matrix covering all meaningful slothlet initialization options
 * This is the authoritative matrix for vitest - all tests should use this
 * ALL config options are explicitly set to avoid dependency on defaults
 * Uses `mode` parameter (not deprecated `lazy`) for loading strategy
 * @type {Array<{name: string, config: object}>}
 */
export const TEST_MATRIX = generateTestMatrix(CONFIG_SPACE);

/**
 * Ownership-enabled configurations (collision mode with merge or merge-replace)
 * In v3, ownership/mutation is controlled by collision config
 * This matrix includes configs that allow overwrites via collision settings
 * @type {Array<{name: string, config: object}>}
 */
// export const OWNERSHIP_MATRIX = getMatrixConfigs({ collision: { initial: "merge", api: "merge" } });

/**
 * Get filtered matrix configurations based on test requirements
 * @param {object} requirements - Required configuration features
 * @returns {Array<{name: string, config: object}>} Filtered matrix configs
 *
 * @example
 * // Test needs collision merge mode
 * const mergeConfigs = getMatrixConfigs({ collision: { initial: "merge", api: "merge" } });
 *
 * @example
 * // Test needs live bindings with strict collision protection
 * const liveStrictConfigs = getMatrixConfigs({
 *   runtime: "live",
 *   collision: { initial: "error", api: "error" }
 * });
 *
 * @example
 * // Test needs lazy loading only
 * const lazyConfigs = getMatrixConfigs({ mode: "lazy" });
 */
export function getMatrixConfigs(requirements = {}) {
	return TEST_MATRIX.filter((matrixConfig) => {
		// Filter based on requirements
		for (const [key, value] of Object.entries(requirements)) {
			const configValue = matrixConfig.config[key];

			// If requirement specifies a value, config must match
			if (configValue === undefined) {
				return false;
			}

			// Special handling for collision object comparison
			if (key === "collision" && typeof value === "object" && typeof configValue === "object") {
				// Deep equality check for collision objects
				if (value.initial !== undefined && configValue.initial !== value.initial) {
					return false;
				}
				if (value.api !== undefined && configValue.api !== value.api) {
					return false;
				}
			} else if (key === "hook" && typeof value === "object" && typeof configValue === "object") {
				// Deep equality check for hook objects
				if (value.enabled !== undefined && configValue.enabled !== value.enabled) {
					return false;
				}
				if (value.pattern !== undefined && configValue.pattern !== value.pattern) {
					return false;
				}
				if (value.suppressErrors !== undefined && configValue.suppressErrors !== value.suppressErrors) {
					return false;
				}
			} else if (configValue !== value) {
				// Simple equality check for other properties
				return false;
			}
		}

		return true;
	});
}

/**
 * Run a test function with an existing API instance.
 * Used for testing scenarios where functions are called from different files/contexts.
 * @param {object} api - Slothlet API instance
 * @param {Function} testFunction - Test function to run with the API
 * @returns {Promise<void>}
 * @example
 * await runTestWithApi(api, async (api) => {
 *   await api.slothlet.api.add("test", "./path");
 * });
 */
export async function runTestWithApi(api, testFunction) {
	await testFunction(api);
}

/**
 * Basic configurations without advanced features (async runtime)
 * Used for simple functionality tests that don't need live bindings
 * @type {Array<{name: string, config: object}>}
 */
export const BASIC_MATRIX = getMatrixConfigs({
	runtime: "async"
});

/**
 * Strict collision configurations (error on conflicts)
 * Used for testing collision protection features
 * @type {Array<{name: string, config: object}>}
 */
// export const STRICT_MATRIX = getMatrixConfigs({ collision: { initial: "error", api: "error" } });

/**
 * Collision configuration matrix (merge vs strict modes)
 * Used for testing collision handling behavior
 * @type {Array<{name: string, config: object}>}
 */
export const COLLISION_MATRIX = TEST_MATRIX;

/**
 * Runtime configuration matrix (async vs live bindings)
 * Used for testing runtime binding system differences
 * @type {Array<{name: string, config: object}>}
 */
export const RUNTIME_MATRIX = getMatrixConfigs({ runtime: "live" });

/**
 * Complex feature combination matrix (multiple non-default features enabled)
 * Used for comprehensive feature interaction tests
 * @type {Array<{name: string, config: object}>}
 */
export const COMPLEX_MATRIX = TEST_MATRIX.filter(({ config }) => {
	let featureCount = 0;
	if (config.collision && (config.collision.initial === "error" || config.collision.api === "error")) featureCount++;
	if (config.runtime === "live") featureCount++;
	if (config.hooks === true) featureCount++;
	return featureCount >= 2;
});

/**
 * Get a subset of the matrix by configuration names
 * @param {string[]} names - Array of configuration names to include
 * @returns {Array<{name: string, config: object}>} Filtered matrix
 */
export function getSelectMatrix(names) {
	return TEST_MATRIX.filter(({ name }) => names.includes(name));
}

/**
 * Get all API test folders synchronously for vitest test generation
 * @returns {string[]} Array of folder names/paths for all API test directories
 */
export function getAllApiTestFoldersSync() {
	try {
		// Resolve api_tests directory relative to project root
		const currentFile = fileURLToPath(import.meta.url);
		const projectRoot = path.resolve(path.dirname(currentFile), "../../..");
		const apiTestsDir = path.join(projectRoot, API_TEST_BASE);
		const entries = readdirSync(apiTestsDir, { withFileTypes: true });

		// Get top-level folders (excluding smart_flatten)
		const topLevelFolders = entries
			.filter((entry) => entry.isDirectory() && !entry.name.startsWith(".") && entry.name !== "smart_flatten")
			.map((entry) => entry.name);

		// Get smart_flatten subfolders
		const smartFlattenDir = path.join(apiTestsDir, "smart_flatten");
		const smartFlattenEntries = readdirSync(smartFlattenDir, { withFileTypes: true });
		const smartFlattenFolders = smartFlattenEntries
			.filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
			.map((entry) => path.join("smart_flatten", entry.name));

		return [...topLevelFolders, ...smartFlattenFolders].sort();
	} catch (error) {
		console.error(`Error reading ${API_TEST_BASE} directories:`, error);
		return [];
	}
}

/**
 * Get all API test folders, including smart_flatten subfolders
 * @returns {Promise<string[]>} Array of folder names/paths for all API test directories
 */
export async function getAllApiTestFolders() {
	try {
		const apiTestsDir = `./${API_TEST_BASE}`;
		const entries = await fs.readdir(apiTestsDir, { withFileTypes: true });

		// Get top-level folders (excluding smart_flatten)
		const topLevelFolders = entries
			.filter((entry) => entry.isDirectory() && !entry.name.startsWith(".") && entry.name !== "smart_flatten")
			.map((entry) => entry.name);

		// Get smart_flatten subfolders
		const smartFlattenDir = path.join(apiTestsDir, "smart_flatten");
		const smartFlattenEntries = await fs.readdir(smartFlattenDir, { withFileTypes: true });
		const smartFlattenFolders = smartFlattenEntries
			.filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
			.map((entry) => `smart_flatten/${entry.name}`);

		return [...topLevelFolders, ...smartFlattenFolders].sort();
	} catch (error) {
		console.error(`Error reading ${API_TEST_BASE} directories:`, error);
		return [];
	}
}

/**
 * Execute a closure function from this helper file for stack trace testing
 *
 * @description
 * This helper simulates the original test-helper.mjs pattern where closures
 * defined in test files are executed from helper functions in different files.
 * Used to test stack-trace-based path resolution in api.slothlet.api.add calls.
 *
 * @param {object} api - Slothlet API instance
 * @param {function} closureFn - Closure function to execute
 * @returns {Promise<any>} Result of closure execution
 */
export async function executeClosureFromDifferentFile(api, closureFn) {
	// The closure will be executed from THIS file's context (vitest-helper.mjs)
	// But path resolution should still happen relative to where the closure was DEFINED
	return await closureFn(api);
}

/**
 * Execute with even more stack depth to test complex stack trace scenarios
 *
 * @param {object} api - Slothlet API instance
 * @param {function} closureFn - Closure function to execute
 * @returns {Promise<any>} Result of closure execution
 */
export async function executeWithDeepStack(api, closureFn) {
	return await executeClosureFromDifferentFile(api, closureFn);
}
