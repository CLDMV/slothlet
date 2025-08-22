/**
 * @fileoverview Slothlet Eager Mode - Immediate module loading and API construction
 *
 * This module implements the eager loading strategy for slothlet, where all modules
 * are loaded and processed immediately during initialization. This provides instant
 * access to all API endpoints without the overhead of lazy materialization.
 *
 * Key Features:
 * - Immediate loading of all modules in directory structure
 * - Complete API construction during initialization
 * - No proxy overhead - direct function access
 * - Predictable loading behavior for production environments
 * - Comprehensive module flattening and structuring
 * - Support for nested directory traversal with depth control
 *
 * Technical Implementation:
 * - create(): Main entry point for eager API construction
 * - _buildCompleteApi(): Builds callable API with proper function attachments
 * - Utilizes slothlet._loadCategory() for consistent module loading
 * - Maintains compatibility with lazy mode API structure
 *
 * Performance Characteristics:
 * - Higher initial load time (all modules loaded upfront)
 * - Consistent runtime performance (no materialization overhead)
 * - Ideal for production environments with predictable usage patterns
 * - Lower memory overhead (no proxy objects)
 *
 * @module @cldmv/slothlet/eager
 * @version 1.0.0
 * @author CLDMV/Shinrai
 *
 * @example
 * // Basic slothlet usage with eager loading
 * import slothlet from '@cldmv/slothlet';
 * const api = await slothlet({ dir: './api_test', lazy: false });
 *
 * // All modules are immediately loaded and available
 * console.log(typeof api.math); // 'object' (actual module)
 * console.log(Object.keys(api.math)); // ['add', 'multiply']
 *
 * @example
 * // Direct function access - no materialization delay
 * const result = await api.math.add(2, 3); // Immediate execution
 * console.log(result); // 5
 *
 * // All modules are pre-loaded and ready
 * console.log(typeof api.string); // 'object'
 * console.log(Object.keys(api.string)); // ['upper', 'reverse']
 *
 * @example
 *  UPON CREATION: API structure after creation
 *
 *  [Function: bound] {
 *    _impl: [Function (anonymous)],
 *    config: { host: 'https:unifi.example.com', username: 'admin', ... },
 *    rootFunctionShout: [Function: rootFunctionShout],
 *    rootFunctionWhisper: [Function: rootFunctionWhisper],
 *    rootMath: { add: [Function: add], multiply: [Function: multiply] },
 *    rootstring: { upper: [Function: upper], reverse: [Function: reverse] },
 *    advanced: {
 *      selfObject: { addViaSelf: [Function: addViaSelf] },
 *      nest: [Function: nest],
 *      nest2: { alpha: [Object], beta: [Object] },
 *      nest3: [Function: nest3],
 *      nest4: { singlefile: [Function: beta] }
 *    },
 *    exportDefault: [Function: exportDefault] { extra: [Function: extra] },
 *    funcmod: [Function: funcmod],
 *    math: { add: [Function: add], multiply: [Function: multiply] },
 *    multi: {
 *      alpha: { hello: [Function: hello] },
 *      beta: { world: [Function: world] }
 *    },
 *    multi_func: {
 *      alpha: [Function: alpha],
 *      beta: { hello: [Function: hello] },
 *      multi_func_hello: [Function: multi_func_hello],
 *      uniqueOne: [Function: uniqueOne],
 *      uniqueThree: [Function: uniqueThree],
 *      uniqueTwo: [Function: uniqueTwo]
 *    },
 *    nested: { date: { today: [Function: today] } },
 *    objectDefaultMethod: [Function: objectDefaultMethod] {
 *      info: [Function: info],
 *      warn: [Function: warn],
 *      error: [Function: error]
 *    },
 *    string: { upper: [Function: upper], reverse: [Function: reverse] },
 *    util: {
 *      controller: {
 *        getDefault: [AsyncFunction: getDefault],
 *        detectEndpointType: [AsyncFunction: detectEndpointType],
 *        detectDeviceType: [AsyncFunction: detectDeviceType]
 *      },
 *      extract: {
 *        data: [Function: data],
 *        section: [Function: section],
 *        NVRSection: [Function: NVRSection],
 *        parseDeviceName: [Function: parseDeviceName]
 *      },
 *      url: {
 *        buildUrlWithParams: [Function: buildUrlWithParams],
 *        cleanEndpoint: [Function: cleanEndpoint]
 *      },
 *      secondFunc: [Function: secondFunc],
 *      size: [Function: size]
 *    },
 *    md5: [Function: md5],
 *    describe: [Function (anonymous)],
 *    shutdown: [Function: bound shutdown] AsyncFunction
 *  }
 */

// Eager mode API construction functions for slothlet
const { slothlet } = await import(
	new URL(`../../slothlet.mjs?_slothlet=${new URL(import.meta.url).searchParams.get("_slothlet") || ""}`, import.meta.url).href
);
import fs from "fs/promises";
import path from "path";

/**
 * Creates the eager API for slothlet (mode: eager).
 * @async
 * @param {string} dir - Directory to load.
 * @param {boolean} [rootLevel=true] - Is this the root level?
 * @param {number} [maxDepth=Infinity] - Maximum depth to traverse
 * @param {number} [currentDepth=0] - Current traversal depth
 * @returns {Promise<object>} API object
 * @private
 * @internal
 *
 * @example
 * // Internal usage - called by slothlet core
 * const api = await create('./api_test', true, 3, 0);
 * // Returns: { math: { add: [Function], multiply: [Function] }, ... }
 *
 * @example
 * // Root-level processing with function exports
 * const api = await create('./api_test', true);
 * // If root has default function: api becomes that function with properties
 * // Otherwise: api is object with module properties
 */
export async function create(dir, rootLevel = true, maxDepth = Infinity, currentDepth = 0) {
	const entries = await fs.readdir(dir, { withFileTypes: true });
	const api = {};
	// const rootFunctions = [];
	const rootNamedExports = {};
	// let rootFunctionKey = null;
	let rootDefaultFunction = null;

	if (rootLevel) {
		for (const entry of entries) {
			if (entry.isFile() && entry.name.endsWith(".mjs") && !entry.name.startsWith(".")) {
				const fileName = path.basename(entry.name, ".mjs");
				const apiKey = slothlet._toApiKey(fileName);
				const mod = await slothlet._loadSingleModule(path.join(dir, entry.name), true);
				if (mod && typeof mod.default === "function") {
					if (!rootDefaultFunction) rootDefaultFunction = mod.default;
					for (const [key, value] of Object.entries(mod)) {
						if (key !== "default") api[key] = value;
					}
				} else {
					api[apiKey] = mod;
					for (const [key, value] of Object.entries(mod)) {
						rootNamedExports[key] = value;
					}
				}
			}
		}
	}

	for (const entry of entries) {
		if (entry.isDirectory() && !entry.name.startsWith(".") && currentDepth < maxDepth) {
			const categoryPath = path.join(dir, entry.name);
			api[slothlet._toApiKey(entry.name)] = await slothlet._loadCategory(categoryPath, currentDepth + 1, maxDepth);
		}
	}

	if (rootDefaultFunction) {
		Object.assign(rootDefaultFunction, api);
		return rootDefaultFunction;
	} else {
		return api;
	}
}

/**
 * Builds a complete API object from raw modules in eager mode.
 * @param {object} apiModules - Raw API modules to build
 * @returns {object} Complete API object with callable functions
 * @private
 * @internal
 * @example
 * // Internal usage by eager mode
 * const completeApi = _buildCompleteApi(rawModules);
 * // Converts: { math: { default: fn, add: fn } }
 * // To: { math: callableFunction with .add property }
 */
export function _buildCompleteApi(apiModules) {
	const buildModule = (module) => {
		if (!module) return module;
		if (typeof module === "function") {
			return module;
		}
		if (typeof module === "object" && module !== null) {
			if (typeof module.default === "function") {
				const callableApi = function (...args) {
					return module.default.apply(module, args);
				};
				for (const [methodName, method] of Object.entries(module)) {
					if (methodName === "default") continue;
					callableApi[methodName] = typeof method === "function" ? method : buildModule(method);
				}
				return callableApi;
			}
			const builtModule = {};
			for (const [methodName, method] of Object.entries(module)) {
				builtModule[methodName] = typeof method === "function" ? method : buildModule(method);
			}
			return builtModule;
		}
		return module;
	};
	let completeApi = {};
	if (typeof apiModules === "function") {
		completeApi = apiModules;
	}
	for (const [moduleName, module] of Object.entries(apiModules)) {
		completeApi[moduleName] = buildModule(module);
	}
	return completeApi;
}
