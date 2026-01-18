/**
 * Utility to traverse nested properties using a path array.
 * @param {object} obj
 * @param {string[]} pathParts
 * @returns {any}
 */
export function getNestedProperty(obj: object, pathParts: string[]): any;
/**
 * Invoke a nested function on the API.
 * @param {object|Function} api
 * @param {string[]} pathParts
 * @param {any[]} args
 * @param {boolean} isAsync
 * @returns {Promise<any>|any}
 */
export function callNestedFunction(api: object | Function, pathParts: string[], args: any[], isAsync?: boolean): Promise<any> | any;
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
export function getMatrixConfigs(requirements?: object): Array<{
    name: string;
    config: object;
}>;
/**
 * Run a test function with an existing API instance.
 * Used for testing scenarios where functions are called from different files/contexts.
 * @param {object} api - Slothlet API instance
 * @param {Function} testFunction - Test function to run with the API
 * @returns {Promise<void>}
 * @example
 * await runTestWithApi(api, async (api) => {
 *   await api.addApi("test", "./path");
 * });
 */
export function runTestWithApi(api: object, testFunction: Function): Promise<void>;
/**
 * Get a subset of the matrix by configuration names
 * @param {string[]} names - Array of configuration names to include
 * @returns {Array<{name: string, config: object}>} Filtered matrix
 */
export function getSelectMatrix(names: string[]): Array<{
    name: string;
    config: object;
}>;
/**
 * Get all API test folders synchronously for vitest test generation
 * @returns {string[]} Array of folder names/paths for all API test directories
 */
export function getAllApiTestFoldersSync(): string[];
/**
 * Get all API test folders, including smart_flatten subfolders
 * @returns {Promise<string[]>} Array of folder names/paths for all API test directories
 */
export function getAllApiTestFolders(): Promise<string[]>;
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
export function executeClosureFromDifferentFile(api: object, closureFn: Function): Promise<any>;
/**
 * Execute with even more stack depth to test complex stack trace scenarios
 *
 * @param {object} api - Slothlet API instance
 * @param {function} closureFn - Closure function to execute
 * @returns {Promise<any>} Result of closure execution
 */
export function executeWithDeepStack(api: object, closureFn: Function): Promise<any>;
export const testConfig: any;
/**
 * Determine which API test directory to use based on NODE_OPTIONS conditions
 * - slothlet-three-dev (--conditions=slothlet-three-dev) → use api_tests_v3
 * - slothlet-dev (--conditions=slothlet-dev or development) → use api_tests (v2/src)
 * - default (production/dist) → use api_tests (v2/dist)
 * @type {string}
 */
export const API_TEST_BASE: string;
/**
 * Common test API directories with resolved absolute paths
 * Automatically switches between api_tests (v2) and api_tests_v3 based on NODE_OPTIONS conditions
 * @type {object}
 */
export const TEST_DIRS: object;
/**
 * Full test matrix covering all meaningful slothlet initialization options
 * This is the authoritative matrix for vitest - all tests should use this
 * ALL config options are explicitly set to avoid dependency on defaults
 * Uses `mode` parameter (not deprecated `lazy`) for loading strategy
 * @type {Array<{name: string, config: object}>}
 */
export const TEST_MATRIX: Array<{
    name: string;
    config: object;
}>;
/**
 * Ownership-enabled configurations only (hotReload: true)
 * Used for tests that specifically need module ownership tracking
 * @type {Array<{name: string, config: object}>}
 */
export const OWNERSHIP_MATRIX: Array<{
    name: string;
    config: object;
}>;
/**
 * Basic configurations without advanced features (no hot reload, default overwrite, infinite depth)
 * Used for simple functionality tests that don't need ownership/overwrite features
 * @type {Array<{name: string, config: object}>}
 */
export const BASIC_MATRIX: Array<{
    name: string;
    config: object;
}>;
/**
 * Overwrite configuration matrix (allowApiOverwrite true/false)
 * Used for testing API overwrite protection features
 * @type {Array<{name: string, config: object}>}
 */
/**
 * Depth configuration matrix (apiDepth variations, excluding infinite depth)
 * Used for testing API depth limitations
 * @type {Array<{name: string, config: object}>}
 */
/**
 * Runtime configuration matrix (async vs live bindings)
 * Used for testing runtime binding system differences
 * @type {Array<{name: string, config: object}>}
 */
export const RUNTIME_MATRIX: Array<{
    name: string;
    config: object;
}>;
/**
 * Complex feature combination matrix (multiple non-default features enabled)
 * Used for comprehensive feature interaction tests
 * @type {Array<{name: string, config: object}>}
 */
export const COMPLEX_MATRIX: Array<{
    name: string;
    config: object;
}>;
//# sourceMappingURL=vitest-helper.d.mts.map