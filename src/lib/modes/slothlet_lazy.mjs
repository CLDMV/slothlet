/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /src/lib/modes/slothlet_lazy.mjs
 *	@Date: 2025-09-09 13:22:38 -07:00 (1757449358)
 *	@Author: Nate Hyson <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Hyson <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2025-10-27 09:23:23 -07:00 (1761582203)
 *	-----
 *	@Copyright: Copyright (c) 2013-2025 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Slothlet Lazy Mode - Look-ahead materialization with copy-left preservation. Internal file (not exported in package.json).
 * @module @cldmv/slothlet.modes.lazy
 * @memberof module:@cldmv/slothlet.modes
 * @internal
 * @package
 *
 * @description
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
 * - Proxy-based deferred loading with intelligent materialization
 * - Copy-left preservation of materialized functions during updates
 * - Recursive directory traversal with configurable depth limits
 * - On-demand module processing triggered by property access
 *
 * @example
 *  UPON CREATION: API structure before any calls (lazy proxies)
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
 *    advanced: [Function: lazyFolder_advanced],
 *    exportDefault: [Function: lazyFolder_exportDefault],
 *    funcmod: [Function: lazyFolder_funcmod],
 *    math: [Function: lazyFolder_math],
 *    multi: [Function: lazyFolder_multi],
 *    multi_func: [Function: lazyFolder_multi_func],
 *    nested: [Function: lazyFolder_nested],
 *    objectDefaultMethod: [Function: lazyFolder_objectDefaultMethod],
 *    string: [Function: lazyFolder_string],
 *    task: [Function: lazyFolder_task],
 *    util: [Function: lazyFolder_util],
 *    md5: [Function: md5],
 *    describe: [Function (anonymous)],
 *    shutdown: [Function: bound shutdown] AsyncFunction,
 *    __ctx: {
 *      self: [Circular *1],
 *      context: {},
 *      reference: { md5: [Function: md5] }
 *    }
 *  }
 *
 * @example
 *  AFTER ALL CALLS: API structure after materialization (fully loaded)
 *
 *  [Function: bound] {
 *    _impl: [Function (anonymous)],
 *    __ctx: {
 *      self: [Circular *1],
 *      context: {},
 *      reference: { md5: [Function: md5] }
 *    },
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
 *    shutdown: [Function: bound shutdown] AsyncFunction
 *  }
 *
 */
import fs from "node:fs/promises";
import { readdirSync } from "node:fs";
import path from "node:path";
import { runWithCtx } from "@cldmv/slothlet/runtime";
import { processModuleForAPI } from "@cldmv/slothlet/helpers/api_builder";

/**
 * @function create
 * @internal
 * @package
 * @async
 * @alias module:@cldmv/slothlet.modes.lazy.create
 * @memberof module:@cldmv/slothlet.modes.lazy
 * @param {string} dir - Root directory
 * @param {number} [maxDepth=Infinity] - Maximum depth to traverse
 * @param {number} [currentDepth=0] - Current depth (for internal recursion only)
 * @returns {Promise<function|object>} Root API object or function (if default export)
 * @throws {Error} When module loading or directory traversal fails
 *
 * @description
 * Creates a lazy API structure. Root-level files are loaded immediately (mirrors eager).
 * Directories become lazy proxies. Nested directories remain lazy after materialization
 * via _buildCategory recursion with subdirHandler.
 *
 * @example
 * // Internal usage - called by slothlet core
 * const api = await create('./api_test', 3, 0);
 * // Returns: { math: [Function: lazyFolder_math], ... } (lazy proxies)
 *
 * @example
 * // Root-level processing with function exports
 * const api = await create('./api_test');
 * // If root has default function: api becomes that function with properties
 * // Otherwise: api is object with lazy proxy properties
 */
export async function create(dir, maxDepth = Infinity, currentDepth = 0) {
	const instance = this; // bound slothlet instance
	const entries = await fs.readdir(dir, { withFileTypes: true });
	let api = {};
	let rootDefaultFn = null;

	// Load root-level files eagerly (same behavior as eager mode)
	// NEW: Detect multiple default exports for multi-default handling
	const moduleFiles = entries.filter((e) => instance._shouldIncludeFile(e));
	const defaultExportFiles = [];

	// Use shared multi-default detection utility
	const { multidefault_analyzeModules } = await import("@cldmv/slothlet/helpers/multidefault");
	const analysis = await multidefault_analyzeModules(moduleFiles, dir, instance.config.debug);

	const { totalDefaultExports, hasMultipleDefaultExports, selfReferentialFiles, defaultExportFiles: analysisDefaults } = analysis;

	// Convert analysis results to match existing structure
	defaultExportFiles.length = 0; // Clear existing array
	for (const { fileName } of analysisDefaults) {
		const entry = moduleFiles.find((f) => path.basename(f.name, path.extname(f.name)) === fileName);
		if (entry) {
			const mod = await instance._loadSingleModule(path.join(dir, entry.name));
			defaultExportFiles.push({ entry, fileName, mod });
		}
	}

	if (instance.config.debug) {
		console.log(`[DEBUG] Lazy mode: Using shared multidefault utility results`);
		console.log(`[DEBUG]   - totalDefaultExports: ${totalDefaultExports}`);
		console.log(`[DEBUG]   - hasMultipleDefaultExports: ${hasMultipleDefaultExports}`);
		console.log(`[DEBUG]   - selfReferentialFiles: ${Array.from(selfReferentialFiles)}`);
	}

	// Second pass: process files with multi-default awareness
	const processedModuleCache = new Map(); // Cache processed modules to avoid duplicate loads

	for (const entry of moduleFiles) {
		const ext = path.extname(entry.name);
		const fileName = path.basename(entry.name, ext);
		const apiPathKey = instance._toapiPathKey(fileName);

		// Check if we already loaded this module during first pass (for non-self-referential defaults)
		let mod = null;
		const existingDefault = defaultExportFiles.find((def) => def.fileName === fileName);
		if (existingDefault) {
			mod = existingDefault.mod; // Reuse already loaded module
		} else {
			// Load processed module only if not already loaded
			mod = await instance._loadSingleModule(path.join(dir, entry.name));
			processedModuleCache.set(entry.name, mod);
		}

		// Check if this file was identified as self-referential in the first pass
		const isSelfReferential = selfReferentialFiles.has(fileName);

		// Use centralized API builder for module processing
		processModuleForAPI({
			mod,
			fileName,
			apiPathKey,
			hasMultipleDefaultExports,
			isSelfReferential,
			api,
			getRootDefault: () => rootDefaultFn,
			setRootDefault: (fn) => {
				rootDefaultFn = fn;
			},
			context: {
				debug: instance.config.debug,
				mode: "root",
				totalModules: moduleFiles.length
			}
		});
	}

	// Convert api to callable function if root default function present
	if (rootDefaultFn) {
		Object.assign(rootDefaultFn, api);
		api = rootDefaultFn;
	}

	// Attach directory proxies
	for (const entry of entries) {
		if (entry.isDirectory() && !entry.name.startsWith(".") && currentDepth < maxDepth) {
			const key = instance._toapiPathKey(entry.name);
			const subDirPath = path.join(dir, entry.name);
			const parent = api;
			const depth = 1; // top-level directory depth for bubble-up

			// Check if the folder is empty and add empty object immediately (Rule 5)
			try {
				const subEntries = readdirSync(subDirPath, { withFileTypes: true });
				const hasFiles = subEntries.some(
					(subEntry) =>
						subEntry.isFile() &&
						!subEntry.name.startsWith(".") &&
						(subEntry.name.endsWith(".mjs") || subEntry.name.endsWith(".cjs") || subEntry.name.endsWith(".js"))
				);
				const hasSubdirs = subEntries.some((subEntry) => subEntry.isDirectory() && !subEntry.name.startsWith("."));

				// If no modules and no subdirectories, add empty object immediately
				if (!hasFiles && !hasSubdirs) {
					if (instance?.config?.debug) {
						console.log(`[lazy][debug] empty folder detected during traversal: ${subDirPath} -> adding {}`);
					}
					parent[key] = {};
					continue; // Skip creating lazy proxy
				}
			} catch (error) {
				// If we can't read the directory, fall back to lazy proxy
				if (instance?.config?.debug) {
					console.log(`[lazy][debug] error reading directory ${subDirPath}: ${error.message}, creating lazy proxy`);
				}
			}

			const proxy = createFolderProxy({
				subDirPath,
				key,
				parent,
				instance,
				depth,
				maxDepth,
				pathParts: [key]
			});
			parent[key] = proxy;
		}
	}

	return api;
}

/**
 * @function replacePlaceholder
 * @internal
 * @private
 * @param {function|object} parent - Parent container
 * @param {string} key - Property name
 * @param {function} placeholder - The original proxy function
 * @param {any} value - Materialized category (object or function)
 * @param {object} instance - Active slothlet instance
 * @param {number} depth - Depth (1 => top-level)
 *
 * @description
 * Replace the proxy placeholder in the parent with the materialized value.
 * Only fires if the parent still holds the original placeholder reference.
 * This gives strict copy-left (never overwrites user-modified materialized objects)
 * while ensuring once accessed a path matches eager shape (no lingering proxy).
 *
 * @example
 * // Replace a lazy proxy with materialized value
 * replacePlaceholder(parent, 'math', proxyFunction, materializedMath, instance, 1);
 *
 * @example
 * // Function name preference handling
 * // If materialized function has preferred name, use it instead of folder name
 * replacePlaceholder(parent, 'auto-ip', proxy, autoIPFunction, instance, 1);
 * // Result: parent.autoIP = autoIPFunction (not parent['auto-ip'])
 */
function replacePlaceholder(parent, key, placeholder, value, instance, depth) {
	if (!parent || !key) return;
	if (parent[key] !== placeholder) return; // parent changed meanwhile – respect existing

	// Check if materialized value is a function with a preferred name
	let finalKey = key;
	if (typeof value === "function" && value.name && value.name.toLowerCase() === key.toLowerCase() && value.name !== key) {
		// Use the function's actual name instead of sanitized folder name
		finalKey = value.name;

		// Remove the old key if it exists and is different
		if (finalKey !== key && key in parent) {
			try {
				delete parent[key];
			} catch {
				// ignore
			}
		}
	}

	try {
		Object.defineProperty(parent, finalKey, { value, writable: true, enumerable: true, configurable: true });
	} catch {
		parent[finalKey] = value; // fallback
	}
	if (instance?.config?.debug) {
		console.log(`[lazy][materialize] replaced ${key}${finalKey !== key ? ` -> ${finalKey}` : ""} (${typeof value})`);
	}
	if (depth === 1 && typeof instance?.updateBoundApiProperty === "function") {
		instance.updateBoundApiProperty(finalKey, parent[finalKey]);
	}
}

/**
 * @function createFolderProxy
 * @internal
 * @private
 * @param {object} opts - Options
 * @param {string} opts.subDirPath - Absolute folder path
 * @param {string} opts.key - API key
 * @param {object} opts.parent - Parent API object
 * @param {object} opts.instance - Slothlet instance
 * @param {number} opts.depth - Current depth (parent depth + 1)
 * @param {number} opts.maxDepth - Max traversal depth
 * @param {string[]} opts.pathParts - Path parts for debug
 * @returns {function} Proxy function placeholder
 * @throws {Error} When materialization fails
 *
 * @description
 * Creates a lazy folder proxy that materializes on first property access or call.
 *
 * @example
 * // Create a lazy proxy for a folder
 * const proxy = createFolderProxy({
 *   subDirPath: '/project/api/math',
 *   key: 'math',
 *   parent: apiObject,
 *   instance: slothletInstance,
 *   depth: 1,
 *   maxDepth: 3,
 *   pathParts: ['math']
 * });
 *
 * @example
 * // Proxy materializes on access
 * const result = await proxy.add(2, 3); // Materializes math folder and calls add
 * console.log(result); // 5
 */
function createFolderProxy({ subDirPath, key, parent, instance, depth, maxDepth, pathParts }) {
	let materialized = null;
	let inFlight = null;

	/**
	 * @function _materialize
	 * @internal
	 * @private
	 * @async
	 * @returns {Promise<any>} Materialized value
	 *
	 * @description
	 * Materializes this folder (idempotent, cached).
	 *
	 * @example
	 * // Materialize a lazy folder
	 * const materializedValue = await _materialize();
	 */
	async function _materialize() {
		if (materialized) return materialized;
		if (inFlight) return inFlight;
		// lazy_materializeCategory - async arrow function to preserve lexical this
		/**
		 * @function lazy_materializeCategory
		 * @internal
		 * @private
		 * @async
		 * @returns {Promise<any>} Materialized category value
		 *
		 * @description
		 * Async arrow function to preserve lexical this during materialization.
		 *
		 * @example
		 * // Materialize a category with proper context
		 * const value = await lazy_materializeCategory();
		 */
		const lazy_materializeCategory = async () => {
			const value = await instance._buildCategory(subDirPath, {
				currentDepth: depth,
				maxDepth,
				mode: "lazy",
				subdirHandler: ({ subDirPath: nestedPath, key: nestedKey, categoryModules, currentDepth: cd, maxDepth: md }) =>
					createFolderProxy({
						subDirPath: nestedPath,
						key: nestedKey,
						parent: categoryModules,
						instance,
						depth: cd + 1,
						maxDepth: md,
						pathParts: [...pathParts, nestedKey]
					})
			});
			materialized = value;
			if (instance?.config?.debug) {
				try {
					const infoKeys = materialized && typeof materialized === "object" ? Object.keys(materialized) : [];
					const todayType = materialized && materialized.today ? typeof materialized.today : "n/a";
					console.log(
						`[lazy][debug] materialized key='${key}' path='${subDirPath}' type=${typeof materialized} keys=${JSON.stringify(
							infoKeys
						)} todayType=${todayType}`
					);
				} catch {
					// ignore
				}
			}
			// Replace placeholder now that folder accessed
			replacePlaceholder(parent, key, placeholder, materialized, instance, depth);
			// Targeted instrumentation for debugging special single-file folder cases like nested/date
			if (instance.config.debug) {
				try {
					const type = typeof materialized;
					const keys = type === "object" && materialized ? Object.keys(materialized) : [];
					console.log(
						`[lazy][debug] materialized '${pathParts.join("/")}' -> type=${type} keys=${JSON.stringify(keys)} parentHas=${
							parent[key] === materialized
						}`
					);
				} catch {
					// ignore
				}
			}
			placeholder.__materialized = materialized;
			return materialized;
		};
		inFlight = lazy_materializeCategory();
		try {
			return await inFlight;
		} finally {
			inFlight = null;
		}
	}

	/**
	 * @function lazy_invoke
	 * @internal
	 * @private
	 * @async
	 * @param {any} thisArg - this context for function calls
	 * @param {...any} args - Invocation args
	 * @returns {Promise<any>} Result
	 *
	 * @description
	 * Core callable; if materialized to function returns its invocation result.
	 * For objects (like flattened single-file folders), returns the object directly.
	 *
	 * @example
	 * // Invoke a lazy proxy that materializes to a function
	 * const result = await lazy_invoke(this, 2, 3);
	 *
	 * @example
	 * // Invoke a lazy proxy that materializes to an object
	 * const obj = await lazy_invoke(this); // Returns the materialized object
	 */
	async function lazy_invoke(thisArg, ...args) {
		const value = await _materialize();
		if (typeof value === "function") {
			// Get the ALS context from the instance
			const ctx = instance.boundapi?.__ctx;
			if (ctx) {
				return runWithCtx(ctx, value, thisArg, args);
			} else {
				return value.apply(thisArg, args);
			}
		}
		// For objects (like date folder -> { today: fn }), return the object directly
		// This handles the double rule: folder name = file name = export name
		return value;
	}

	/**
	 * @function lazy_lazyTarget
	 * @internal
	 * @private
	 * @param {...any} args - Arguments passed to the function
	 * @returns {Promise<any>} Result of lazy_invoke
	 *
	 * @description
	 * Placeholder function (identity for proxy target).
	 *
	 * @example
	 * // Target function for proxy
	 * const result = lazy_lazyTarget(arg1, arg2);
	 */
	// Placeholder function (identity for proxy target)
	function lazy_lazyTarget(...args) {
		return lazy_invoke(this, ...args);
	}
	// Tag state (minimal)
	Object.defineProperty(lazy_lazyTarget, "__materialized", { value: null, writable: true, enumerable: false, configurable: true });
	// Store underlying absolute path for opportunistic single-file detection
	Object.defineProperty(lazy_lazyTarget, "__slothletPath", { value: subDirPath, enumerable: false, configurable: true });
	// Make _materialize configurable & writable so proxy descriptor invariants remain valid
	Object.defineProperty(lazy_lazyTarget, "_materialize", { value: _materialize, enumerable: false, configurable: true, writable: true });

	// Assign a helpful name
	try {
		Object.defineProperty(lazy_lazyTarget, "name", { value: `lazyFolder_${key}`, configurable: true });
	} catch {
		// ignore
	}

	const placeholder = new Proxy(lazy_lazyTarget, {
		apply(_t, thisArg, args) {
			return lazy_invoke(thisArg, ...args);
		},
		get(_t, prop, _) {
			if (prop === "__materialized") return materialized;
			if (prop === "_materialize") return _materialize;
			if (prop === "then") return undefined; // avoid promise-like
			// If already materialized, return underlying value directly (supports chaining)
			if (materialized) {
				if (materialized && (typeof materialized === "object" || typeof materialized === "function")) return materialized[prop];
				return undefined;
			}
			// Ensure materialization started
			if (!inFlight) inFlight = _materialize();
			// For property access that might be used for synchronous traversal (like reduce),
			// we need to check if this folder will materialize to an object and return
			// a synchronous accessor to the property that resolves after materialization completes.
			// This maintains the synchronous property chain expected by debug scripts.
			return new Proxy(
				/**
				 * @function lazy_propertyAccessor
				 * @internal
				 * @private
				 * @param {...any} args - Arguments for property access
				 * @returns {Promise<any>} Property value after materialization
				 *
				 * @description
				 * Property accessor that resolves after materialization completes.
				 *
				 * @example
				 * // Access property on lazy proxy
				 * const result = await lazy_propertyAccessor(arg1, arg2);
				 */
				function lazy_propertyAccessor(...args) {
					return inFlight.then(
						/**
						 * @function lazy_handleResolvedValue
						 * @internal
						 * @private
						 * @param {any} resolved - The resolved materialized value
						 * @returns {any} Property value or function result
						 *
						 * @description
						 * Handles resolved value from materialization promise.
						 *
						 * @example
						 * // Handle resolved materialized value
						 * const result = lazy_handleResolvedValue(materializedObject);
						 */
						function lazy_handleResolvedValue(resolved) {
							const value = resolved ? resolved[prop] : undefined;
							if (typeof value === "function") {
								// Get the ALS context from the instance
								const ctx = instance.boundapi?.__ctx;
								if (ctx) {
									return runWithCtx(ctx, value, this, args);
								} else {
									return value.apply(this, args);
								}
							}
							return value;
						}
					);
				},
				{
					// Make this look like the eventual property for synchronous access patterns
					get(target, subProp) {
						if (subProp === "name") return `lazy_${prop}`;
						if (subProp === "length") return 0;
						// For deeper property access, return another lazy accessor
						return new Proxy(
							/**
							 * @function lazy_deepPropertyAccessor
							 * @internal
							 * @private
							 * @returns {any} Deep property value or function result
							 *
							 * @description
							 * Deep property accessor for nested property chains.
							 *
							 * @example
							 * // Access nested property on lazy proxy
							 * const result = lazy_deepPropertyAccessor();
							 */ function lazy_deepPropertyAccessor() {},
							{
								apply(target, thisArg, args) {
									// Check if we have materialized value first, then handle promises
									if (materialized) {
										const value = materialized[prop];
										if (value && typeof value[subProp] === "function") {
											// Get the ALS context from the instance
											const ctx = instance.boundapi?.__ctx;
											if (ctx) {
												return runWithCtx(ctx, value[subProp], thisArg, args);
											} else {
												return value[subProp].apply(thisArg, args);
											}
										}
										return value ? value[subProp] : undefined;
									}

									// If not materialized, ensure we have a promise
									if (!inFlight) inFlight = _materialize();
									return inFlight.then(
										/**
										 * @function lazy_handleDeepResolvedValue
										 * @internal
										 * @private
										 * @param {any} resolved - The resolved materialized value
										 * @returns {any} Deep property value or function result
										 *
										 * @description
										 * Handles resolved value for deep property access.
										 *
										 * @example
										 * // Handle deep property resolution
										 * const result = lazy_handleDeepResolvedValue(materializedObject);
										 */
										function lazy_handleDeepResolvedValue(resolved) {
											const value = resolved ? resolved[prop] : undefined;
											if (value && typeof value[subProp] === "function") {
												// Get the ALS context from the instance
												const ctx = instance.boundapi?.__ctx;
												if (ctx) {
													return runWithCtx(ctx, value[subProp], thisArg, args);
												} else {
													return value[subProp].apply(thisArg, args);
												}
											}
											return value ? value[subProp] : undefined;
										}
									);
								}
							}
						);
					}
				}
			);
		},
		has(_t, prop) {
			if (materialized && (typeof materialized === "object" || typeof materialized === "function")) return prop in materialized;
			return false;
		},
		ownKeys() {
			const baseKeys = Reflect.ownKeys(lazy_lazyTarget); // include internal keys like _materialize
			if (!materialized) return baseKeys;
			if (typeof materialized === "object" || typeof materialized === "function") {
				const matKeys = Reflect.ownKeys(materialized);
				return Array.from(new Set([...baseKeys, ...matKeys]));
			}
			return baseKeys;
		},
		getOwnPropertyDescriptor(_t, prop) {
			if (prop === "_materialize") {
				// Return original target descriptor to satisfy proxy invariants
				return Reflect.getOwnPropertyDescriptor(lazy_lazyTarget, "_materialize");
			}
			if (prop === "__materialized") {
				return { configurable: true, enumerable: false, writable: true, value: materialized };
			}
			if (prop === "prototype") {
				// Delegate to original target's prototype descriptor to avoid conflicts
				return Object.getOwnPropertyDescriptor(lazy_lazyTarget, "prototype");
			}
			if (materialized && (typeof materialized === "object" || typeof materialized === "function")) {
				const d = Object.getOwnPropertyDescriptor(materialized, prop);
				if (d) return { ...d, configurable: true };
			}
			// Fallback to target descriptor
			const td = Object.getOwnPropertyDescriptor(lazy_lazyTarget, prop);
			if (td) return { ...td, configurable: true };
			return undefined;
		}
	});

	return placeholder;
}
