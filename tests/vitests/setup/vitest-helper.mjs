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
 * Common test API directories with resolved absolute paths
 * @type {object}
 */
export const TEST_DIRS = {
	API_TEST: path.resolve(__dirname, "../../../api_tests/api_test"),
	API_TEST_CJS: path.resolve(__dirname, "../../../api_tests/api_test_cjs"),
	API_TEST_MIXED: path.resolve(__dirname, "../../../api_tests/api_test_mixed"),
	API_TEST_COLLECTIONS: path.resolve(__dirname, "../../../api_tests/api_test_collections"),
	API_TEST_ROOT_ISSUE: path.resolve(__dirname, "../../../api_tests/api_test_root_issue"),
	SMART_FLATTEN: path.resolve(__dirname, "../../../api_tests/smart_flatten")
};

/**
 * Configuration space definition for automatic matrix generation
 * @type {object}
 */
const CONFIG_SPACE = {
	mode: ["eager", "lazy"],
	runtime: ["async", "live"],
	// allowApiOverwrite: [false, true],
	hotReload: [false, true],
	// apiDepth: [1, 3, Infinity],
	hooks: [false, true]
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

		// Generate descriptive name
		const nameParts = [];
		nameParts.push(config.mode.toUpperCase());
		if (config.runtime === "live") nameParts.push("LIVE");
		// if (!config.allowApiOverwrite) nameParts.push("DENY");
		if (config.hotReload) nameParts.push("HOT");
		// if (config.apiDepth !== Infinity) nameParts.push(`DEPTH_${config.apiDepth}`);
		if (config.hooks) nameParts.push("HOOKS");

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
 * Ownership-enabled configurations only (hotReload: true)
 * Used for tests that specifically need module ownership tracking
 * @type {Array<{name: string, config: object}>}
 */
export const OWNERSHIP_MATRIX = TEST_MATRIX.filter(({ config }) => config.hotReload);

/**
 * Get filtered matrix configurations based on test requirements
 * @param {object} requirements - Required configuration features
 * @returns {Array<{name: string, config: object}>} Filtered matrix configs
 *
 * @example
 * // Test needs hot reload functionality
 * const hotReloadConfigs = getMatrixConfigs({ hotReload: true });
 *
 * @example
 * // Test needs live bindings with overwrite protection
 * const liveProtectedConfigs = getMatrixConfigs({ runtime: "live", allowApiOverwrite: false });
 *
 * @example
 * // Test needs lazy loading only
 * const lazyConfigs = getMatrixConfigs({ mode: "lazy" });
 */
export function getMatrixConfigs(requirements = {}) {
	return TEST_MATRIX.filter((matrixConfig) => {
		// Filter based on requirements
		for (const [key, value] of Object.entries(requirements)) {
			// If requirement specifies a value, config must match
			if (matrixConfig.config[key] !== undefined && matrixConfig.config[key] !== value) {
				return false;
			}
		}

		return true;
	});
}

/**
 * Basic configurations without advanced features (no hot reload, default overwrite, infinite depth)
 * Used for simple functionality tests that don't need ownership/overwrite features
 * @type {Array<{name: string, config: object}>}
 */
export const BASIC_MATRIX = TEST_MATRIX.filter(
	({ config }) => config.hotReload === false && config.runtime === "async"
	// config.hotReload === false && config.allowApiOverwrite === true && config.apiDepth === Infinity && config.runtime === "async"
);

/**
 * Overwrite configuration matrix (allowApiOverwrite true/false)
 * Used for testing API overwrite protection features
 * @type {Array<{name: string, config: object}>}
 */
// export const OVERWRITE_MATRIX = TEST_MATRIX.filter(({ config }) => config.allowApiOverwrite === false);

/**
 * Depth configuration matrix (apiDepth variations, excluding infinite depth)
 * Used for testing API depth limitations
 * @type {Array<{name: string, config: object}>}
 */
// export const DEPTH_MATRIX = TEST_MATRIX.filter(({ config }) => config.apiDepth !== Infinity);

/**
 * Runtime configuration matrix (async vs live bindings)
 * Used for testing runtime binding system differences
 * @type {Array<{name: string, config: object}>}
 */
export const RUNTIME_MATRIX = TEST_MATRIX.filter(({ config }) => config.runtime === "live");

/**
 * Complex feature combination matrix (multiple non-default features enabled)
 * Used for comprehensive feature interaction tests
 * @type {Array<{name: string, config: object}>}
 */
export const COMPLEX_MATRIX = TEST_MATRIX.filter(({ config }) => {
	let featureCount = 0;
	if (config.hotReload === true) featureCount++;
	if (config.runtime === "live") featureCount++;
	// if (config.allowApiOverwrite === false) featureCount++;
	// if (config.apiDepth !== Infinity) featureCount++;
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
		const apiTestsDir = path.join(projectRoot, "api_tests");
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
		console.error("Error reading api_tests directories:", error);
		return [];
	}
}

/**
 * Get all API test folders, including smart_flatten subfolders
 * @returns {Promise<string[]>} Array of folder names/paths for all API test directories
 */
export async function getAllApiTestFolders() {
	try {
		const apiTestsDir = "./api_tests";
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
		console.error("Error reading api_tests directories:", error);
		return [];
	}
}

/**
 * Execute a closure function from this helper file for stack trace testing
 *
 * @description
 * This helper simulates the original test-helper.mjs pattern where closures
 * defined in test files are executed from helper functions in different files.
 * Used to test stack-trace-based path resolution in addApi calls.
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
