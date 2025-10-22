import { expect } from "vitest";
import { readFile } from "fs/promises";
import { parse } from "jsonc-parser";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load the JSONC config file
const configPath = join(__dirname, "api-test-config.jsonc");
const configContent = await readFile(configPath, "utf8");
export const testConfig = parse(configContent);

/**
 * Utility function to get a nested property from an object using a path array
 * @param {object} obj - The object to traverse
 * @param {string[]} path - Array of property names
 * @returns {any} The value at the path
 */
export function getNestedProperty(obj, path) {
	return path.reduce((current, key) => current && current[key], obj);
}

/**
 * Utility function to call a nested function with arguments
 * @param {object} api - The API object
 * @param {string[]} path - Array of property names leading to the function
 * @param {any[]} args - Arguments to pass to the function
 * @param {boolean} isAsync - Whether to await the call
 * @returns {Promise<any>|any} The result of the function call
 */
export async function callNestedFunction(api, path, args, isAsync = false) {
	const fn = getNestedProperty(api, path);

	if (path.length === 0) {
		// Root function call
		if (typeof api === "function") {
			return isAsync ? await api(...args) : api(...args);
		} else {
			throw new Error("API is not callable");
		}
	}

	if (typeof fn === "function") {
		return isAsync ? await fn(...args) : fn(...args);
	} else {
		throw new Error(`Property at path ${path.join(".")} is not a function`);
	}
}

/**
 * Run a comprehensive test suite based on the test configuration
 * @param {object} api - The API object to test
 * @param {boolean} isLazy - Whether the API is in lazy mode (requires await)
 * @param {string} mode - Test mode name for context
 */
export async function runComprehensiveTests(api, isLazy, mode) {
	const { apiTests, directTests } = testConfig.testConfig;

	// Test that API exists and is properly structured
	expect(api).toBeDefined();
	expect(typeof api).toBe("function"); // Should be callable due to root function

	// Run direct tests first
	for (const directTest of directTests) {
		const result = await callNestedFunction(api, directTest.path, directTest.args, isLazy);
		expect(result).toBe(directTest.expected);
	}

	// Run all API tests
	for (const testSection of apiTests) {
		for (const call of testSection.calls) {
			try {
				const shouldAwait = isLazy || call.async;
				const result = await callNestedFunction(api, call.path, call.args, shouldAwait);

				// Handle async controller functions that return promises in eager mode
				if (!isLazy && call.async && typeof result?.then === "function") {
					const resolvedResult = await result;
					expect(resolvedResult).toBe(call.expected);
				} else {
					expect(result).toBe(call.expected);
				}
			} catch (error) {
				throw new Error(`Failed ${call.label} in ${mode} mode: ${error.message}`);
			}
		}
	}
}

/**
 * Create an API instance for testing
 * @param {boolean} lazy - Whether to use lazy mode
 * @param {string} _ - Unused: unique identifier for multi-instance testing (legacy parameter)
 * @returns {Promise<object>} The created API instance
 */
export async function createTestApi(lazy = false, _ = "") {
	const { slothlet } = await import("../slothlet.mjs");

	return await slothlet({
		...testConfig.testConfig.baseConfig,
		lazy
	});
}

/**
 * Test API structure and properties
 * @param {object} api - The API to test
 * @param {boolean} isLazy - Whether it's lazy mode
 */
export function testApiStructure(api, isLazy) {
	// Test that API is callable (has root function)
	expect(typeof api).toBe("function");

	// Test that API has expected properties
	const expectedProperties = [
		"config",
		"rootFunctionShout",
		"rootFunctionWhisper",
		"rootMath",
		"rootstring",
		"advanced",
		"exportDefault",
		"funcmod",
		"math",
		"multi",
		"multi_func",
		"nested",
		"objectDefaultMethod",
		"string",
		"util",
		"describe",
		"shutdown"
	];

	for (const prop of expectedProperties) {
		expect(api).toHaveProperty(prop);
	}

	// In lazy mode, most properties should be proxy functions
	if (isLazy) {
		const lazyProperties = [
			"advanced",
			"exportDefault",
			"funcmod",
			"math",
			"multi",
			"multi_func",
			"nested",
			"objectDefaultMethod",
			"string",
			"util"
		];
		for (const prop of lazyProperties) {
			expect(typeof api[prop]).toBe("function");
			expect(api[prop].name).toContain("lazyFolder_");
		}
	} else {
		// In eager mode, properties should be their actual types
		expect(typeof api.math).toBe("object");
		expect(typeof api.string).toBe("object");
		expect(typeof api.util).toBe("object");
	}
}
