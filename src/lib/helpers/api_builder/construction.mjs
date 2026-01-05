/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /src/lib/helpers/api_builder/construction.mjs
 *	@Date: 2025-12-29 00:00:00 -08:00
 *	@Author: Nate Hyson <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Hyson <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2025-12-30 08:28:05 -08:00 (1767112085)
 *	-----
 *	@Copyright: Copyright (c) 2013-2025 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview API construction and assembly functions for slothlet.
 * @module @cldmv/slothlet/src/lib/helpers/api_builder/construction
 * @internal
 * @package
 *
 * @description
 * This module handles the final phase of API building: constructing and assembling
 * the complete API structure based on decisions from the analysis and decision modules.
 *
 * Core responsibilities:
 * - Category structure building (buildCategoryStructure)
 * - Root API assembly (buildRootAPI)
 * - Recursive directory traversal
 * - Final API composition and function/object resolution
 */

import fs from "node:fs/promises";
import path from "node:path";
import { types as utilTypes } from "node:util";
import { sanitizePathName } from "@cldmv/slothlet/helpers/sanitize";
import { multidefault_analyzeModules } from "@cldmv/slothlet/helpers/multidefault";
import { analyzeModule, processModuleFromAnalysis } from "@cldmv/slothlet/helpers/api_builder/analysis";
import { processModuleForAPI, buildCategoryDecisions } from "@cldmv/slothlet/helpers/api_builder/decisions";

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Converts a filename or folder name to camelCase for API property.
 * Extracted from slothlet._toapiPathKey for use in API building functions.
 *
 * @function toapiPathKey
 * @internal
 * @package
 * @param {string} name - The name to convert
 * @param {object} [sanitizeConfig={}] - Sanitization configuration
 * @returns {string} The camelCase version of the name
 *
 * @example
 * toapiPathKey('root-math') // 'rootMath'
 * toapiPathKey('auto-ip') // 'autoIP' (with proper config)
 */
export function toapiPathKey(name, sanitizeConfig = {}) {
	return sanitizePathName(name, sanitizeConfig);
}

/**
 * Filters out files that should not be loaded by slothlet.
 * Extracted from slothlet._shouldIncludeFile for use in API building functions.
 *
 * @function shouldIncludeFile
 * @internal
 * @package
 * @param {object} entry - The directory entry to check
 * @returns {boolean} True if the file should be included, false if it should be excluded
 *
 * @example
 * const entries = await fs.readdir(dir, { withFileTypes: true });
 * const moduleFiles = entries.filter(e => shouldIncludeFile(e));
 */
export function shouldIncludeFile(entry) {
	// Only include actual files
	if (!entry.isFile()) return false;
	// Only include JavaScript module files
	if (!(entry.name.endsWith(".mjs") || entry.name.endsWith(".cjs") || entry.name.endsWith(".js"))) return false;
	// Exclude hidden files (starting with .)
	if (entry.name.startsWith(".")) return false;
	// Exclude slothlet JSDoc files (starting with __slothlet_)
	if (entry.name.startsWith("__slothlet_")) return false;
	return true;
}

// ============================================================================
// CATEGORY CONSTRUCTION FUNCTIONS
// ============================================================================

/**
 * Comprehensive category/directory building function that replaces _buildCategory.
 * Handles complete directory structure processing with all flattening rules.
 *
 * @function buildCategoryStructure
 * @internal
 * @package
 * @async
 * @param {string} categoryPath - Absolute path to the category directory
 * @param {object} options - Building options
 * @param {number} [options.currentDepth=0] - Current recursion depth
 * @param {number} [options.maxDepth=Infinity] - Maximum recursion depth
 * @param {string} [options.mode="eager"] - Loading mode ("eager" or "lazy")
 * @param {function} [options.subdirHandler] - Custom subdirectory handler for lazy mode
 * @param {object} options.instance - Slothlet instance for access to helper methods
 * @returns {Promise<object>} Complete category API structure
 *
 * @description
 * Complete directory structure building pipeline that handles:
 * - Single-file vs multi-file directory processing
 * - Auto-flattening decisions for single files matching directory names
 * - Multi-default export detection and processing
 * - Self-referential export handling
 * - Recursive subdirectory traversal with depth control
 * - Function name preference over sanitized names
 * - All established slothlet flattening rules and conventions
 *
 * @example
 * // Internal usage - build complete category structure
 * const categoryApi = await buildCategoryStructure("/path/to/category", {
 *   currentDepth: 0, maxDepth: 3, mode: "eager", instance: slothletInstance
 * });
 */
export async function buildCategoryStructure(categoryPath, options = {}) {
	const { currentDepth = 0, maxDepth = Infinity, mode = "eager", subdirHandler, instance } = options;

	if (!instance || typeof instance._toapiPathKey !== "function") {
		throw new Error("buildCategoryStructure requires a valid slothlet instance");
	}

	// Use centralized category building decisions
	const decisions = await buildCategoryDecisions(categoryPath, {
		currentDepth,
		maxDepth,
		mode,
		subdirHandler,
		instance,
		existingApi: options.existingApi
	});

	// SINGLE FILE CASE
	if (decisions.type === "single-file") {
		const { singleFile } = decisions;
		const { mod, moduleName } = singleFile;

		// Handle flattening based on centralized decisions
		if (decisions.shouldFlatten) {
			switch (decisions.flattenType) {
				case "function-folder-match":
				case "default-function":
					try {
						Object.defineProperty(mod, "name", { value: decisions.preferredName, configurable: true });
					} catch {
						// ignore
					}
					return mod;

				case "default-export-flatten":
					// Return the module directly - it already has the default object contents spread with named exports
					return mod;

				case "object-auto-flatten":
					// Return the contents of the named export directly (flatten it)
					return mod[decisions.preferredName];

				case "parent-level-flatten": {
					// Return an object with the export name as key, promoting it to parent level
					const exportValue = mod[Object.keys(mod).filter((k) => k !== "default")[0]];
					return { [decisions.preferredName]: exportValue };
				}

				case "filename-folder-match-flatten":
					// Return the module directly to avoid double nesting (e.g., nest/nest.mjs -> nest.alpha, not nest.nest.alpha)
					return mod;
			}
		}

		// Handle preferred name without flattening
		if (decisions.preferredName && decisions.preferredName !== moduleName) {
			return { [decisions.preferredName]: mod };
		}

		// Default case: return as namespace
		return { [moduleName]: mod };
	}

	// MULTI-FILE CASE
	const categoryModules = {};
	const { categoryName, processedModules, subdirectoryDecisions } = decisions;

	// Process each module based on centralized decisions
	for (const moduleDecision of processedModules) {
		const { moduleName, mod, type, apiPathKey, shouldFlatten, flattenType, specialHandling, processedExports } = moduleDecision;
		// Handle different module types based on centralized decisions
		if (specialHandling === "category-merge") {
			// Module filename matches category name - merge logic
			if (Object.prototype.hasOwnProperty.call(mod, categoryName) && typeof mod[categoryName] === "object" && mod[categoryName] !== null) {
				Object.assign(categoryModules, mod[categoryName]);
				for (const [key, value] of Object.entries(mod)) {
					if (key !== categoryName) categoryModules[instance._toapiPathKey(key)] = value;
				}
			} else {
				Object.assign(categoryModules, mod);
			}
		} else if (type === "function") {
			// Function handling with appropriate naming
			if (specialHandling === "multi-default-filename") {
				try {
					Object.defineProperty(mod, "name", { value: moduleName, configurable: true });
				} catch {
					// ignore
				}
				categoryModules[moduleName] = mod;
			} else if (specialHandling === "prefer-function-name") {
				categoryModules[apiPathKey] = mod;
			} else {
				// Standard function processing
				categoryModules[apiPathKey] = mod;
			}
		} else if (type === "self-referential") {
			// Self-referential case: use the named export directly to avoid nesting
			categoryModules[moduleName] = mod[moduleName] || mod;
		} else if (type === "object") {
			// Object/named exports handling
			if (specialHandling === "preferred-export-names") {
				Object.assign(categoryModules, processedExports);
			} else if (shouldFlatten) {
				switch (flattenType) {
					case "single-default-object": {
						// Flatten the default export and merge named exports
						// Special handling for Proxy objects: don't use spread operator which breaks custom handlers
						let flattened;

						// Check if mod.default is likely a Proxy with custom behavior
						const defaultExport = mod.default;
						const hasNamedExports = Object.keys(mod).some((k) => k !== "default");

						if (hasNamedExports && defaultExport && typeof defaultExport === "object") {
							// Use Node.js built-in proxy detection for reliable detection
							const isProxy = utilTypes?.isProxy?.(defaultExport) ?? false;

							if (isProxy) {
								// Preserve Proxy object and add named exports
								flattened = defaultExport;
								let assignmentFailed = false;
								// Use Map from the start to avoid array-to-Map conversion overhead
								const failedMap = new Map();

								// Try to add named exports directly to the proxy
								for (const [key, value] of Object.entries(mod)) {
									if (key !== "default") {
										try {
											flattened[key] = value;
										} catch (e) {
											// Track assignment failure
											assignmentFailed = true;
											failedMap.set(key, value);
											if (instance.config?.debug) {
												console.warn(
													`Could not assign '${key}' to proxy object in module '${moduleName}' at '${categoryPath}':`,
													e.message
												);
											}
										}
									}
								}

								// If any assignments failed, create a wrapper proxy to ensure named exports are accessible
								if (assignmentFailed) {
									// DOUBLE-PROXY LAYER JUSTIFICATION:
									// This creates a wrapper around the original proxy because direct property assignment
									// failed (e.g., LGTVControllers proxy with custom setters that reject certain properties).
									// The double-proxy approach is necessary because:
									// 1. We can't modify the original proxy's behavior without breaking its intended functionality
									// 2. Some proxies (like LGTVControllers) have custom get/set handlers that conflict with property assignment
									// 3. The wrapper provides a "fallback layer" that ensures API completeness while preserving original proxy behavior
									// 4. The wrapper is only created when assignment to the original proxy fails,
									//    keeping it on an exceptional path rather than the common case
									const originalProxy = flattened;
									flattened = new Proxy(originalProxy, {
										get(target, prop, receiver) {
											// Check failed assignments first
											if (failedMap.has(prop)) return failedMap.get(prop);

											// Fallback to original proxy
											return Reflect.get(target, prop, receiver);
										},
										has(target, prop) {
											// Include failed assignments in has checks
											if (failedMap.has(prop)) return true;
											return Reflect.has(target, prop);
										},
										ownKeys(target) {
											const originalKeys = Reflect.ownKeys(target);
											const failedKeys = Array.from(failedMap.keys());
											return [...new Set([...originalKeys, ...failedKeys])];
										},
										getOwnPropertyDescriptor(target, prop) {
											if (failedMap.has(prop)) {
												return { configurable: true, enumerable: true, value: failedMap.get(prop) };
											}
											return Reflect.getOwnPropertyDescriptor(target, prop);
										}
									});
								}
							} else {
								// Regular object, use spread operator
								flattened = { ...defaultExport };
								for (const [key, value] of Object.entries(mod)) {
									if (key !== "default") {
										flattened[key] = value;
									}
								}
							}
						} else {
							// No named exports or not an object, use as-is
							flattened = defaultExport;
						}

						categoryModules[apiPathKey] = flattened;
						break;
					}
					case "multi-default-no-default": {
						// Multi-default context: flatten modules WITHOUT default exports to category
						const moduleKeys = Object.keys(mod).filter((k) => k !== "default");
						for (const key of moduleKeys) {
							categoryModules[key] = mod[key];
						}
						break;
					}
					case "single-named-export-match":
						// Auto-flatten: module exports single named export matching filename
						categoryModules[apiPathKey] = mod[apiPathKey];
						break;
					case "category-name-match-flatten": {
						// Auto-flatten: module filename matches folder name and has no default → flatten to category
						const moduleKeys = Object.keys(mod).filter((k) => k !== "default");
						for (const key of moduleKeys) {
							categoryModules[key] = mod[key];
						}
						break;
					}
				}
			} else {
				// Standard object export
				categoryModules[apiPathKey] = mod;
			}
		}
	}

	// SUBDIRECTORIES - handle based on centralized decisions
	for (const subDirDecision of subdirectoryDecisions) {
		if (subDirDecision.shouldRecurse) {
			const { name, path: subDirPath, apiPathKey } = subDirDecision;
			let subModule;

			if (mode === "lazy" && typeof subdirHandler === "function") {
				subModule = subdirHandler({
					subDirEntry: { name },
					subDirPath,
					key: apiPathKey,
					categoryModules,
					currentDepth,
					maxDepth
				});
			} else {
				subModule = await buildCategoryStructure(subDirPath, {
					currentDepth: currentDepth + 1,
					maxDepth,
					mode: "eager",
					instance
				});
			}

			// Check if returned module is a function with name matching folder (case-insensitive)
			// If so, use the function name instead of the sanitized folder name
			if (
				typeof subModule === "function" &&
				subModule.name &&
				subModule.name.toLowerCase() === apiPathKey.toLowerCase() &&
				subModule.name !== apiPathKey
			) {
				// Use the original function name as the key
				categoryModules[subModule.name] = subModule;
			} else {
				categoryModules[apiPathKey] = subModule;
			}
		}
	}

	// CALLABLE NAMESPACE PATTERN
	// Check if any module has a default function - only apply if there's exactly ONE default function
	let defaultFunctions = [];
	for (const moduleDecision of processedModules) {
		const { mod, type } = moduleDecision;
		if (type === "function" && typeof mod === "function") {
			defaultFunctions.push({ mod, moduleDecision });
		}
	}

	// Apply callable namespace pattern only if there's exactly one default function
	// AND there are no other modules in the category (to avoid circular references)
	// Multiple modules should use standard namespace pattern
	if (defaultFunctions.length === 1 && Object.keys(categoryModules).length === 1) {
		const categoryDefaultFunction = defaultFunctions[0].mod;

		// Set the function name to match the category if needed
		if (categoryDefaultFunction.name !== categoryName) {
			try {
				Object.defineProperty(categoryDefaultFunction, "name", { value: categoryName, configurable: true });
			} catch {
				// ignore
			}
		}

		return categoryDefaultFunction;
	}

	// UPWARD FLATTENING
	const keys = Object.keys(categoryModules);
	if (keys.length === 1) {
		const singleKey = keys[0];
		if (singleKey === categoryName) {
			const single = categoryModules[singleKey];
			if (typeof single === "function") {
				if (single.name !== categoryName) {
					try {
						Object.defineProperty(single, "name", { value: categoryName, configurable: true });
					} catch {
						// ignore
					}
				}
				return single;
			} else if (single && typeof single === "object" && !Array.isArray(single)) {
				return single;
			}
		}
	}

	return categoryModules;
}

// ============================================================================
// ROOT API CONSTRUCTION FUNCTIONS
// ============================================================================

/**
 * Comprehensive root API building function that replaces eager/lazy create methods.
 * Handles complete root-level API construction with mode-specific optimizations.
 *
 * @function buildRootAPI
 * @internal
 * @package
 * @async
 * @param {string} dir - Root directory path to build API from
 * @param {object} options - Building options
 * @param {boolean} [options.lazy=false] - Whether to use lazy loading mode
 * @param {number} [options.maxDepth=Infinity] - Maximum recursion depth
 * @param {object} options.instance - Slothlet instance for access to helper methods
 * @returns {Promise<object|function>} Complete root API (object or function with properties)
 *
 * @description
 * Complete root API building pipeline that handles:
 * - Root-level module processing with multi-default detection
 * - Root contributor pattern (default function becomes callable API)
 * - Named export merging and flattening decisions
 * - Recursive directory structure building via buildCategoryStructure
 * - Mode-specific optimizations (eager vs lazy)
 * - All established slothlet API construction patterns
 *
 * @example
 * // Internal usage - build complete root API
 * const rootApi = await buildRootAPI("/path/to/api", {
 *   lazy: false, maxDepth: 3, instance: slothletInstance
 * });
 */
export async function buildRootAPI(dir, options = {}) {
	const { lazy = false, maxDepth = Infinity, instance } = options;

	if (!instance || typeof instance._shouldIncludeFile !== "function" || typeof instance._loadCategory !== "function") {
		throw new Error("buildRootAPI requires a valid slothlet instance");
	}

	const debug = instance.config?.debug || false;

	if (debug) {
		console.log(`[DEBUG] buildRootAPI called with dir: ${dir}, lazy: ${lazy}, maxDepth: ${maxDepth}`);
	}

	const entries = await fs.readdir(dir, { withFileTypes: true });
	const api = {};
	let rootDefaultFunction = null;

	// ROOT LEVEL MODULE PROCESSING
	const moduleFiles = entries.filter((e) => instance._shouldIncludeFile(e));

	if (moduleFiles.length > 0) {
		// Multi-default detection for root files
		const analysis = await multidefault_analyzeModules(moduleFiles, dir, { debug, instance });
		const { hasMultipleDefaultExports, selfReferentialFiles } = analysis;

		// Process each root-level module
		for (const entry of moduleFiles) {
			const ext = path.extname(entry.name);
			const fileName = path.basename(entry.name, ext);
			const apiPathKey = instance._toapiPathKey(fileName);

			const analysis = await analyzeModule(path.join(dir, entry.name), {
				debug,
				instance
			});
			const mod = processModuleFromAnalysis(analysis, {
				debug,
				instance
			});

			// Use centralized API builder for root module processing
			processModuleForAPI({
				mod,
				fileName,
				apiPathKey,
				hasMultipleDefaultExports,
				isSelfReferential: selfReferentialFiles.has(fileName),
				api,
				getRootDefault: () => rootDefaultFunction,
				setRootDefault: (fn) => {
					rootDefaultFunction = fn;
				},
				context: {
					debug,
					mode: "root",
					totalModules: moduleFiles.length
				}
			});
		}
	}

	// DIRECTORY STRUCTURE PROCESSING
	for (const entry of entries) {
		if (entry.isDirectory() && !entry.name.startsWith(".")) {
			const categoryPath = path.join(dir, entry.name);

			if (lazy) {
				// Lazy mode: use same centralized category builder with lazy mode and subdirHandler
				api[instance._toapiPathKey(entry.name)] = await buildCategoryStructure(categoryPath, {
					currentDepth: 1,
					maxDepth,
					mode: "lazy",
					subdirHandler: (ctx) => {
						// Create lazy proxy for subdirectories in lazy mode
						return instance._loadCategory(ctx.subDirPath, ctx.currentDepth, ctx.maxDepth);
					},
					instance
				});
			} else {
				// Eager mode: use centralized category builder
				api[instance._toapiPathKey(entry.name)] = await buildCategoryStructure(categoryPath, {
					currentDepth: 1,
					maxDepth,
					mode: "eager",
					instance
				});
			}
		}
	}

	// FINAL API ASSEMBLY
	let finalApi;
	if (debug) {
		console.log(`[DEBUG] Final assembly: rootDefaultFunction=${!!rootDefaultFunction}`);
		console.log(`[DEBUG] API object keys before final assembly:`, Object.keys(api));
	}

	if (rootDefaultFunction) {
		// Root contributor pattern: merge API properties into the default function
		Object.assign(rootDefaultFunction, api);
		finalApi = rootDefaultFunction;

		if (debug) {
			console.log(`[DEBUG] Applied root contributor pattern - final API is function`);
		}
	} else {
		// Standard object API
		finalApi = api;

		if (debug) {
			console.log(`[DEBUG] No root function - final API is object`);
		}
	}

	return finalApi;
}
