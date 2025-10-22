/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /src/lib/modes/slothlet_eager.mjs
 *	@Date: 2025-09-09 13:22:38 -07:00 (1757449358)
 *	@Author: Nate Hyson <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Hyson <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2025-10-22 08:12:13 -07:00 (1761145933)
 *	-----
 *	@Copyright: Copyright (c) 2013-2025 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Slothlet Eager Mode - Immediate module loading and API construction.
 * @module @cldmv/slothlet.modes.eager
 * @memberof module:@cldmv/slothlet.modes
 * @internal
 * @package
 * @description
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
 * - Immediate recursive directory traversal and module loading
 * - Complete API structure construction during initialization
 * - Direct function references without proxy wrapper overhead
 * - Consistent module loading patterns shared with lazy mode
 *
 * @example
 * // Basic slothlet usage with eager loading
 * import slothlet from "@cldmv/slothlet";
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
 *    config: {
 *      host: 'https://slothlet',
 *      username: 'admin',
 *      password: 'password',
 *      site: 'default',
 *      secure: true,
 *      verbose: true
 *    },
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
 *    task: { autoIP: [AsyncFunction: autoIP] },
 *    util: {
 *      controller: {
 *        getDefault: [Function: getDefault],
 *        detectEndpointType: [Function: detectEndpointType],
 *        detectDeviceType: [Function: detectDeviceType]
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
 *    shutdown: [Function: bound shutdown] AsyncFunction,
 *    __ctx: {
 *      self: [Circular *1],
 *      context: {},
 *      reference: { md5: [Function: md5] }
 *    }
 *  }
 */

// Eager mode now relies on the instance context (`this`) passed from slothlet core
// instead of importing a potentially different module instance via query params.
import fs from "node:fs/promises";
import path from "node:path";
// import { runWithCtx } from "@cldmv/slothlet/runtime";

/**
 * @function eager_wrapWithRunCtx
 * @internal
 * @package
 * @alias module:@cldmv/slothlet.modes.eager.eager_wrapWithRunCtx
 * @memberof module:@cldmv/slothlet.modes.eager
 * @param {*} obj - The object/function to wrap
 * @param {object} instance - The slothlet instance that will have boundapi.__ctx attached
 * @returns {*} The wrapped object/function
 *
 * @description
 * Recursively wraps all functions in an object with runWithCtx for eager mode.
 * This makes eager mode use the same call stack optimization as lazy mode.
 *
 * @example
 * // Wrapping a function
 * const wrappedFn = eager_wrapWithRunCtx(originalFunction, instance);
 *
 * @example
 * // Wrapping an object with nested functions
 * const wrappedObj = eager_wrapWithRunCtx({ method: fn }, instance);
 *
 * @example
 * // Wrapping a function
 * const wrappedFn = eager_wrapWithRunCtx(originalFunction, instance);
 *
 * @example
 * // Wrapping an object with nested functions
 * const wrappedObj = eager_wrapWithRunCtx({ method: fn }, instance);
 * const wrappedFn = eager_wrapWithRunCtx(originalFunction, instance);
 *
 * @example
 * // Wrapping an object with nested functions
 * const wrappedObj = eager_wrapWithRunCtx({ method: fn }, instance);
 */
/*
function eager_wrapWithRunCtx(obj, instance) {
	if (typeof obj === "function") {
		// Create a wrapper function that gets context dynamically from the API root
		const eager_wrappedFunction = function (...args) {
			// Dynamic context lookup (like lazy mode) instead of static lookup
			const ctx = instance.boundapi?.__ctx;
			if (ctx) {
				return runWithCtx(ctx, obj, this, args);
			} else {
				return obj.apply(this, args);
			}
		};

		// Preserve original function metadata
		try {
			Object.defineProperty(eager_wrappedFunction, "name", {
				value: obj.name,
				configurable: true
			});
		} catch {
			// ignore if name is not configurable
		}

		try {
			Object.defineProperty(eager_wrappedFunction, "length", {
				value: obj.length,
				configurable: true
			});
		} catch {
			// ignore if length is not configurable
		}

		// Copy any properties from the original function
		for (const [key, value] of Object.entries(obj)) {
			eager_wrappedFunction[key] = eager_wrapWithRunCtx(value, instance);
		}

		return eager_wrappedFunction;
	} else if (obj && typeof obj === "object" && !Array.isArray(obj)) {
		// Recursively wrap object properties
		const wrappedObj = {};
		for (const [key, value] of Object.entries(obj)) {
			wrappedObj[key] = eager_wrapWithRunCtx(value, instance);
		}
		return wrappedObj;
	}

	// Return primitives, arrays, etc. as-is
	return obj;
}
*/

/**
 * @function create
 * @internal
 * @package
 * @async
 * @alias module:@cldmv/slothlet.modes.eager.create
 * @memberof module:@cldmv/slothlet.modes.eager
 * @param {string} dir - Directory to load
 * @param {boolean} [rootLevel=true] - Is this the root level?
 * @param {number} [maxDepth=Infinity] - Maximum depth to traverse
 * @param {number} [currentDepth=0] - Current traversal depth
 * @returns {Promise<object>} Complete API object with all modules loaded
 * @throws {Error} When module loading or directory traversal fails
 *
 * @description
 * Creates the eager API for slothlet (mode: eager).
 * Immediately loads all modules and constructs the complete API structure.
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
	// const instance = this; // bound slothlet instance
	const entries = await fs.readdir(dir, { withFileTypes: true });
	const api = {};
	// const rootFunctions = [];
	const rootNamedExports = {};
	// let rootFunctionKey = null;
	let rootDefaultFunction = null;

	if (rootLevel) {
		for (const entry of entries) {
			if (this._shouldIncludeFile(entry)) {
				const ext = path.extname(entry.name);
				const fileName = path.basename(entry.name, ext);
				const apiKey = this._toApiKey(fileName);
				const mod = await this._loadSingleModule(path.join(dir, entry.name), true);
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
			api[this._toApiKey(entry.name)] = await this._loadCategory(categoryPath, currentDepth + 1, maxDepth);
		}
	}

	let finalApi;
	if (rootDefaultFunction) {
		Object.assign(rootDefaultFunction, api);
		finalApi = rootDefaultFunction;
	} else {
		finalApi = api;
	}

	// Wrap all functions with runWithCtx to match lazy mode performance
	// This uses dynamic context lookup like lazy mode does
	// finalApi = eager_wrapWithRunCtx(finalApi, instance);

	return finalApi;
}
