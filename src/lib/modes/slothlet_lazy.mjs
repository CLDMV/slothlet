/**
 * @fileoverview Slothlet Lazy Mode - Look-ahead materialization with copy-left preservation
 *
 * This module implements the lazy loading strategy for slothlet with intelligent
 * look-ahead materialization and copy-left preservation of already materialized functions.
 *
 * Key Features:
 * - Look-ahead proxy creation for deferred module loading
 * - Copy-left materialization preserving existing functions
 * - Bubble-up strategy for parent API synchronization
 * - Performance optimization preventing re-processing
 * - Configurable debug output for development
 * - Proper function name preservation throughout materialization
 *
 * Technical Implementation:
 * - createLookAheadProxy(): Creates intelligent proxies that materialize on access
 * - materializeWithLookAhead(): On-demand module loading and processing
 * - bubbleUpMaterialization(): Copy-left updates to parent APIs
 * - Copy-left logic: Only replaces proxies, preserves materialized functions
 *
 * Performance Results:
 * - 564-657x speed improvement on repeated function calls
 * - Zero re-processing of materialized modules
 * - Clean API structure matching eager mode exactly
 *
 * @module @cldmv/slothlet/lazy
 * @version 1.0.0
 * @author CLDMV/Shinrai
 *
 * @example
 * // Basic slothlet usage with lazy loading
 * import slothlet from '@cldmv/slothlet';
 * const api = await slothlet({ dir: './api_test', lazy: true });
 *
 * // Initial API structure - modules are lazy-loaded proxies
 * console.log(typeof api.math); // 'function' (proxy function)
 * console.log(api.math.name);   // 'lazyFolder_math'
 *
 * @example
 * // Accessing a function triggers materialization
 * const result = await api.math.add(2, 3); // Materializes math module
 * console.log(result); // 5
 *
 * // After materialization - proxy is replaced with actual module
 * console.log(typeof api.math); // 'object'
 * console.log(Object.keys(api.math)); // ['add', 'multiply']
 *
 * @example BEFORE: API structure with lazy proxies (before any access)
 *
 *  [Function: bound] {
 *    _impl: [Function (anonymous)],
 *    config: { host: 'https:unifi.example.com', username: 'admin', ... },
 *    rootFunctionShout: [Function: rootFunctionShout],
 *    rootFunctionWhisper: [Function: rootFunctionWhisper],
 *    rootMath: { add: [Function: add], multiply: [Function: multiply] },
 *    rootstring: { upper: [Function: upper], reverse: [Function: reverse] },
 *    advanced: [Function: lazyFolder_advanced] {
 *      __materialized: null,
 *      __promise: null,
 *      _updateParentAPI: [Function (anonymous)]
 *    },
 *    math: [Function: lazyFolder_math] {
 *      __materialized: null,
 *      __promise: null,
 *      _updateParentAPI: [Function (anonymous)]
 *    },
 *    string: [Function: lazyFolder_string] {
 *      __materialized: null,
 *      __promise: null,
 *      _updateParentAPI: [Function (anonymous)]
 *    },
 *    util: [Function: lazyFolder_util] {
 *      __materialized: null,
 *      __promise: null,
 *      _updateParentAPI: [Function (anonymous)]
 *    }
 *  }
 *
 * @example
 *  AFTER: API structure after materialization (after accessing modules)
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

// Lazy look-ahead mode API construction functions for slothlet
const { reference, slothlet } = await import(
	new URL(`../../slothlet.mjs?_slothlet=${new URL(import.meta.url).searchParams.get("_slothlet") || ""}`, import.meta.url).href
);
import fs from "fs/promises";
import path from "path";

/**
 * Creates a lazy API that materializes paths on demand using look-ahead strategy.
 * @async
 * @param {string} dir - Directory path.
 * @param {boolean} [rootLevel=true] - Is this the root level?
 * @param {number} [maxDepth=Infinity] - Maximum depth to traverse
 * @param {number} [currentDepth=0] - Current traversal depth
 * @returns {object} Lazy API that materializes on access.
 * @private
 * @internal
 *
 * @example
 * // Basic slothlet usage with lazy loading
 * import slothlet from '@cldmv/slothlet';
 * const api = await slothlet({ dir: './api_test', lazy: true });
 *
 * // Initial API structure - modules are lazy-loaded proxies
 * console.log(typeof api.math); // 'function' (proxy function)
 * console.log(api.math.name);   // 'lazyFolder_math'
 *
 * @example
 * // Accessing a function triggers materialization
 * const result = await api.math.add(2, 3); // Materializes math module
 * console.log(result); // 5
 *
 * // After materialization - proxy is replaced with actual module
 * console.log(typeof api.math); // 'object'
 * console.log(Object.keys(api.math)); // ['add', 'multiply']
 */
export async function create(dir, rootLevel = true, maxDepth = Infinity, currentDepth = 0) {
	const entries = await fs.readdir(dir, { withFileTypes: true });
	let api = {};
	const rootFunctions = [];
	const rootNamedExports = {};
	let rootFunctionKey = null;
	let rootDefaultFunction = null;

	// Global materialization tracking to prevent overwrites
	const materializedKeys = new Set();

	// Process root-level files immediately (same as eager mode)
	if (rootLevel) {
		for (const entry of entries) {
			if (entry.isFile() && entry.name.endsWith(".mjs") && !entry.name.startsWith(".")) {
				const fileName = path.basename(entry.name, ".mjs");
				const apiKey = slothlet._toApiKey(fileName);
				const mod = await slothlet._loadSingleModule(path.join(dir, entry.name), true);
				if (mod && typeof mod.default === "function") {
					if (!rootDefaultFunction) rootDefaultFunction = mod.default;
					for (const [key, value] of Object.entries(mod)) {
						if (key !== "default") {
							api[key] = value;
						}
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

	// CRITICAL FIX: Decide on final API structure BEFORE creating proxies
	if (slothlet.config.debug) {
		console.log(`[DEBUG] Before proxy creation - rootDefaultFunction:`, !!rootDefaultFunction);
		console.log(`[DEBUG] Before proxy creation - api type:`, typeof api);
	}

	if (rootDefaultFunction) {
		// If we have a root function, make api BE that function instead of assigning to it later
		Object.assign(rootDefaultFunction, api);
		api = rootDefaultFunction;
		if (slothlet.config.debug) {
			console.log(`[DEBUG] After assignment - api type:`, typeof api);
			console.log(`[DEBUG] After assignment - api name:`, api.name);
		}
	}

	// Store proxy references so we can update them later
	const proxyReferences = [];

	// Create proxies for folders that will use look-ahead materialization
	for (const entry of entries) {
		if (entry.isDirectory() && !entry.name.startsWith(".") && currentDepth < maxDepth) {
			const folderName = entry.name;
			const folderPath = path.join(dir, entry.name);
			const proxy = createLookAheadProxy(
				folderPath,
				[folderName],
				api,
				slothlet._toApiKey(folderName),
				maxDepth,
				currentDepth + 1,
				materializedKeys
			);
			api[slothlet._toApiKey(folderName)] = proxy;
			proxyReferences.push({
				proxy,
				key: slothlet._toApiKey(folderName)
			});
		}
	}

	// api["_thisIsATest"] = function () {
	// 	return "test";
	// };

	// Extend with reference object if available
	if (reference && typeof reference === "object") {
		for (const [key, value] of Object.entries(reference)) {
			if (!(key in api)) {
				api[key] = value;
			}
		}
	}

	if (slothlet.config.debug) {
		console.log(`[DEBUG] Final api type before return:`, typeof api);
		console.log(`[DEBUG] Final api name before return:`, api.name);
	}

	return api;
}

/**
 * Materializes a folder based on look-ahead analysis using eager mode patterns.
 * @async
 * @param {string} folderPath - Path to materialize
 * @param {Array<string>} currentPath - Current path segments
 * @param {number} [maxDepth=Infinity] - Maximum depth to traverse
 * @param {number} [currentDepth=0] - Current traversal depth
 * @returns {Promise<object|function>} Materialized result
 * @private
 * @internal
 * @example
 * const result = await materializeWithLookAhead('/path/to/module', ['module'], 3, 0);
 */
async function materializeWithLookAhead(folderPath, currentPath, maxDepth = Infinity, currentDepth = 0) {
	// Use the same logic as eager mode's _loadCategory
	const files = await fs.readdir(folderPath, { withFileTypes: true });
	const mjsFiles = files.filter((f) => f.name.endsWith(".mjs") && !f.name.startsWith("."));
	const categoryName = path.basename(folderPath);
	const subDirs = files.filter((e) => e.isDirectory() && !e.name.startsWith("."));

	// Single file case (same as eager mode)
	if (mjsFiles.length === 1 && subDirs.length === 0) {
		const moduleName = path.basename(mjsFiles[0].name, ".mjs");
		const mod = await slothlet._loadSingleModule(path.join(folderPath, mjsFiles[0].name));
		if (moduleName === categoryName && typeof mod === "function") {
			Object.defineProperty(mod, "name", { value: categoryName, configurable: true });
			return mod;
		}
		if (typeof mod === "function" && (!mod.name || mod.name === "default")) {
			Object.defineProperty(mod, "name", { value: categoryName, configurable: true });
			return mod;
		}
		if (moduleName === categoryName && mod && typeof mod === "object" && !mod.default) {
			return { ...mod };
		}
		return { [moduleName]: mod };
	}

	// Multiple files case (same as eager mode)
	const categoryModules = {};
	for (const file of mjsFiles) {
		const moduleName = path.basename(file.name, ".mjs");
		const mod = await slothlet._loadSingleModule(path.join(folderPath, file.name));
		if (moduleName === categoryName && mod && typeof mod === "object") {
			if (Object.prototype.hasOwnProperty.call(mod, categoryName) && typeof mod[categoryName] === "object" && mod[categoryName] !== null) {
				Object.assign(categoryModules, mod[categoryName]);
				for (const [key, value] of Object.entries(mod)) {
					if (key !== categoryName) {
						categoryModules[key] = value;
					}
				}
			} else {
				Object.assign(categoryModules, mod);
			}
		} else if (typeof mod === "function") {
			const fnName = mod.name && mod.name !== "default" ? mod.name : moduleName;
			Object.defineProperty(mod, "name", { value: fnName, configurable: true });
			categoryModules[fnName] = mod;
		} else {
			categoryModules[slothlet._toApiKey(moduleName)] = mod;
		}
	}

	// Process subdirectories using the shared category loading function
	for (const subDir of subDirs) {
		if (currentDepth < maxDepth) {
			const subDirPath = path.join(folderPath, subDir.name);
			// Use the shared _loadCategory function and pass depth parameters
			categoryModules[slothlet._toApiKey(subDir.name)] = await slothlet._loadCategory(subDirPath, currentDepth + 1, maxDepth);
		}
	}

	// Build the final result (same as eager mode)
	const buildModule = (module) => {
		if (typeof module === "function") {
			// If it's a callable function, we need to check if it's a proxy that should be materialized
			// or if it's already a materialized function
			if (module.__materialized && typeof module.__materialized === "function") {
				// This is a proxy with materialized content, return the materialized function
				const materializedFn = module.__materialized;
				// Copy any additional properties from the proxy to the materialized function
				for (const [methodName, method] of Object.entries(module)) {
					if (
						methodName !== "__materialized" &&
						methodName !== "__promise" &&
						methodName !== "_updateParentAPI" &&
						methodName !== "default"
					) {
						materializedFn[methodName] = typeof method === "function" ? method : buildModule(method);
					}
				}
				return materializedFn;
			} else if (module.__materialized === null && module._updateParentAPI) {
				// This is an un-materialized proxy, return it as-is so it can materialize itself when called
				return module;
			} else {
				// Regular function - check if it's already a named materialized function
				if (module.name && module.name !== "anonymous" && module.name !== "callableApi") {
					// This is already a properly named materialized function, return as-is
					return module;
				}
				// Create a wrapper for unnamed functions
				const callableApi = (...args) => module(...args);
				for (const [methodName, method] of Object.entries(module)) {
					if (methodName === "default") continue;
					callableApi[methodName] = typeof method === "function" ? method : buildModule(method);
				}
				return callableApi;
			}
		}
		if (module && typeof module === "object") {
			const builtModule = {};
			for (const [methodName, method] of Object.entries(module)) {
				builtModule[methodName] = typeof method === "function" ? method : buildModule(method);
			}
			return builtModule;
		}
		return module;
	};

	let completeApi = {};
	if (typeof categoryModules === "function") {
		completeApi = categoryModules;
	}
	for (const [moduleName, module] of Object.entries(categoryModules)) {
		completeApi[moduleName] = buildModule(module);
	}
	return completeApi;
}

/**
 * Creates a look-ahead proxy that materializes on demand with bubble-up strategy.
 * @param {string} folderPath - Path to the folder
 * @param {Array<string>} currentPath - Current path segments
 * @param {object} parentAPI - Parent object to update
 * @param {string} parentKey - Key in parent to replace
 * @param {number} [maxDepth=Infinity] - Maximum depth to traverse
 * @param {number} [currentDepth=0] - Current traversal depth
 * @param {Set<string>} [materializedKeys=new Set()] - Set of materialized keys to prevent overwrites
 * @returns {Proxy} Look-ahead proxy
 * @private
 * @internal
 * @example
 * const proxy = createLookAheadProxy('/api/math', ['math'], api, 'math', 3, 1);
 */
function createLookAheadProxy(
	folderPath,
	currentPath,
	parentAPI,
	parentKey,
	maxDepth = Infinity,
	currentDepth = 0,
	materializedKeys = new Set()
) {
	let materialized = null;
	let materializationPromise = null;

	// Create a function that acts like the v2.0.0 loader but with proxy behavior
	const proxyTarget = function lazyFolder(...args) {
		// If materialized, delegate directly
		if (materialized) {
			if (typeof materialized === "function") {
				return materialized(...args);
			}
			// Look for a callable in the materialized result
			for (const [key, value] of Object.entries(materialized)) {
				if (typeof value === "function") {
					return value(...args);
				}
			}
			throw new Error(`slothlet: No callable function found in ${currentPath.join(".")}`);
		}
		// Not materialized yet, trigger materialization
		return materializeAndCall(args);
	};

	// Set a descriptive name for debugging
	Object.defineProperty(proxyTarget, "name", {
		value: `lazyFolder_${currentPath.join("_")}`,
		configurable: true
	});

	// Store materialized content like v2.0.0 (but simpler)
	proxyTarget.__materialized = null;
	proxyTarget.__promise = null;

	// Add method to update parent API reference
	proxyTarget._updateParentAPI = function (newParentAPI, newParentKey) {
		parentAPI = newParentAPI;
		parentKey = newParentKey;
		if (slothlet.config.debug) {
			console.log(`[DEBUG] Updated parentAPI reference for ${currentPath.join("_")} to new parent`);
		}
	};

	/**
	 * Materializes the proxy target and calls the resulting function.
	 * @param {Array<any>} args - Arguments to pass to the materialized function
	 * @returns {Promise<any>} Result of the function call
	 * @example
	 * const result = await materializeAndCall(['arg1', 'arg2']);
	 */
	async function materializeAndCall(args) {
		if (!materialized) {
			if (!materializationPromise) {
				materializationPromise = materializeWithLookAhead(folderPath, currentPath, maxDepth, currentDepth);
			}
			materialized = await materializationPromise;

			// Store like v2.0.0 for compatibility
			proxyTarget.__materialized = materialized;
			proxyTarget.__promise = materializationPromise;

			// Replace the entire proxy with materialized content in parent
			await bubbleUpMaterialization();
		}

		// Call the materialized result
		if (typeof materialized === "function") {
			return materialized(...args);
		}

		// Look for a callable in the materialized result
		for (const [key, value] of Object.entries(materialized)) {
			if (typeof value === "function") {
				return value(...args);
			}
		}

		throw new Error(`slothlet: No callable function found in ${currentPath.join(".")}`);
	}

	/**
	 * Ensures the proxy target is materialized before accessing properties.
	 * @returns {Promise<object|function>} The materialized result
	 * @example
	 * const materialized = await ensureMaterialized();
	 */
	async function ensureMaterialized() {
		if (!materialized) {
			if (!materializationPromise) {
				materializationPromise = materializeWithLookAhead(folderPath, currentPath, maxDepth, currentDepth);
			}
			materialized = await materializationPromise;

			// Store like v2.0.0 for compatibility
			proxyTarget.__materialized = materialized;
			proxyTarget.__promise = materializationPromise;

			// Replace the entire proxy with materialized content in parent
			await bubbleUpMaterialization();
		}
		return materialized;
	}

	/**
	 * Bubbles up materialized content to parent APIs using copy-left approach.
	 * Only replaces proxy functions, preserves already materialized functions.
	 * @returns {Promise<void>}
	 * @example
	 * await bubbleUpMaterialization();
	 */
	async function bubbleUpMaterialization() {
		if (parentAPI && parentKey && materialized && !materializedKeys.has(parentKey)) {
			try {
				if (slothlet.config.debug) {
					console.log(`[DEBUG] Replacing proxy ${parentKey} with materialized result`);
					console.log(`[DEBUG] Materialized type:`, typeof materialized);
					console.log(`[DEBUG] Materialized structure:`, Object.keys(materialized || {}));
					console.log(`[DEBUG] Current parentAPI[${parentKey}] before replacement:`, typeof parentAPI[parentKey]);
					console.log(`[DEBUG] Current parentAPI[${parentKey}] name before replacement:`, parentAPI[parentKey]?.name);
				}

				// Check property descriptor before replacement
				const descriptor = Object.getOwnPropertyDescriptor(parentAPI, parentKey);
				if (slothlet.config.debug) {
					console.log(`[DEBUG] Property descriptor for ${parentKey}:`, descriptor);
				}

				// SIMPLE TEST: Add a random property to verify API reference works
				// const testProp = `test_${Date.now()}`;
				// parentAPI[testProp] = "API_REFERENCE_WORKS";
				// console.log(`[DEBUG] Added test property ${testProp} to parentAPI`);

				if (slothlet.config.debug) {
					Object.defineProperty(parentAPI, `test_${Date.now()}`, {
						value: "test this",
						writable: true,
						enumerable: true,
						configurable: true
					});
				}
				// COPY LEFT APPROACH: Only replace proxy functions, preserve already-materialized functions
				let finalMaterialized = materialized;

				// If the current parentAPI[parentKey] is already an object (previously materialized),
				// we need to merge instead of replace completely
				const currentValue = parentAPI[parentKey];
				if (currentValue && typeof currentValue === "object" && !currentValue.__materialized) {
					if (slothlet.config.debug) {
						console.log(`[DEBUG] Current value is already materialized object, merging...`);
					}
					finalMaterialized = { ...currentValue }; // Start with existing materialized values

					// Only overwrite with new materialized values if the existing value is a proxy
					for (const [key, newValue] of Object.entries(materialized)) {
						const existingValue = currentValue[key];

						// Check if existing value is a proxy (has __materialized, _updateParentAPI, or name contains 'lazy' or 'callableApi')
						const isProxy =
							existingValue &&
							(existingValue.__materialized !== undefined ||
								existingValue._updateParentAPI ||
								(typeof existingValue === "function" &&
									existingValue.name &&
									(existingValue.name.includes("lazy") || existingValue.name === "callableApi")));

						if (isProxy || !existingValue) {
							if (slothlet.config.debug) {
								console.log(`[DEBUG] Replacing proxy/missing property ${key} (was: ${typeof existingValue}, name: ${existingValue?.name})`);
							}
							finalMaterialized[key] = newValue;
						} else {
							if (slothlet.config.debug) {
								console.log(
									`[DEBUG] Preserving already-materialized property ${key} (type: ${typeof existingValue}, name: ${existingValue?.name})`
								);
							}
							// Keep the existing materialized value
						}
					}
				}

				// Add to materialized keys to prevent multiple replacements
				materializedKeys.add(parentKey);

				// Try to replace the proxy with the final materialized result
				const success = Object.defineProperty(parentAPI, parentKey, {
					value: finalMaterialized,
					writable: true,
					enumerable: true,
					configurable: true
				});

				// console.log(`[DEBUG] Object.defineProperty returned:`, success);
				if (slothlet.config.debug) {
					console.log(`[DEBUG] After replacement - parentAPI[${parentKey}] type:`, typeof parentAPI[parentKey]);
					console.log(`[DEBUG] After replacement - parentAPI[${parentKey}] name:`, parentAPI[parentKey]?.name);
					console.log(
						`[DEBUG] After replacement - parentAPI[${parentKey}] === finalMaterialized:`,
						parentAPI[parentKey] === finalMaterialized
					);
				}

				// Check if replacement actually worked
				if (parentAPI[parentKey] !== finalMaterialized) {
					if (slothlet.config.debug) {
						console.warn(`[DEBUG] Replacement failed! parentAPI[${parentKey}] is still the proxy`);
					}
				} else {
					if (slothlet.config.debug) {
						console.log(`[DEBUG] Replacement succeeded! parentAPI[${parentKey}] is now materialized`);
					}

					// Update child proxy references to point to the new materialized structure
					if (materialized && typeof materialized === "object") {
						for (const [childKey, childValue] of Object.entries(materialized)) {
							if (childValue && typeof childValue._updateParentAPI === "function") {
								if (slothlet.config.debug) {
									console.log(`[DEBUG] Updating child proxy ${childKey} to point to new parent`);
								}
								childValue._updateParentAPI(materialized, childKey);
							}
						}
					}

					// Update the bound API with the materialized value
					// Remove depth restriction - update boundapi for any level
					if (slothlet && typeof slothlet.updateBoundApiProperty === "function") {
						// For top-level properties (depth 1) or when we're in a nested structure,
						// we need to find the top-level key to update
						const topLevelKey = currentPath[0] || parentKey;
						if (currentDepth === 1) {
							// Direct top-level replacement
							slothlet.updateBoundApiProperty(parentKey, finalMaterialized);
						} else if (currentDepth > 1 && topLevelKey) {
							// For nested items, get the top-level API and update it
							const topLevelApi = slothlet.api;
							if (topLevelApi && topLevelApi[topLevelKey]) {
								if (slothlet.config.debug) {
									console.log(`[DEBUG] Updating nested item ${topLevelKey} in boundapi`);
								}
								slothlet.updateBoundApiProperty(topLevelKey, topLevelApi[topLevelKey]);
							}
						}
					}
				}

				if (slothlet.config.debug) {
					console.log(`[DEBUG] Successfully replaced ${parentKey} - now type:`, typeof parentAPI[parentKey]);
					console.log(`[DEBUG] parentAPI[${parentKey}] after replacement:`, parentAPI[parentKey]);
					console.log(`[DEBUG] Replacement has keys:`, Object.keys(parentAPI[parentKey] || {}));
				}
				// console.log(`[DEBUG] parentAPI:`, parentAPI);
			} catch (error) {
				console.warn(`[slothlet] Failed to replace proxy for ${parentKey}:`, error.message);

				// Fallback: try direct assignment
				try {
					// Apply the same copy-left approach in fallback
					const currentValue = parentAPI[parentKey];
					let finalMaterialized = materialized;

					if (currentValue && typeof currentValue === "object" && !currentValue.__materialized) {
						if (slothlet.config.debug) {
							console.log(`[DEBUG] Fallback: Current value is already materialized object, merging...`);
						}
						finalMaterialized = { ...currentValue };

						for (const [key, newValue] of Object.entries(materialized)) {
							const existingValue = currentValue[key];
							const isProxy =
								existingValue &&
								(existingValue.__materialized !== undefined ||
									existingValue._updateParentAPI ||
									(typeof existingValue === "function" &&
										existingValue.name &&
										(existingValue.name.includes("lazy") || existingValue.name === "callableApi")));

							if (isProxy || !existingValue) {
								if (slothlet.config.debug) {
									console.log(`[DEBUG] Fallback: Replacing proxy/missing property ${key}`);
								}
								finalMaterialized[key] = newValue;
							} else {
								if (slothlet.config.debug) {
									console.log(`[DEBUG] Fallback: Preserving already-materialized property ${key}`);
								}
							}
						}
					}

					parentAPI[parentKey] = finalMaterialized;
					materializedKeys.add(parentKey);
					if (slothlet.config.debug) {
						console.log(`[DEBUG] Fallback assignment succeeded for ${parentKey}`);
					}

					// Update child proxy references to point to the new materialized structure
					if (materialized && typeof materialized === "object") {
						for (const [childKey, childValue] of Object.entries(materialized)) {
							if (childValue && typeof childValue._updateParentAPI === "function") {
								if (slothlet.config.debug) {
									console.log(`[DEBUG] Updating child proxy ${childKey} to point to new parent via fallback`);
								}
								childValue._updateParentAPI(materialized, childKey);
							}
						}
					}

					// Update the bound API with the materialized value
					// Remove depth restriction - update boundapi for any level
					if (slothlet && typeof slothlet.updateBoundApiProperty === "function") {
						// For top-level properties (depth 1) or when we're in a nested structure,
						// we need to find the top-level key to update
						const topLevelKey = currentPath[0] || parentKey;
						if (currentDepth === 1) {
							// Direct top-level replacement
							slothlet.updateBoundApiProperty(parentKey, materialized);
						} else if (currentDepth > 1 && topLevelKey) {
							// For nested items, get the top-level API and update it
							const topLevelApi = slothlet.api;
							if (topLevelApi && topLevelApi[topLevelKey]) {
								if (slothlet.config.debug) {
									console.log(`[DEBUG] Updating nested item ${topLevelKey} in boundapi via fallback`);
								}
								slothlet.updateBoundApiProperty(topLevelKey, topLevelApi[topLevelKey]);
							}
						}
					}
				} catch (assignError) {
					console.warn(`[slothlet] Both replacement methods failed for ${parentKey}:`, assignError.message);
				}
			}
		} else if (materializedKeys.has(parentKey)) {
			if (slothlet.config.debug) {
				console.log(`[DEBUG] Skipping ${parentKey} - already materialized`);
			}
		}
	}
	const proxy = new Proxy(proxyTarget, {
		get(target, prop) {
			// If materialized, completely delegate to the materialized result
			if (materialized) {
				return materialized[prop];
			}

			// Handle function properties and symbols
			if (typeof prop === "symbol" || prop in target) {
				return target[prop];
			}

			if (typeof prop !== "string" || prop === "then") {
				return undefined;
			}

			// Materialize and return the property as a wrapped promise
			return wrapPromise(ensureMaterialized().then((mat) => mat[prop]));
		},

		apply(target, thisArg, args) {
			// If already materialized, delegate directly to materialized result
			if (materialized) {
				if (typeof materialized === "function") {
					return materialized.apply(thisArg, args);
				}
				// Look for a callable in the materialized structure
				for (const [key, value] of Object.entries(materialized)) {
					if (typeof value === "function") {
						return value.apply(thisArg, args);
					}
				}
				throw new Error(`slothlet: No callable function found in ${currentPath.join(".")}`);
			}

			return materializeAndCall(args);
		},

		ownKeys(target) {
			if (materialized) {
				// Return keys of both the materialized object and the function target
				const materializedKeys = Reflect.ownKeys(materialized);
				const targetKeys = Reflect.ownKeys(target);
				const allKeys = [...new Set([...targetKeys, ...materializedKeys])];
				return allKeys;
			}
			return Reflect.ownKeys(target);
		},

		getOwnPropertyDescriptor(target, prop) {
			if (materialized) {
				// First check materialized object
				const materializedDesc = Reflect.getOwnPropertyDescriptor(materialized, prop);
				if (materializedDesc) {
					return { ...materializedDesc, configurable: true, enumerable: true };
				}
				// Then check target function
				const targetDesc = Reflect.getOwnPropertyDescriptor(target, prop);
				if (targetDesc) {
					return targetDesc;
				}
				return undefined;
			}
			return Reflect.getOwnPropertyDescriptor(target, prop);
		},

		has(target, prop) {
			if (materialized) {
				return prop in materialized;
			}
			return prop in target;
		}
	});

	return proxy;
}

/**
 * Wraps a promise to enable synchronous property access patterns.
 * @param {Promise<any>} promise - Promise to wrap
 * @returns {Proxy} Proxy that handles property access on the promise result
 * @private
 * @internal
 * @example
 * const wrapped = wrapPromise(somePromise);
 * const result = wrapped.someProperty; // Returns another wrapped promise
 */
function wrapPromise(promise) {
	return new Proxy(
		function () {
			throw new Error("slothlet: wrapped promise called directly");
		},
		{
			get(target, prop) {
				if (typeof prop === "symbol" || prop in target) {
					return target[prop];
				}

				if (prop === "then" || prop === "catch" || prop === "finally") {
					return undefined;
				}

				return wrapPromise(
					promise.then((result) => {
						if (result && typeof result === "object") {
							return result[prop];
						}
						return undefined;
					})
				);
			},

			apply(target, thisArg, args) {
				return promise.then((fn) => {
					if (typeof fn === "function") {
						return fn.apply(thisArg, args);
					}
					throw new Error(`slothlet: property is not a function`);
				});
			}
		}
	);
}
