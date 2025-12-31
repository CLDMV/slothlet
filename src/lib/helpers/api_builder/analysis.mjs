/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /src/lib/helpers/api_builder/analysis.mjs
 *	@Date: 2025-12-29 00:00:00 -08:00
 *	@Author: Nate Hyson <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Hyson <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2025-12-29 00:00:00 -08:00
 *	-----
 *	@Copyright: Copyright (c) 2013-2025 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Module analysis and processing functions for slothlet API builder.
 * @module @cldmv/slothlet/src/lib/helpers/api_builder/analysis
 * @internal
 * @package
 *
 * @description
 * This module handles the first phase of API building: analyzing and processing individual modules.
 * It provides functions to load, inspect, and transform modules into API-ready structures.
 *
 * Core responsibilities:
 * - Module loading with CJS/ESM handling
 * - Default and named export detection
 * - Function vs object export classification
 * - Module processing and transformation
 * - Directory structure analysis
 */

import fs from "node:fs/promises";
import path from "node:path";
import { types as utilTypes } from "node:util";
import { pathToFileURL } from "node:url";
import { multidefault_analyzeModules } from "@cldmv/slothlet/helpers/multidefault";
import { setActiveInstance } from "@cldmv/slothlet/helpers/instance-manager";

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Helper function to check if a value is likely serializable without calling JSON.stringify.
 * Used by toJSON methods to avoid expensive serialization attempts on complex objects.
 *
 * @internal
 * @private
 * @param {*} val - The value to check for serializability
 * @returns {boolean} True if the value is likely serializable, false otherwise
 */
export function isLikelySerializable(val) {
	const type = typeof val;

	// Primitive types are always serializable
	if (type !== "object" || val === null) {
		return type === "string" || type === "number" || type === "boolean" || type === "undefined";
	}

	// Common serializable object types
	return (
		Array.isArray(val) || val instanceof Date || val instanceof RegExp || val?.constructor === Object || typeof val.toJSON === "function" // Objects with custom toJSON method
	);
}

// ============================================================================
// MODULE ANALYSIS FUNCTIONS
// ============================================================================

/**
 * Analyzes a module and returns processing decisions that both eager and lazy modes can use.
 * This centralizes the module loading logic from _loadSingleModule while allowing each mode
 * to handle the results according to their strategy (immediate materialization vs proxy creation).
 *
 * @function analyzeModule
 * @internal
 * @package
 * @param {string} modulePath - Absolute path to the module file
 * @param {object} options - Analysis options
 * @param {boolean} [options.debug=false] - Enable debug logging
 * @param {object} [options.instance] - Slothlet instance for accessing config and methods
 * @returns {Promise<{
 *   rawModule: object,
 *   processedModule: object,
 *   isFunction: boolean,
 *   hasDefault: boolean,
 *   isCjs: boolean,
 *   exports: Array<[string, any]>,
 *   defaultExportType: 'function'|'object'|null,
 *   shouldWrapAsCallable: boolean,
 *   namedExports: object,
 *   metadata: object
 * }>} Module analysis results
 *
 * @example
 * // Analyze a module file
 * const analysis = await analyzeModule("./api/math.mjs", { instance });
 * // Eager mode: use analysis.processedModule directly
 * // Lazy mode: create proxy based on analysis.isFunction, analysis.exports, etc.
 */
export async function analyzeModule(modulePath, options = {}) {
	const { debug = false, instance = null } = options;

	const moduleUrl = pathToFileURL(modulePath).href;

	// Add instance-based cache busting only for live bindings runtime
	let importUrl = moduleUrl;
	if (instance && instance.instanceId) {
		const runtimeType = instance.config?.runtime || "async";

		// Only add URL parameters for live bindings runtime (needs stack trace detection)
		if (runtimeType === "live") {
			const separator = moduleUrl.includes("?") ? "&" : "?";
			importUrl = `${moduleUrl}${separator}slothlet_instance=${instance.instanceId}`;
			importUrl = `${importUrl}&slothlet_runtime=${runtimeType}`;

			// Set active instance for live bindings runtime
			setActiveInstance(instance.instanceId);
		}
		// AsyncLocalStorage runtime doesn't need URL parameters or setActiveInstance
		// It uses als.run() for context isolation
	}

	const rawModule = await import(importUrl);

	// CJS unwrapping detection and handling
	let processedModule = rawModule;
	const isCjs = modulePath.endsWith(".cjs") && "default" in rawModule;

	if (isCjs) {
		processedModule = rawModule.default;
	}

	const hasDefault = !!processedModule.default;
	const isFunction = typeof processedModule.default === "function";
	const exports = Object.entries(processedModule);
	const namedExports = Object.entries(processedModule).filter(([k]) => k !== "default");

	// Determine default export type
	let defaultExportType = null;
	if (hasDefault) {
		defaultExportType = typeof processedModule.default === "function" ? "function" : "object";
	}

	// Determine if should wrap as callable (object with callable default)
	let shouldWrapAsCallable = false;

	// Check if module has default export that's an object with callable default
	if (
		hasDefault &&
		typeof processedModule.default === "object" &&
		processedModule.default !== null &&
		typeof processedModule.default.default === "function"
	) {
		shouldWrapAsCallable = true;
	}

	// Check if any named export is an object with callable default
	if (!shouldWrapAsCallable) {
		for (const [_, exportValue] of namedExports) {
			if (typeof exportValue === "object" && exportValue !== null && typeof exportValue.default === "function") {
				shouldWrapAsCallable = true;
				break;
			}
		}
	}

	if (debug) {
		console.log(`[DEBUG] analyzeModule(${path.basename(modulePath)}):`, {
			isCjs,
			hasDefault,
			isFunction,
			defaultExportType,
			shouldWrapAsCallable,
			namedExportsCount: namedExports.length
		});
	}

	return {
		rawModule,
		processedModule,
		isFunction,
		hasDefault,
		isCjs,
		exports,
		defaultExportType,
		shouldWrapAsCallable,
		namedExports,
		metadata: { modulePath }
	};
}

/**
 * Processes module analysis results into a final module object using slothlet's established patterns.
 * This centralizes the processing logic while allowing both modes to apply the results differently.
 *
 * @function processModuleFromAnalysis
 * @internal
 * @package
 * @param {object} analysis - Results from analyzeModule
 * @param {object} options - Processing options
 * @param {object} [options.instance] - Slothlet instance for accessing _toapiPathKey method
 * @param {boolean} [options.debug=false] - Enable debug logging
 * @returns {object} Processed module ready for API integration
 *
 * @example
 * // Process analyzed module
 * const analysis = await analyzeModule(modulePath, { instance });
 * const processed = processModuleFromAnalysis(analysis, { instance });
 * // Both modes can use 'processed' but integrate it differently
 */
export function processModuleFromAnalysis(analysis, options = {}) {
	const { instance, debug = false } = options;
	const { processedModule, isFunction, hasDefault, shouldWrapAsCallable, namedExports } = analysis;

	if (!instance) {
		throw new Error("processModuleFromAnalysis requires instance parameter for _toapiPathKey access");
	}

	// Handle function default exports - extract and enhance the function
	if (isFunction) {
		let fn = processedModule.default;

		// Mark as default export for multi-default processing
		if (hasDefault) {
			try {
				Object.defineProperty(fn, "__slothletDefault", {
					value: true,
					writable: false,
					enumerable: false,
					configurable: true
				});
			} catch {
				// Ignore if property cannot be set
			}
		}

		// Attach named exports as properties
		for (const [exportName, exportValue] of Object.entries(processedModule)) {
			if (exportName !== "default") {
				fn[instance._toapiPathKey(exportName)] = exportValue;
			}
		}
		return fn;
	}

	// Handle callable objects (objects with callable default)
	if (shouldWrapAsCallable) {
		let callableObject = null;
		let objectName = "callable";

		// Check if it's a default export with callable default
		if (
			hasDefault &&
			typeof processedModule.default === "object" &&
			processedModule.default !== null &&
			typeof processedModule.default.default === "function"
		) {
			callableObject = processedModule.default;
			objectName = processedModule.default.name || (namedExports[0] && namedExports[0][0] !== "default" ? namedExports[0][0] : "callable");
		} else {
			// Check for named export with callable default
			for (const [exportName, exportValue] of namedExports) {
				if (typeof exportValue === "object" && exportValue !== null && typeof exportValue.default === "function") {
					callableObject = exportValue;
					objectName = exportName;
					break;
				}
			}
		}

		if (callableObject) {
			const callableApi = {
				[objectName]: function (...args) {
					return callableObject.default.apply(callableObject, args);
				}
			}[objectName];

			// Attach methods from callable object
			for (const [methodName, method] of Object.entries(callableObject)) {
				if (methodName === "default") continue;
				callableApi[methodName] = method;
			}

			if (debug) {
				console.log(`[DEBUG] Created callable wrapper for ${objectName}`);
			}

			return callableApi;
		}
	}

	// Handle object default exports
	if (hasDefault && typeof processedModule.default === "object") {
		const obj = processedModule.default; // Use original default object directly, don't copy

		// Check if we have named exports to add
		const namedExportsToAdd = Object.entries(processedModule).filter(
			([exportName, exportValue]) => exportName !== "default" && exportValue !== obj
		);

		if (namedExportsToAdd.length > 0) {
			// Use Node.js built-in util.types.isProxy() for reliable proxy detection
			// Available in Node.js 10+ (we require 16+)
			const isCustomProxy = utilTypes?.isProxy?.(obj) ?? false;

			if (isCustomProxy) {
				// For Proxy objects, add named exports directly to the proxy
				// Since we confirmed the proxy allows property assignment, this should work
				for (const [exportName, exportValue] of namedExportsToAdd) {
					const apiKey = instance._toapiPathKey(exportName);
					obj[apiKey] = exportValue;
				}

				// For proxy objects, return a structure that preserves the default export pattern
				// This ensures flattening code can find obj.default correctly
				const proxyWithStructure = obj; // The proxy with named exports already attached

				// NECESSARY CODE SMELL: Add self-reference as default for flattening logic compatibility.
				// This circular reference (.default = self) is required for backward compatibility with existing
				// flattening logic that expects obj.default to exist and point to the root object when processing
				// Proxy objects with named exports. The flattening code checks for obj.default to determine
				// if it should flatten the object structure or preserve the proxy wrapper.
				//
				// FUNCTIONAL REQUIREMENT: Without this circular reference, flattening breaks in scenarios like:
				// - LGTVControllers proxy: api.devices.lg() works but api.devices.lg.getStatus() fails
				// - Mixed export modules: Functions with attached methods lose their callable nature
				// - Auto-flattening: math/math.mjs becomes api.math.math instead of api.math
				// The flattening logic needs obj.default === obj to detect proxy wrappers vs plain objects.
				//
				// ALTERNATIVES CONSIDERED:
				// 1. Update flattening logic to not require .default - would be a breaking change
				// 2. Use a symbol instead of .default - would break existing consumer code expecting .default
				// 3. Clone object without circular reference - would break Proxy behavior and method binding
				//
				// WARNING: This creates a circular reference, which breaks JSON.stringify() without mitigation.
				// The custom toJSON method below prevents serialization errors by excluding the circular .default.
				proxyWithStructure.default = obj; // Circular reference for backward compatibility

				// Prevent JSON.stringify from failing due to circular reference
				if (!proxyWithStructure.toJSON) {
					Object.defineProperty(proxyWithStructure, "toJSON", {
						value: function () {
							// Return a structured object with proxy properties (excluding .default to avoid circular reference)
							const serializable = {};

							// Use Reflect.ownKeys to capture all properties on Proxy objects (enumerable and non-enumerable)
							for (const key of Reflect.ownKeys(this)) {
								// Only process enumerable string properties (skip symbols and non-enumerable properties)
								if (typeof key !== "string") continue;

								const descriptor = Reflect.getOwnPropertyDescriptor(this, key);
								if (!descriptor || !descriptor.enumerable) continue;

								if (key === "default") {
									// Skip circular reference
									continue;
								}

								const value = this[key];
								if (typeof value === "function") {
									serializable[key] = "[Function]";
								} else if (isLikelySerializable(value)) {
									// For likely serializable values, include them directly
									serializable[key] = value;
								} else {
									// For complex objects, test serialization only when needed
									try {
										JSON.stringify(value);
										serializable[key] = value;
									} catch {
										serializable[key] = "[Non-serializable value]";
									}
								}
							}

							// Add metadata about the circular reference
							serializable._slothlet_proxy_info = {
								type: "proxy",
								circular_reference: "Property .default points to this object (excluded from serialization)",
								warning: "This is a slothlet API proxy with circular .default reference"
							};
							return serializable;
						},
						writable: false,
						enumerable: false,
						configurable: true
					});
				}

				// Also add named exports as top-level properties for compatibility
				for (const [exportName, exportValue] of namedExportsToAdd) {
					const apiKey = instance._toapiPathKey(exportName);
					if (!(apiKey in proxyWithStructure)) {
						proxyWithStructure[apiKey] = exportValue;
					}
				}

				return proxyWithStructure;
			} else {
				// For regular objects, add named exports directly (existing behavior)
				for (const [exportName, exportValue] of namedExportsToAdd) {
					obj[instance._toapiPathKey(exportName)] = exportValue;
				}

				return obj;
			}
		}

		return obj;
	}

	// Handle named exports only
	if (namedExports.length > 0) {
		const apiExport = {};
		for (const [exportName, exportValue] of namedExports) {
			apiExport[instance._toapiPathKey(exportName)] = exportValue;
		}
		return apiExport;
	}

	// Should not reach here if module has exports
	throw new Error(`No valid exports found in processed module`);
}

/**
 * Analyzes a directory and returns structural decisions that both eager and lazy modes can use.
 * This provides the decision-making logic for directory handling without implementing the actual
 * loading strategy (allowing lazy mode to create proxies while eager mode materializes).
 *
 * @function analyzeDirectoryStructure
 * @internal
 * @package
 * @param {string} categoryPath - Absolute path to the directory
 * @param {object} options - Analysis options
 * @param {object} options.instance - Slothlet instance for accessing config and methods
 * @param {number} [options.currentDepth=0] - Current traversal depth
 * @param {number} [options.maxDepth=Infinity] - Maximum traversal depth
 * @param {boolean} [options.debug=false] - Enable debug logging
 * @returns {Promise<{
 *   isSingleFile: boolean,
 *   shouldAutoFlatten: boolean,
 *   categoryName: string,
 *   moduleFiles: Array<import('fs').Dirent>,
 *   subDirs: Array<import('fs').Dirent>,
 *   multiDefaultAnalysis: object,
 *   processingStrategy: 'single-file'|'multi-file'|'empty',
 *   flatteningHints: object
 * }>} Directory structure analysis
 *
 * @example
 * // Analyze directory structure
 * const analysis = await analyzeDirectoryStructure(categoryPath, { instance });
 * if (analysis.isSingleFile) {
 *   // Both modes: handle as single file (but differently)
 * } else {
 *   // Both modes: handle as multi-file (but differently)
 * }
 */
export async function analyzeDirectoryStructure(categoryPath, options = {}) {
	const { instance, currentDepth = 0, debug = false } = options;

	if (!instance || typeof instance._toapiPathKey !== "function") {
		throw new Error("analyzeDirectoryStructure requires a valid slothlet instance");
	}

	const files = await fs.readdir(categoryPath, { withFileTypes: true });
	const moduleFiles = files.filter((f) => instance._shouldIncludeFile(f));
	const categoryName = instance._toapiPathKey(path.basename(categoryPath));
	const subDirs = files.filter((e) => e.isDirectory() && !e.name.startsWith("."));

	// Determine processing strategy
	let processingStrategy;
	if (moduleFiles.length === 0) {
		processingStrategy = "empty";
	} else if (moduleFiles.length === 1 && subDirs.length === 0) {
		processingStrategy = "single-file";
	} else {
		processingStrategy = "multi-file";
	}

	// For multi-file cases, analyze multi-default context
	let multiDefaultAnalysis = null;
	if (processingStrategy === "multi-file") {
		multiDefaultAnalysis = await multidefault_analyzeModules(moduleFiles, categoryPath, { debug, instance });
	}

	// Determine auto-flattening hints
	const flatteningHints = {
		shouldFlattenSingleFile: processingStrategy === "single-file",
		shouldFlattenToParent: currentDepth > 0 && processingStrategy === "single-file",
		hasMultipleDefaults: multiDefaultAnalysis?.hasMultipleDefaultExports || false,
		selfReferentialFiles: multiDefaultAnalysis?.selfReferentialFiles || new Set()
	};

	if (debug) {
		console.log(`[DEBUG] analyzeDirectoryStructure(${categoryName}):`, {
			processingStrategy,
			moduleCount: moduleFiles.length,
			subDirCount: subDirs.length,
			hasMultipleDefaults: flatteningHints.hasMultipleDefaults
		});
	}

	return {
		isSingleFile: processingStrategy === "single-file",
		shouldAutoFlatten: flatteningHints.shouldFlattenSingleFile,
		categoryName,
		moduleFiles,
		subDirs,
		multiDefaultAnalysis,
		processingStrategy,
		flatteningHints
	};
}

/**
 * Returns category building decisions and processed modules that both eager and lazy modes can use.
 * This provides all the structural information needed to build a category but lets each mode
 * implement the actual building strategy (materialization vs proxy creation).
 *
 * @function getCategoryBuildingDecisions
 * @internal
 * @package
 * @param {string} categoryPath - Absolute path to the directory
 * @param {object} options - Building options
 * @param {object} options.instance - Slothlet instance for accessing config and methods
 * @param {number} [options.currentDepth=0] - Current traversal depth
 * @param {number} [options.maxDepth=Infinity] - Maximum traversal depth
 * @param {boolean} [options.debug=false] - Enable debug logging
 * @returns {Promise<{
 *   processingStrategy: 'single-file'|'multi-file'|'empty',
 *   categoryName: string,
 *   shouldFlattenSingle: boolean,
 *   processedModules: Array<{file: import('fs').Dirent, moduleName: string, processedModule: any, flattening: object}>,
 *   subDirectories: Array<{dirEntry: import('fs').Dirent, apiPathKey: string}>,
 *   multiDefaultAnalysis: object,
 *   flatteningDecisions: object,
 *   upwardFlatteningCandidate: {shouldFlatten: boolean, apiPathKey: string}
 * }>} Complete category building information
 *
 * @example
 * // Get category building decisions
 * const decisions = await getCategoryBuildingDecisions(categoryPath, { instance });
 * if (decisions.processingStrategy === "single-file") {
 *   // Both modes: handle single file differently
 *   // Eager: return decisions.processedModules[0].processedModule
 *   // Lazy: create proxy based on decisions.processedModules[0].flattening
 * }
 */
export async function getCategoryBuildingDecisions(categoryPath, options = {}) {
	const { instance, currentDepth = 0, maxDepth = Infinity, debug = false } = options;

	if (!instance) {
		throw new Error("getCategoryBuildingDecisions requires a valid slothlet instance");
	}

	const analysis = await analyzeDirectoryStructure(categoryPath, { instance, currentDepth, maxDepth, debug });
	const { processingStrategy, categoryName, moduleFiles, subDirs, multiDefaultAnalysis } = analysis;

	const processedModules = [];
	const subDirectories = [];

	// Process module files and get their decisions
	if (processingStrategy !== "empty") {
		for (const file of moduleFiles) {
			const moduleExt = path.extname(file.name);
			const moduleName = instance._toapiPathKey(path.basename(file.name, moduleExt));
			const modulePath = path.join(categoryPath, file.name);

			// Load and process the module using centralized logic
			const analysis = await analyzeModule(modulePath, {
				debug,
				instance
			});
			const processedModule = processModuleFromAnalysis(analysis, {
				debug,
				instance
			});

			// Get flattening decisions for this module
			const flatteningInfo = {
				shouldFlatten: false,
				apiPathKey: moduleName,
				reason: "default"
			};

			// Apply flattening rules similar to existing _buildCategory logic
			if (processingStrategy === "single-file") {
				// Single file cases - various flattening scenarios
				const functionNameMatchesFolder =
					typeof processedModule === "function" &&
					processedModule.name &&
					processedModule.name.toLowerCase() === categoryName.toLowerCase();

				const moduleNameMatchesCategory = moduleName === categoryName && typeof processedModule === "function" && currentDepth > 0;

				if (functionNameMatchesFolder && currentDepth > 0) {
					flatteningInfo.shouldFlatten = true;
					flatteningInfo.apiPathKey = processedModule.name;
					flatteningInfo.reason = "function name matches folder";
				} else if (moduleNameMatchesCategory) {
					flatteningInfo.shouldFlatten = true;
					flatteningInfo.apiPathKey = categoryName;
					flatteningInfo.reason = "module name matches category";
				}
			}

			processedModules.push({
				file,
				moduleName,
				processedModule,
				flattening: flatteningInfo
			});
		}
	}

	// Process subdirectories
	for (const subDirEntry of subDirs) {
		if (currentDepth < maxDepth) {
			const apiPathKey = instance._toapiPathKey(subDirEntry.name);
			subDirectories.push({ dirEntry: subDirEntry, apiPathKey });
		}
	}

	// Determine upward flattening candidate
	const upwardFlatteningCandidate = { shouldFlatten: false, apiPathKey: null };
	if (processedModules.length === 1 && subDirectories.length === 0) {
		const single = processedModules[0];
		if (single.moduleName === categoryName) {
			upwardFlatteningCandidate.shouldFlatten = true;
			upwardFlatteningCandidate.apiPathKey = single.moduleName;
		}
	}

	if (debug) {
		console.log(`[DEBUG] getCategoryBuildingDecisions(${categoryName}):`, {
			processingStrategy,
			moduleCount: processedModules.length,
			subDirCount: subDirectories.length,
			upwardFlattening: upwardFlatteningCandidate.shouldFlatten
		});
	}

	return {
		processingStrategy,
		categoryName,
		shouldFlattenSingle: processingStrategy === "single-file",
		processedModules,
		subDirectories,
		multiDefaultAnalysis,
		flatteningDecisions: analysis.flatteningHints,
		upwardFlatteningCandidate
	};
}
