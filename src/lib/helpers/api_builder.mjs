/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /src/lib/helpers/api_builder.mjs
 *	@Date: 2025-10-27 10:18:09 -07:00 (1761585489)
 *	@Author: Nate Hyson <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Hyson <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2025-10-27 11:12:34 -07:00 (1761588754)
 *	-----
 *	@Copyright: Copyright (c) 2013-2025 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Centralized API decision-making system for slothlet. Internal file (not exported in package.json).
 * @module @cldmv/slothlet/src/lib/helpers/api_builder
 * @internal
 * @package
 *
 * @description
 * This module provides centralized DECISION-MAKING functions that return data structures, flags, and metadata
 * that both eager and lazy modes can use to implement their specific loading strategies while maintaining
 * consistent API structuring logic.
 *
 * Core Philosophy: Return DECISIONS not IMPLEMENTATIONS
 * - Module processing decisions: How modules should be processed (CJS unwrapping, function handling, etc.)
 * - Structure decisions: What should be flattened, merged, auto-flattened, etc.
 * - Naming decisions: Preferred names, sanitization, function name preferences
 * - Directory decisions: How folders should be handled, what contains multiple defaults, etc.
 *
 * This allows eager mode to materialize immediately while lazy mode creates proxies, but both use the
 * same underlying logic for determining API structure.
 *
 * @example
 * // Get module processing decisions
 * const moduleResult = await processModuleDecisions(modulePath, { instance });
 * // Both modes use moduleResult.processedModule but apply differently
 *
 * @example
 * // Get directory structure decisions
 * const dirDecisions = await analyzeDirectoryStructure(categoryPath, { instance });
 * // Eager mode materializes, lazy mode creates proxies based on same decisions
 *
 * @example
 * // Get flattening decisions
 * const flattenInfo = getFlatteningDecisions(module, filename, folderName);
 * // Both modes apply same flattening rules
 */

import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

// ============================================================================
// CORE DECISION-MAKING FUNCTIONS - Used by both eager and lazy modes
// ============================================================================

/**
 * Analyzes a module and returns processing decisions that both eager and lazy modes can use.
 * This centralizes the module loading logic from _loadSingleModule while allowing each mode
 * to handle the results according to their strategy (immediate materialization vs proxy creation).
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
 * @example
 * // Analyze a module file
 * const analysis = await analyzeModule("./api/math.mjs", { instance });
 * // Eager mode: use analysis.processedModule directly
 * // Lazy mode: create proxy based on analysis.isFunction, analysis.exports, etc.
 */
export async function analyzeModule(modulePath, options = {}) {
	const { debug = false } = options;

	const moduleUrl = pathToFileURL(modulePath).href;
	const rawModule = await import(moduleUrl);

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
 * @function processModuleFromAnalysis
 * @internal
 * @package
 * @param {object} analysis - Results from analyzeModule
 * @param {object} options - Processing options
 * @param {object} [options.instance] - Slothlet instance for accessing _toapiPathKey method
 * @param {boolean} [options.debug=false] - Enable debug logging
 * @returns {object} Processed module ready for API integration
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

		// Add named exports to the original default object
		for (const [exportName, exportValue] of Object.entries(processedModule)) {
			if (exportName !== "default" && exportValue !== obj) {
				obj[instance._toapiPathKey(exportName)] = exportValue;
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
		const { multidefault_analyzeModules } = await import("@cldmv/slothlet/helpers/multidefault");
		multiDefaultAnalysis = await multidefault_analyzeModules(moduleFiles, categoryPath, debug);
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

/**
 * Auto-flattening decision logic that determines whether a module should be flattened
 * based on filename matching, export patterns, and context.
 * @function getFlatteningDecision
 * @internal
 * @package
 * @param {object} options - Flattening analysis options
 * @param {object} options.mod - The loaded module object
 * @param {string} options.fileName - Original filename (without extension)
 * @param {string} options.apiPathKey - Sanitized API key for the module
 * @param {boolean} options.hasMultipleDefaultExports - Whether multiple default exports exist in the container
 * @param {boolean} options.isSelfReferential - Whether this is a self-referential export
 * @param {boolean} [options.moduleHasDefault] - Whether this specific module has a default export.
 *   Should use originalAnalysis.hasDefault when available for accuracy, as !!mod.default
 *   may be inaccurate after processModuleFromAnalysis modifies module structure.
 * @param {string} [options.categoryName] - Container/category name for context
 * @param {number} [options.totalModules=1] - Total number of modules in container
 * @param {boolean} [options.debug=false] - Enable debug logging
 * @returns {{
 *   shouldFlatten: boolean,
 *   flattenToRoot: boolean,
 *   flattenToCategory: boolean,
 *   preserveAsNamespace: boolean,
 *   useAutoFlattening: boolean,
 *   reason: string
 * }} Flattening decision result
 *
 * @description
 * Determines flattening behavior based on slothlet's established rules:
 *
 * 1. Self-referential exports: Never flatten (preserve as namespace)
 * 2. Multi-default context: Flatten modules WITHOUT defaults, preserve WITH defaults
 * 3. Single named export matching filename: Auto-flatten to use export directly
 * 4. Filename matches container: Flatten contents to container level
 * 5. Traditional context: Preserve as namespace unless auto-flattening applies
 *
 * @example
 * // Internal usage - single named export matching filename
 * const decision = getFlatteningDecision({
 *   mod: { math: { add: fn, multiply: fn } },
 *   fileName: "math", apiPathKey: "math",
 *   hasMultipleDefaultExports: false, isSelfReferential: false
 * });
 * // Returns: { shouldFlatten: true, useAutoFlattening: true, reason: "auto-flatten single named export" }
 */
export function getFlatteningDecision(options) {
	const {
		mod,
		fileName,
		apiPathKey,
		hasMultipleDefaultExports,
		isSelfReferential,
		// Legacy fallback: !!mod.default may be inaccurate after processModuleFromAnalysis
		// attaches named exports to default exports. Callers should pass explicit analysis data.
		moduleHasDefault = !!mod.default,
		categoryName,
		totalModules = 1
	} = options;

	const moduleKeys = Object.keys(mod).filter((k) => k !== "default");

	// Rule 1: Self-referential exports never flatten
	if (isSelfReferential) {
		return {
			shouldFlatten: false,
			flattenToRoot: false,
			flattenToCategory: false,
			preserveAsNamespace: true,
			useAutoFlattening: false,
			reason: "self-referential export"
		};
	}

	// Rule 2: Multi-default context rules
	if (hasMultipleDefaultExports) {
		if (moduleHasDefault) {
			// Multi-default context: preserve modules WITH default exports as namespaces
			return {
				shouldFlatten: false,
				flattenToRoot: false,
				flattenToCategory: false,
				preserveAsNamespace: true,
				useAutoFlattening: false,
				reason: "multi-default context with default export"
			};
		} else {
			// Multi-default context: flatten modules WITHOUT default exports
			return {
				shouldFlatten: true,
				flattenToRoot: true,
				flattenToCategory: true,
				preserveAsNamespace: false,
				useAutoFlattening: false,
				reason: "multi-default context without default export"
			};
		}
	}

	// Rule 3: Auto-flattening - single named export matching filename
	if (moduleKeys.length === 1 && moduleKeys[0] === apiPathKey) {
		return {
			shouldFlatten: true,
			flattenToRoot: false,
			flattenToCategory: false,
			preserveAsNamespace: false,
			useAutoFlattening: true,
			reason: "auto-flatten single named export matching filename"
		};
	}

	// Rule 4: Filename matches container - flatten to container level
	if (categoryName && fileName === categoryName && !moduleHasDefault && moduleKeys.length > 0) {
		return {
			shouldFlatten: true,
			flattenToRoot: false,
			flattenToCategory: true,
			preserveAsNamespace: false,
			useAutoFlattening: false,
			reason: "filename matches container, flatten to category"
		};
	}

	// Rule 11: Single file context - flatten if no default and has named exports
	// COMMENTED OUT: This rule reduces API path flexibility. If users want flattening,
	// they can use other rules like naming the file to match the folder.
	// if (totalModules === 1 && !moduleHasDefault && moduleKeys.length > 0) {
	// 	return {
	// 		shouldFlatten: true,
	// 		flattenToRoot: true,
	// 		flattenToCategory: true,
	// 		preserveAsNamespace: false,
	// 		useAutoFlattening: false,
	// 		reason: "single file context with named exports only"
	// 	};
	// }

	// Default: preserve as namespace
	return {
		shouldFlatten: false,
		flattenToRoot: false,
		flattenToCategory: false,
		preserveAsNamespace: true,
		useAutoFlattening: false,
		reason: "traditional namespace preservation"
	};
}

/**
 * Processes a single module and applies it to the target API object based on flattening decisions.
 * @function processModuleForAPI
 * @internal
 * @package
 * @param {object} options - Module processing options
 * @param {object} options.mod - The loaded module object
 * @param {string} options.fileName - Original filename (without extension)
 * @param {string} options.apiPathKey - Sanitized API key for the module
 * @param {boolean} options.hasMultipleDefaultExports - Whether multiple default exports exist
 * @param {boolean} options.isSelfReferential - Whether this is a self-referential export
 * @param {object} options.api - Target API object to modify (could be root api or categoryModules)
 * @param {function} [options.getRootDefault] - Function to get current root default function
 * @param {function} [options.setRootDefault] - Function to set the root default function
 * @param {object} [options.context] - Processing context
 * @param {boolean} [options.context.debug=false] - Enable debug logging
 * @param {string} [options.context.mode="unknown"] - Processing mode (root, subfolder, eager, lazy)
 * @param {string} [options.context.categoryName] - Container/category name
 * @param {number} [options.context.totalModules=1] - Total modules in container
 * @returns {{
 *   processed: boolean,
 *   rootDefaultSet: boolean,
 *   flattened: boolean,
 *   namespaced: boolean,
 *   apiAssignments: Record<string, any>
 * }} Processing result
 *
 * @description
 * Unified module processing logic that handles:
 * 1. Function default exports (multi-default, self-referential, traditional root contributor)
 * 2. Object/named exports with flattening decisions
 * 3. Export merging and namespace assignments
 * 4. Function name preference logic
 * 5. Root default function management
 *
 * @example
 * // Internal usage for root-level processing
 * const result = processModuleForAPI({
 *   mod, fileName, apiPathKey, hasMultipleDefaultExports, isSelfReferential, api,
 *   getRootDefault: () => rootDefaultFunction,
 *   setRootDefault: (fn) => { rootDefaultFunction = fn; },
 *   context: { debug: true, mode: "root", totalModules: 3 },
 *   originalAnalysis: { hasDefault: true, namedExportsCount: 2 }
 * });
 */
export function processModuleForAPI(options) {
	const {
		mod,
		fileName,
		apiPathKey,
		hasMultipleDefaultExports,
		isSelfReferential,
		api,
		getRootDefault,
		setRootDefault,
		context = {},
		originalAnalysis = null
	} = options;

	const { debug = false, mode = "unknown", categoryName, totalModules = 1 } = context;

	let processed = false;
	let rootDefaultSet = false;
	let flattened = false;
	let namespaced = false;
	const apiAssignments = {};

	// Handle function default exports
	// For direct default function exports, the module IS the function (no .default property)
	// For named default exports, check mod.default
	const hasDefaultFunction = (mod && typeof mod.default === "function") || (mod && typeof mod === "function" && !mod.default);

	// Get the actual function reference
	const defaultFunction = mod?.default || (typeof mod === "function" ? mod : null);

	if (hasDefaultFunction) {
		processed = true;

		if (hasMultipleDefaultExports && !isSelfReferential) {
			// Multi-default case: use filename as API key
			apiAssignments[apiPathKey] = mod;
			namespaced = true;

			// Named exports are already attached as properties by processModuleFromAnalysis
			// No need to process them separately

			if (debug) {
				console.log(
					`[DEBUG] ${mode}: Multi-default function - using filename '${apiPathKey}' for default export, mod type: ${typeof mod}, function name: ${defaultFunction?.name}`
				);
			}
		} else if (isSelfReferential) {
			// Self-referential case: preserve as namespace (both named and default)
			apiAssignments[apiPathKey] = mod;
			namespaced = true;

			if (debug) {
				console.log(`[DEBUG] ${mode}: Self-referential function - preserving ${fileName} as namespace`);
			}
		} else {
			// Traditional single default case: becomes root API (if root context)
			if (debug) {
				console.log(
					`[DEBUG] ${mode}: Processing traditional default function: hasMultipleDefaultExports=${hasMultipleDefaultExports}, rootDefaultFunction=${!!(getRootDefault && getRootDefault())}`
				);
			}

			// Only set as root function if we're in root context and no root function exists
			if (mode === "root" && getRootDefault && setRootDefault && !hasMultipleDefaultExports && !getRootDefault()) {
				setRootDefault(defaultFunction);
				rootDefaultSet = true;

				if (debug) {
					console.log(`[DEBUG] ${mode}: Set rootDefaultFunction to:`, defaultFunction.name);
				}

				// Named exports are already attached as properties by processModuleFromAnalysis
				// No need to process them separately
			} else {
				// In subfolder context or when root already exists, treat as namespace
				apiAssignments[apiPathKey] = mod;
				namespaced = true;

				// Named exports are already attached as properties by processModuleFromAnalysis
				// No need to process them separately
			}
		}
	} else {
		// Handle non-function defaults and modules with only named exports
		processed = true;

		if (debug) {
			console.log(`[DEBUG] ${mode}: Processing non-function or named-only exports for ${fileName}`);
		}

		// Get flattening decision
		const decision = getFlatteningDecision({
			mod,
			fileName,
			apiPathKey,
			hasMultipleDefaultExports,
			isSelfReferential,
			// Prefer original analysis data when available for accurate flattening decisions.
			// Fallback to !!mod.default only for legacy callers (buildCategoryStructure) that
			// haven't been updated to use uniform _loadSingleModule approach yet.
			moduleHasDefault: originalAnalysis ? originalAnalysis.hasDefault : !!mod.default,
			categoryName,
			totalModules,
			debug
		});

		if (debug) {
			console.log(`[DEBUG] ${mode}: Flattening decision for ${fileName}: ${decision.reason}`);
		}

		if (decision.useAutoFlattening) {
			// Auto-flatten: use the single named export directly
			const moduleKeys = Object.keys(mod).filter((k) => k !== "default");
			apiAssignments[apiPathKey] = mod[moduleKeys[0]];
			flattened = true;
		} else if (decision.flattenToRoot || decision.flattenToCategory) {
			// Flatten: merge all named exports into target
			const moduleKeys = Object.keys(mod).filter((k) => k !== "default");
			for (const key of moduleKeys) {
				apiAssignments[key] = mod[key];
				if (debug) {
					console.log(`[DEBUG] ${mode}: Flattened ${fileName}.${key} to ${decision.flattenToRoot ? "root" : "category"}.${key}`);
				}
			}
			flattened = true;
		} else if (isSelfReferential) {
			// Self-referential case: use the named export directly to avoid nesting
			apiAssignments[apiPathKey] = mod[apiPathKey] || mod;
			namespaced = true;
		} else {
			// Traditional: preserve as namespace
			apiAssignments[apiPathKey] = mod;
			namespaced = true;
		}
	}

	// Apply assignments to target API
	for (const [key, value] of Object.entries(apiAssignments)) {
		if (debug && key && typeof value === "function" && value.name) {
			console.log(`[DEBUG] ${mode}: Assigning key '${key}' to function '${value.name}'`);
		}
		api[key] = value;
	}

	return {
		processed,
		rootDefaultSet,
		flattened,
		namespaced,
		apiAssignments
	};
}

/**
 * Handles function name preference logic for better API naming.
 * @function applyFunctionNamePreference
 * @internal
 * @package
 * @param {object} options - Name preference options
 * @param {object} options.mod - The loaded module object
 * @param {string} options.fileName - Original filename (without extension)
 * @param {string} options.apiPathKey - Sanitized API key
 * @param {object} options.categoryModules - Target category modules object
 * @param {function} options.toapiPathKey - Function to sanitize names to API keys
 * @param {boolean} [options.debug=false] - Enable debug logging
 * @returns {{hasPreferredName: boolean, preferredKey: string}} Name preference result
 *
 * @description
 * Implements slothlet's function name preference logic where the original function name
 * is preferred over the sanitized filename when they represent the same semantic meaning
 * but have different capitalization (e.g., autoIP vs autoIp, parseJSON vs parseJson).
 *
 * @example
 * // Internal usage in _buildCategory
 * const preference = applyFunctionNamePreference({
 *   mod: { autoIP: function autoIP() {} },
 *   fileName: "auto-ip", apiPathKey: "autoIp",
 *   categoryModules, toapiPathKey: this._toapiPathKey, debug: true
 * });
 * // Returns: { hasPreferredName: true, preferredKey: "autoIP" }
 */
export function applyFunctionNamePreference(options) {
	const { mod, fileName, apiPathKey, categoryModules, toapiPathKey, debug = false } = options;

	let hasPreferredName = false;
	let preferredKey = apiPathKey;

	// Check if any export function names should be preferred over sanitized filename
	for (const [, exportValue] of Object.entries(mod)) {
		if (typeof exportValue === "function" && exportValue.name) {
			const functionNameLower = exportValue.name.toLowerCase();
			const filenameLower = fileName.toLowerCase();

			// Check if function name semantically matches filename but has different casing
			if (functionNameLower === filenameLower && exportValue.name !== apiPathKey) {
				// Use original function name as the preferred API key
				preferredKey = exportValue.name;
				hasPreferredName = true;

				if (debug) {
					console.log(`[DEBUG] Using function name preference: ${exportValue.name} instead of ${apiPathKey} for ${fileName}`);
				}
				break;
			}

			// Also check if sanitized function name matches sanitized filename
			const sanitizedFunctionName = toapiPathKey(exportValue.name);
			if (sanitizedFunctionName.toLowerCase() === apiPathKey.toLowerCase() && exportValue.name !== apiPathKey) {
				preferredKey = exportValue.name;
				hasPreferredName = true;

				if (debug) {
					console.log(`[DEBUG] Using function name preference: ${exportValue.name} instead of ${apiPathKey} for ${fileName}`);
				}
				break;
			}
		}
	}

	if (hasPreferredName) {
		// Apply the preferred name
		categoryModules[preferredKey] = mod;
	}

	return { hasPreferredName, preferredKey };
}

/**
 * Comprehensive category/directory building function that replaces _buildCategory.
 * Handles complete directory structure processing with all flattening rules.
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

	if (!instance || typeof instance._toapiPathKey !== "function" || typeof instance._shouldIncludeFile !== "function") {
		throw new Error("buildCategoryStructure requires a valid slothlet instance");
	}

	const debug = instance.config?.debug || false;

	if (debug) {
		console.log(`[DEBUG] buildCategoryStructure called with path: ${categoryPath}, mode: ${mode}, depth: ${currentDepth}`);
	}

	const files = await fs.readdir(categoryPath, { withFileTypes: true });
	const moduleFiles = files.filter((f) => instance._shouldIncludeFile(f));
	const categoryName = instance._toapiPathKey(path.basename(categoryPath));
	const subDirs = files.filter((e) => e.isDirectory() && !e.name.startsWith("."));

	// SINGLE FILE CASE - Special flattening rules
	if (moduleFiles.length === 1 && subDirs.length === 0) {
		const moduleExt = path.extname(moduleFiles[0].name);
		const moduleName = instance._toapiPathKey(path.basename(moduleFiles[0].name, moduleExt));

		// Analyze the module using centralized function
		const analysis = await analyzeModule(path.join(categoryPath, moduleFiles[0].name), {
			debug,
			instance
		});

		// Process the analysis into final module
		const mod = processModuleFromAnalysis(analysis, { instance, debug });

		// Function name matching checks
		const functionNameMatchesFolder = typeof mod === "function" && mod.name && mod.name.toLowerCase() === categoryName.toLowerCase();

		const functionNameMatchesFilename =
			typeof mod === "function" &&
			mod.name &&
			instance._toapiPathKey(mod.name).toLowerCase() === instance._toapiPathKey(moduleName).toLowerCase() &&
			mod.name !== instance._toapiPathKey(moduleName);

		// Auto-flattening rules for single files

		// 0. CJS Default Export Flattening: Skip this rule - let loadAndProcessModule handle CJS defaults
		// The CJS unwrapping in loadAndProcessModule already spreads default objects properly

		// 1. Flatten if file matches folder name and exports a function (NOT for root-level)
		if (moduleName === categoryName && typeof mod === "function" && currentDepth > 0) {
			try {
				Object.defineProperty(mod, "name", { value: categoryName, configurable: true });
			} catch {
				// ignore
			}
			return mod;
		}

		// 2. Auto-flatten single-file folders where filename matches folder name and exports object (NOT for root-level)
		if (moduleName === categoryName && mod && typeof mod === "object" && !Array.isArray(mod) && currentDepth > 0) {
			if (debug) {
				console.log(`[DEBUG] Single-file auto-flattening: ${categoryName}/${moduleFiles[0].name} -> flatten object contents`);
			}

			// Check if module exports single named export matching filename, and flatten it
			const moduleKeys = Object.keys(mod).filter((k) => k !== "default");
			if (moduleKeys.length === 1 && moduleKeys[0] === moduleName) {
				return mod[moduleName]; // Return the contents of the named export directly
			}

			// CRITICAL: Check if this was originally a default export (ESM or CJS)
			// If filename matches folder name AND this object came from a default export, flatten it
			// This handles both ESM: "export default { multiply, divide }; export { getCalculatorName }"
			// And CJS: "module.exports = { default: { multiply, divide }, getCalculatorName }"
			// After processing, both become: { multiply, divide, getCalculatorName }
			// We detect this by checking if we have multiple exports (indicating spread default + named exports)
			if (moduleKeys.length > 1) {
				if (debug) {
					console.log(`[DEBUG] Default export flattening: ${categoryName}/${moduleFiles[0].name} -> flatten default object contents`);
				}
				return mod; // Return the spread object directly (default + named exports merged)
			}
			return mod;
		}

		// 3. Auto-flatten single-file folders to parent level (eliminate intermediate filename namespace)
		if (moduleFiles.length === 1 && currentDepth > 0 && mod && typeof mod === "object" && !Array.isArray(mod)) {
			const moduleKeys = Object.keys(mod).filter((k) => k !== "default");
			const fileName = moduleFiles[0].name.replace(/\.(mjs|cjs|js)$/, "");

			// Only flatten if filename is generic/meaningless
			const isGenericFilename = ["singlefile", "index", "main", "default"].includes(fileName.toLowerCase());

			// If single file has single export AND filename is generic, flatten to parent level
			if (moduleKeys.length === 1 && isGenericFilename) {
				if (debug) {
					console.log(
						`[DEBUG] Single-file parent-level auto-flattening: ${categoryName}/${moduleFiles[0].name} -> flatten to parent level`
					);
				}
				const exportValue = mod[moduleKeys[0]];
				return { [moduleKeys[0]]: exportValue }; // Promote export to parent level
			}
		}

		// 4. Flatten if function name matches folder name (case-insensitive) and prefer function name (NOT for root-level)
		if (functionNameMatchesFolder && currentDepth > 0) {
			try {
				Object.defineProperty(mod, "name", { value: mod.name, configurable: true });
			} catch {
				// ignore
			}
			return mod;
		}

		// 5. Use function name instead of sanitized filename when they match (case-insensitive)
		if (functionNameMatchesFilename) {
			return { [mod.name]: mod };
		}

		// 6. Flatten if this was a default function export (NOT for root-level)
		if (typeof mod === "function" && (!mod.name || mod.name === "default" || mod.__slothletDefault === true) && currentDepth > 0) {
			try {
				Object.defineProperty(mod, "name", { value: categoryName, configurable: true });
			} catch {
				// ignore
			}
			return mod;
		}

		// 7. Check for auto-flattening: if module has single named export matching filename, use it directly
		const moduleKeys = Object.keys(mod).filter((k) => k !== "default");
		if (moduleKeys.length === 1 && moduleKeys[0] === moduleName) {
			return mod[moduleName]; // Auto-flatten single named export
		}

		// Default: preserve as namespace
		return { [moduleName]: mod };
	}

	// MULTI-FILE CASE - Complex processing with multi-default handling
	const categoryModules = {};

	// Use shared multi-default detection utility
	const { multidefault_analyzeModules } = await import("@cldmv/slothlet/helpers/multidefault");
	const analysis = await multidefault_analyzeModules(moduleFiles, categoryPath, debug);
	const { totalDefaultExports, hasMultipleDefaultExports, selfReferentialFiles, defaultExportFiles: analysisDefaults } = analysis;

	// Convert analysis results to match existing structure
	const defaultExportFiles = [];
	for (const { fileName } of analysisDefaults) {
		const file = moduleFiles.find((f) => path.basename(f.name, path.extname(f.name)) === fileName);
		if (file) {
			const analysis = await analyzeModule(path.join(categoryPath, file.name), {
				debug,
				instance
			});
			const processedMod = processModuleFromAnalysis(analysis, {
				debug,
				instance
			});
			defaultExportFiles.push({ file, moduleName: instance._toapiPathKey(fileName), mod: processedMod, analysis });
		}
	}

	if (debug) {
		console.log(`[DEBUG] buildCategoryStructure: Multi-default analysis results`);
		console.log(`[DEBUG]   - totalDefaultExports: ${totalDefaultExports}`);
		console.log(`[DEBUG]   - hasMultipleDefaultExports: ${hasMultipleDefaultExports}`);
		console.log(`[DEBUG]   - selfReferentialFiles: ${Array.from(selfReferentialFiles)}`);
	}

	// Process each module file
	for (const file of moduleFiles) {
		const moduleExt = path.extname(file.name);
		const moduleName = instance._toapiPathKey(path.basename(file.name, moduleExt));
		const fileName = path.basename(file.name, moduleExt);
		const apiPathKey = instance._toapiPathKey(fileName);

		if (debug && moduleName === "config") {
			console.log(`[DEBUG] Processing config file: ${file.name}, moduleName: ${moduleName}`);
			console.log(`[DEBUG] selfReferentialFiles has config? ${selfReferentialFiles.has(moduleName)}`);
		}

		// Check if we already loaded this module during first pass
		let mod = null;
		let analysis = null;
		const existingDefault = defaultExportFiles.find((def) => def.moduleName === moduleName);
		if (existingDefault) {
			mod = existingDefault.mod; // Reuse already loaded module
			analysis = existingDefault.analysis; // Reuse stored analysis data
		} else {
			analysis = await analyzeModule(path.join(categoryPath, file.name), {
				debug,
				instance
			});
			mod = processModuleFromAnalysis(analysis, {
				debug,
				instance
			});
		}

		// Use centralized API builder for module processing
		processModuleForAPI({
			mod,
			fileName,
			apiPathKey,
			hasMultipleDefaultExports,
			isSelfReferential: selfReferentialFiles.has(moduleName),
			api: categoryModules,
			getRootDefault: () => null, // Categories don't have root defaults
			setRootDefault: () => {}, // No-op for categories
			context: {
				debug,
				mode: "category",
				categoryName,
				totalModules: moduleFiles.length
			},
			originalAnalysis: analysis
		});
	}

	// Process subdirectories
	for (const subDirEntry of subDirs) {
		if (currentDepth < maxDepth) {
			const key = instance._toapiPathKey(subDirEntry.name);
			const subDirPath = path.join(categoryPath, subDirEntry.name);
			let subModule;

			if (mode === "lazy" && typeof subdirHandler === "function") {
				// Lazy mode: use custom subdirectory handler
				subModule = subdirHandler({
					subDirEntry,
					subDirPath,
					key,
					categoryModules,
					currentDepth,
					maxDepth
				});
			} else {
				// Eager mode: recursive category building
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
				subModule.name.toLowerCase() === key.toLowerCase() &&
				subModule.name !== key
			) {
				categoryModules[subModule.name] = subModule; // Use original function name
			} else {
				categoryModules[key] = subModule; // Use sanitized folder name
			}
		}
	}

	return categoryModules;
}

/**
 * Comprehensive root API building function that replaces eager/lazy create methods.
 * Handles complete root-level API construction with mode-specific optimizations.
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
		const { multidefault_analyzeModules } = await import("@cldmv/slothlet/helpers/multidefault");
		const analysis = await multidefault_analyzeModules(moduleFiles, dir, debug);
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
				// Lazy mode: use existing _loadCategory method (will be replaced later)
				api[instance._toapiPathKey(entry.name)] = await instance._loadCategory(categoryPath, 0, maxDepth);
			} else {
				// Eager mode: use new centralized category builder
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

/**
 * Centralized category building decisions - contains ALL logic for directory/category processing.
 * This function analyzes a directory and returns decisions about how to structure the API,
 * but doesn't actually build the API (allowing eager/lazy modes to implement differently).
 *
 * @function buildCategoryDecisions
 * @param {string} categoryPath - Path to the category directory
 * @param {object} options - Configuration options
 * @param {number} [options.currentDepth=0] - Current nesting depth
 * @param {number} [options.maxDepth=Infinity] - Maximum nesting depth
 * @param {string} [options.mode="eager"] - Loading mode ("eager" or "lazy")
 * @param {Function} [options.subdirHandler] - Handler for subdirectories (lazy mode)
 * @param {object} options.instance - Slothlet instance with _toapiPathKey, _shouldIncludeFile, config
 * @returns {Promise<object>} Category building decisions and data
 *
 * @example // ESM usage
 * import { buildCategoryDecisions } from "@cldmv/slothlet/helpers/api_builder";
 * const decisions = await buildCategoryDecisions("/path/to/category", {
 *   currentDepth: 1,
 *   instance: slothletInstance
 * });
 *
 * @example // CJS usage
 * const { buildCategoryDecisions } = require("@cldmv/slothlet/helpers/api_builder");
 * const decisions = await buildCategoryDecisions("/path/to/category", {
 *   currentDepth: 1,
 *   instance: slothletInstance
 * });
 */
export async function buildCategoryDecisions(categoryPath, options = {}) {
	const { currentDepth = 0, maxDepth = Infinity, mode = "eager", subdirHandler } = options;
	const { instance } = options;

	if (!instance || typeof instance._toapiPathKey !== "function") {
		throw new Error("buildCategoryDecisions requires instance parameter with _toapiPathKey method");
	}

	const debug = instance.config?.debug || false;

	// Debug: Log when buildCategoryDecisions is called
	if (debug) {
		console.log(`[DEBUG] buildCategoryDecisions called with path: ${categoryPath}, mode: ${mode}`);
	}

	const fs = await import("fs/promises");
	const path = await import("path");

	const files = await fs.readdir(categoryPath, { withFileTypes: true });
	const moduleFiles = files.filter((f) => instance._shouldIncludeFile(f));
	const categoryName = instance._toapiPathKey(path.basename(categoryPath));
	const subDirs = files.filter((e) => e.isDirectory() && !e.name.startsWith("."));

	const decisions = {
		type: null, // "single-file" | "multi-file" | "empty"
		categoryName,
		moduleFiles,
		subDirs,
		currentDepth,
		maxDepth,
		mode,
		subdirHandler,
		// Single file decisions
		singleFile: null,
		shouldFlatten: false,
		flattenType: null, // "function-folder-match" | "function-filename-match" | "object-auto-flatten" | "parent-level-flatten" | "default-function"
		preferredName: null,
		// Multi-file decisions
		multifileAnalysis: null,
		processedModules: [],
		categoryModules: {},
		// Subdirectory decisions
		subdirectoryDecisions: []
	};

	// SINGLE FILE CASE
	if (moduleFiles.length === 1 && subDirs.length === 0) {
		decisions.type = "single-file";
		const moduleFile = moduleFiles[0];
		const moduleExt = path.extname(moduleFile.name);
		const moduleName = instance._toapiPathKey(path.basename(moduleFile.name, moduleExt));

		decisions.singleFile = {
			file: moduleFile,
			moduleName,
			moduleExt
		};

		// Load and process the module
		const analysis = await analyzeModule(path.join(categoryPath, moduleFile.name), {
			debug,
			instance
		});
		const mod = processModuleFromAnalysis(analysis, {
			debug,
			instance
		});

		decisions.singleFile.mod = mod;

		// Check if function name matches sanitized folder name (case-insensitive)
		const functionNameMatchesFolder = typeof mod === "function" && mod.name && mod.name.toLowerCase() === categoryName.toLowerCase();

		// Check if function name matches sanitized filename (case-insensitive) for single files
		const functionNameMatchesFilename =
			typeof mod === "function" &&
			mod.name &&
			instance._toapiPathKey(mod.name).toLowerCase() === instance._toapiPathKey(moduleName).toLowerCase() &&
			mod.name !== instance._toapiPathKey(moduleName);

		// Flatten if file matches folder name and exports a function (named)
		// BUT NOT for root-level files (currentDepth === 0)
		if (moduleName === categoryName && typeof mod === "function" && currentDepth > 0) {
			decisions.shouldFlatten = true;
			decisions.flattenType = "function-folder-match";
			decisions.preferredName = categoryName;
			return decisions;
		}

		// CJS/ESM Default Export Flattening: Check if this module had a default export that should be flattened
		// This handles both CJS and ESM modules with default objects uniformly
		if (analysis.hasDefault && analysis.defaultExportType === "object" && moduleName === categoryName && currentDepth > 0) {
			if (debug) {
				console.log(`[DEBUG] Default export flattening: ${categoryName}/${moduleFile.name} -> flatten default object contents`);
			}
			decisions.shouldFlatten = true;
			decisions.flattenType = "default-export-flatten";
			return decisions;
		}

		// Auto-flatten single-file folders where filename matches folder name and exports object
		// BUT NOT for root-level files (currentDepth === 0)
		if (moduleName === categoryName && mod && typeof mod === "object" && !Array.isArray(mod) && currentDepth > 0) {
			// Check if module exports single named export matching filename, and flatten it
			const moduleKeys = Object.keys(mod).filter((k) => k !== "default");
			if (debug) {
				console.log(
					`[DEBUG] Auto-flatten check: moduleName="${moduleName}" categoryName="${categoryName}" moduleKeys=[${moduleKeys}] match=${moduleKeys.length === 1 && moduleKeys[0] === moduleName}`
				);
			}
			if (moduleKeys.length === 1 && moduleKeys[0] === moduleName) {
				if (debug) {
					console.log(`[DEBUG] Single-file auto-flattening: ${categoryName}/${moduleFile.name} -> flatten object contents`);
				}
				decisions.shouldFlatten = true;
				decisions.flattenType = "object-auto-flatten";
				decisions.preferredName = moduleKeys[0]; // Use the actual export name, not the filename
				return decisions;
			}
			// Special case: ONLY when filename exactly matches folder name (like nest/nest.mjs)
			// flatten to avoid double nesting like nest/nest.mjs -> nest.nest.alpha
			// This is the specific case where file basename without extension matches the folder
			const fileBaseName = moduleFile.name.replace(/\.(mjs|cjs|js)$/, "");
			if (fileBaseName === categoryName && moduleKeys.length > 0) {
				if (debug) {
					console.log(
						`[DEBUG] Single-file filename-folder exact match flattening: ${categoryName}/${moduleFile.name} -> avoid double nesting`
					);
				}
				decisions.shouldFlatten = true;
				decisions.flattenType = "filename-folder-match-flatten";
				return decisions;
			}
		}

		// Auto-flatten single-file folders to parent level (eliminate intermediate filename namespace)
		// This handles cases like nest4/singlefile.mjs -> api.nest4.beta() instead of api.nest4.singlefile.beta()
		// BUT NOT for root-level files (currentDepth === 0)
		// BUT ONLY when the filename doesn't match a meaningful namespace (avoid double-flattening)
		if (moduleFiles.length === 1 && currentDepth > 0 && mod && typeof mod === "object" && !Array.isArray(mod)) {
			const moduleKeys = Object.keys(mod).filter((k) => k !== "default");
			const fileName = moduleFile.name.replace(/\.(mjs|cjs|js)$/, "");

			// Only flatten if filename is generic/meaningless (like "singlefile", "index")
			// Don't flatten if filename represents a meaningful namespace (like "self-object" -> "selfObject")
			const isGenericFilename = ["singlefile", "index", "main", "default"].includes(fileName.toLowerCase());

			// If single file has single export AND filename is generic, flatten to parent level
			if (moduleKeys.length === 1 && isGenericFilename) {
				if (debug) {
					console.log(`[DEBUG] Single-file parent-level auto-flattening: ${categoryName}/${moduleFile.name} -> flatten to parent level`);
				}
				decisions.shouldFlatten = true;
				decisions.flattenType = "parent-level-flatten";
				decisions.preferredName = moduleKeys[0];
				return decisions;
			}
		}

		// Flatten if function name matches folder name (case-insensitive) and prefer function name
		// BUT NOT for root-level files (currentDepth === 0)
		if (functionNameMatchesFolder && currentDepth > 0) {
			decisions.shouldFlatten = true;
			decisions.flattenType = "function-folder-match";
			decisions.preferredName = mod.name;
			return decisions;
		}

		// Use function name instead of sanitized filename when they match (case-insensitive)
		if (functionNameMatchesFilename) {
			decisions.shouldFlatten = false;
			decisions.preferredName = mod.name;
			return decisions;
		}

		// ALSO flatten if this was a default function export (tracked by internal flag)
		// even when the filename differs from the folder name (e.g. folder nest3 / singlefile.mjs)
		// BUT NOT for root-level files (currentDepth === 0)
		if (
			typeof mod === "function" &&
			(!mod.name || mod.name === "default" || mod.__slothletDefault === true) && // explicitly marked default export function
			currentDepth > 0
		) {
			decisions.shouldFlatten = true;
			decisions.flattenType = "default-function";
			decisions.preferredName = categoryName;
			return decisions;
		}

		// Check for auto-flattening: if module has single named export matching filename, use it directly
		const moduleKeys = Object.keys(mod).filter((k) => k !== "default");
		if (moduleKeys.length === 1 && moduleKeys[0] === moduleName) {
			// Auto-flatten: module exports single named export matching filename
			decisions.shouldFlatten = true;
			decisions.flattenType = "object-auto-flatten";
			decisions.preferredName = moduleName;
			return decisions;
		}

		// Default case: return as namespace
		decisions.shouldFlatten = false;
		decisions.preferredName = moduleName;
		if (debug && moduleName === "nest") {
			console.log(
				`[DEBUG] buildCategoryDecisions single-file default: moduleName="${moduleName}" shouldFlatten=false preferredName="${decisions.preferredName}"`
			);
		}
		return decisions;
	}

	// MULTI-FILE CASE
	decisions.type = "multi-file";
	if (debug) {
		console.log(`[DEBUG] buildCategoryDecisions: Processing multi-file case for ${categoryPath}`);
	}

	// Use shared multi-default detection utility
	const { multidefault_analyzeModules } = await import("@cldmv/slothlet/helpers/multidefault");
	const analysis = await multidefault_analyzeModules(moduleFiles, categoryPath, debug);

	decisions.multifileAnalysis = analysis;

	const { totalDefaultExports, hasMultipleDefaultExports, selfReferentialFiles, defaultExportFiles: analysisDefaults } = analysis;

	// Convert analysis results to match existing structure
	const defaultExportFiles = [];
	for (const { fileName } of analysisDefaults) {
		const file = moduleFiles.find((f) => path.basename(f.name, path.extname(f.name)) === fileName);
		if (file) {
			const analysis = await analyzeModule(path.join(categoryPath, file.name), {
				debug,
				instance
			});
			const processedMod = processModuleFromAnalysis(analysis, {
				debug,
				instance
			});
			defaultExportFiles.push({ file, moduleName: instance._toapiPathKey(fileName), mod: processedMod, analysis });
		}
	}

	if (debug) {
		console.log(`[DEBUG] buildCategoryDecisions: Using shared multidefault utility results`);
		console.log(`[DEBUG]   - totalDefaultExports: ${totalDefaultExports}`);
		console.log(`[DEBUG]   - hasMultipleDefaultExports: ${hasMultipleDefaultExports}`);
		console.log(`[DEBUG]   - selfReferentialFiles: ${Array.from(selfReferentialFiles)}`);
	}

	// Process each module file and determine decisions
	for (const file of moduleFiles) {
		const moduleExt = path.extname(file.name);
		const moduleName = instance._toapiPathKey(path.basename(file.name, moduleExt));

		// Check if we already loaded this module during first pass (for non-self-referential defaults)
		let mod = null;
		const existingDefault = defaultExportFiles.find((def) => def.moduleName === moduleName);
		if (existingDefault) {
			mod = existingDefault.mod; // Reuse already loaded module
		} else {
			// Load processed module only if not already loaded
			const analysis = await analyzeModule(path.join(categoryPath, file.name), {
				debug,
				instance
			});
			mod = processModuleFromAnalysis(analysis, {
				debug,
				instance
			});
		}

		const moduleDecision = {
			file,
			moduleName,
			mod,
			type: null, // "function" | "object" | "self-referential"
			apiPathKey: null,
			shouldFlatten: false,
			flattenType: null,
			specialHandling: null
		};

		if (moduleName === categoryName && mod && typeof mod === "object") {
			moduleDecision.type = "category-match-object";
			moduleDecision.specialHandling = "category-merge";
		} else if (typeof mod === "function") {
			moduleDecision.type = "function";

			// Check if this file was identified as self-referential in the first pass
			const isSelfReferential = selfReferentialFiles.has(moduleName);

			if (hasMultipleDefaultExports && mod.__slothletDefault === true && !isSelfReferential) {
				// Use file name for default exports when multiple defaults exist
				moduleDecision.apiPathKey = moduleName;
				moduleDecision.specialHandling = "multi-default-filename";
				if (debug) {
					console.log(
						`[DEBUG] Multi-default function case: ${moduleName} => ${moduleDecision.apiPathKey} (hasMultiple=${hasMultipleDefaultExports}, __slothletDefault=${mod.__slothletDefault}, isSelfRef=${isSelfReferential})`
					);
				}
			} else if (selfReferentialFiles.has(moduleName)) {
				// Self-referential case: use the named export directly to avoid nesting
				moduleDecision.type = "self-referential";
				moduleDecision.specialHandling = "self-referential-namespace";
			} else {
				// Original logic for single defaults or named function exports
				const fnName = mod.name && mod.name !== "default" ? mod.name : moduleName;
				if (debug) {
					console.log(
						`[DEBUG] Standard function case: ${moduleName}, fnName=${fnName}, mod.__slothletDefault=${mod.__slothletDefault}, hasMultiple=${hasMultipleDefaultExports}`
					);
				}

				// Check if function name matches sanitized filename (case-insensitive)
				// If so, prefer the original function name over the sanitized version
				if (fnName && fnName.toLowerCase() === moduleName.toLowerCase() && fnName !== moduleName) {
					// Use original function name without sanitizing
					moduleDecision.apiPathKey = fnName;
					moduleDecision.specialHandling = "prefer-function-name";
				} else {
					// Use sanitized function name
					moduleDecision.apiPathKey = instance._toapiPathKey(fnName);
				}
			}
		} else {
			moduleDecision.type = "object";

			// Handle named exports - check if any export function names match filename
			let hasPreferredName = false;
			const modWithPreferredNames = {};

			for (const [exportName, exportValue] of Object.entries(mod)) {
				if (
					typeof exportValue === "function" &&
					exportValue.name &&
					instance._toapiPathKey(exportValue.name).toLowerCase() === instance._toapiPathKey(moduleName).toLowerCase() &&
					exportValue.name !== instance._toapiPathKey(moduleName)
				) {
					// Use the original function name instead of sanitized filename
					modWithPreferredNames[exportValue.name] = exportValue;
					hasPreferredName = true;
				} else {
					modWithPreferredNames[instance._toapiPathKey(exportName)] = exportValue;
				}
			}

			if (hasPreferredName) {
				moduleDecision.specialHandling = "preferred-export-names";
				moduleDecision.processedExports = modWithPreferredNames;
			} else if (selfReferentialFiles.has(moduleName)) {
				// Self-referential case: use the named export directly to avoid nesting
				moduleDecision.type = "self-referential";
				moduleDecision.specialHandling = "self-referential-namespace";
			} else {
				// Check for various flattening scenarios
				const moduleKeys = Object.keys(mod).filter((k) => k !== "default");
				const apiPathKey = instance._toapiPathKey(moduleName);

				// Single default export flattening (regardless of filename matching)
				// ONLY when there's a single default export in the folder (not multiple defaults)
				if (!hasMultipleDefaultExports && mod.default && typeof mod.default === "object") {
					moduleDecision.shouldFlatten = true;
					moduleDecision.flattenType = "single-default-object";
					moduleDecision.apiPathKey = apiPathKey;
				} else if (hasMultipleDefaultExports && !mod.default && moduleKeys.length > 0) {
					// Multi-default context: flatten modules WITHOUT default exports to category
					moduleDecision.shouldFlatten = true;
					moduleDecision.flattenType = "multi-default-no-default";
				} else if (moduleKeys.length === 1 && moduleKeys[0] === apiPathKey) {
					// Auto-flatten: module exports single named export matching filename
					moduleDecision.shouldFlatten = true;
					moduleDecision.flattenType = "single-named-export-match";
					moduleDecision.apiPathKey = apiPathKey;
				} else if (!mod.default && moduleKeys.length > 0 && moduleName === categoryName) {
					// Auto-flatten: module filename matches folder name and has no default → flatten to category
					moduleDecision.shouldFlatten = true;
					moduleDecision.flattenType = "category-name-match-flatten";
				} else {
					// Standard object export
					moduleDecision.apiPathKey = apiPathKey;
				}
			}
		}

		decisions.processedModules.push(moduleDecision);
	}

	// Handle subdirectories
	for (const subDir of subDirs) {
		const subDirPath = path.join(categoryPath, subDir.name);
		const subDirDecision = {
			name: subDir.name,
			path: subDirPath,
			apiPathKey: instance._toapiPathKey(subDir.name),
			shouldRecurse: currentDepth < maxDepth
		};
		decisions.subdirectoryDecisions.push(subDirDecision);
	}

	return decisions;
}
