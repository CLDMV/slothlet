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
 * const moduleResult = await processModuleDecisions(modulePath, { rootLevel: false, instance });
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
 * @param {boolean} [options.rootLevel=false] - Whether this is a root-level module
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
 * const analysis = await analyzeModule("./api/math.mjs", { rootLevel: false, instance });
 * // Eager mode: use analysis.processedModule directly
 * // Lazy mode: create proxy based on analysis.isFunction, analysis.exports, etc.
 */
export async function analyzeModule(modulePath, options = {}) {
	const { rootLevel = false, debug = false, instance } = options;

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
	const shouldWrapAsCallable =
		hasDefault &&
		typeof processedModule.default === "object" &&
		processedModule.default !== null &&
		typeof processedModule.default.default === "function";

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
		metadata: { rootLevel, modulePath }
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
 * @param {object} [options.instance] - Slothlet instance for accessing _toApiKey method
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
	const { processedModule, isFunction, hasDefault, shouldWrapAsCallable, namedExports, metadata } = analysis;

	if (!instance) {
		throw new Error("processModuleFromAnalysis requires instance parameter for _toApiKey access");
	}

	// Handle function default exports
	if (isFunction) {
		let fn;
		if (metadata.rootLevel) {
			fn = processedModule;
		} else {
			fn = processedModule.default;
			// Mark as originating from default export
			try {
				Object.defineProperty(fn, "__slothletDefault", { value: true, enumerable: false });
			} catch {
				// ignore
			}

			// Attach named exports as properties
			for (const [exportName, exportValue] of Object.entries(processedModule)) {
				if (exportName !== "default") {
					fn[instance._toApiKey(exportName)] = exportValue;
				}
			}
		}
		return fn;
	}

	// Handle callable objects (objects with callable default)
	if (shouldWrapAsCallable) {
		const defaultObj = processedModule.default;
		const objectName =
			processedModule.default.name || (namedExports[0] && namedExports[0][0] !== "default" ? namedExports[0][0] : "callable");

		const callableApi = {
			[objectName]: function (...args) {
				return defaultObj.default.apply(defaultObj, args);
			}
		}[objectName];

		// Attach methods from default object
		for (const [methodName, method] of Object.entries(defaultObj)) {
			if (methodName === "default") continue;
			callableApi[methodName] = method;
		}

		if (debug) {
			console.log(`[DEBUG] Created callable wrapper for ${objectName}`);
		}

		return callableApi;
	}

	// Handle object default exports
	if (hasDefault && typeof processedModule.default === "object") {
		const obj = { ...processedModule.default };

		// Add named exports
		for (const [exportName, exportValue] of Object.entries(processedModule)) {
			if (exportName !== "default" && exportValue !== obj) {
				obj[instance._toApiKey(exportName)] = exportValue;
			}
		}

		return obj;
	}

	// Handle named exports only
	if (namedExports.length > 0) {
		const apiExport = {};
		for (const [exportName, exportValue] of namedExports) {
			apiExport[instance._toApiKey(exportName)] = exportValue;
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
	const { instance, currentDepth = 0, maxDepth = Infinity, debug = false } = options;

	if (!instance || typeof instance._toApiKey !== "function") {
		throw new Error("analyzeDirectoryStructure requires a valid slothlet instance");
	}

	const files = await fs.readdir(categoryPath, { withFileTypes: true });
	const moduleFiles = files.filter((f) => instance._shouldIncludeFile(f));
	const categoryName = instance._toApiKey(path.basename(categoryPath));
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
 *   subDirectories: Array<{dirEntry: import('fs').Dirent, apiKey: string}>,
 *   multiDefaultAnalysis: object,
 *   flatteningDecisions: object,
 *   upwardFlatteningCandidate: {shouldFlatten: boolean, apiKey: string}
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
			const moduleName = instance._toApiKey(path.basename(file.name, moduleExt));
			const modulePath = path.join(categoryPath, file.name);

			// Load and process the module using centralized logic
			const processedModule = await loadAndProcessModule(modulePath, {
				rootLevel: false,
				debug,
				instance
			});

			// Get flattening decisions for this module
			const flatteningInfo = {
				shouldFlatten: false,
				apiKey: moduleName,
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
					flatteningInfo.apiKey = processedModule.name;
					flatteningInfo.reason = "function name matches folder";
				} else if (moduleNameMatchesCategory) {
					flatteningInfo.shouldFlatten = true;
					flatteningInfo.apiKey = categoryName;
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
			const apiKey = instance._toApiKey(subDirEntry.name);
			subDirectories.push({ dirEntry: subDirEntry, apiKey });
		}
	}

	// Determine upward flattening candidate
	const upwardFlatteningCandidate = { shouldFlatten: false, apiKey: null };
	if (processedModules.length === 1 && subDirectories.length === 0) {
		const single = processedModules[0];
		if (single.moduleName === categoryName) {
			upwardFlatteningCandidate.shouldFlatten = true;
			upwardFlatteningCandidate.apiKey = single.moduleName;
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
 * @param {string} options.apiKey - Sanitized API key for the module
 * @param {boolean} options.hasMultipleDefaultExports - Whether multiple default exports exist in the container
 * @param {boolean} options.isSelfReferential - Whether this is a self-referential export
 * @param {boolean} [options.moduleHasDefault] - Whether this specific module has a default export
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
 *   fileName: "math", apiKey: "math",
 *   hasMultipleDefaultExports: false, isSelfReferential: false
 * });
 * // Returns: { shouldFlatten: true, useAutoFlattening: true, reason: "auto-flatten single named export" }
 */
export function getFlatteningDecision(options) {
	const {
		mod,
		fileName,
		apiKey,
		hasMultipleDefaultExports,
		isSelfReferential,
		moduleHasDefault = !!mod.default,
		categoryName,
		totalModules = 1,
		debug = false
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
	if (moduleKeys.length === 1 && moduleKeys[0] === apiKey) {
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

	// Rule 5: Single file context - flatten if no default and has named exports
	if (totalModules === 1 && !moduleHasDefault && moduleKeys.length > 0) {
		return {
			shouldFlatten: true,
			flattenToRoot: true,
			flattenToCategory: true,
			preserveAsNamespace: false,
			useAutoFlattening: false,
			reason: "single file context with named exports only"
		};
	}

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
 * @param {string} options.apiKey - Sanitized API key for the module
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
 *   mod, fileName, apiKey, hasMultipleDefaultExports, isSelfReferential, api,
 *   getRootDefault: () => rootDefaultFunction,
 *   setRootDefault: (fn) => { rootDefaultFunction = fn; },
 *   context: { debug: true, mode: "root", totalModules: 3 }
 * });
 */
export function processModuleForAPI(options) {
	const {
		mod,
		fileName,
		apiKey,
		hasMultipleDefaultExports,
		isSelfReferential,
		api,
		getRootDefault,
		setRootDefault,
		context = {}
	} = options;

	const { debug = false, mode = "unknown", categoryName, totalModules = 1 } = context;

	let processed = false;
	let rootDefaultSet = false;
	let flattened = false;
	let namespaced = false;
	const apiAssignments = {};

	// Handle function default exports
	if (mod && typeof mod.default === "function") {
		processed = true;

		if (hasMultipleDefaultExports && !isSelfReferential) {
			// Multi-default case: use filename as API key
			apiAssignments[apiKey] = mod.default;
			namespaced = true;

			// Add named exports to the function
			for (const [key, value] of Object.entries(mod)) {
				if (key !== "default") {
					apiAssignments[apiKey][key] = value;
				}
			}

			if (debug) {
				console.log(`[DEBUG] ${mode}: Multi-default function - using filename '${apiKey}' for default export`);
			}
		} else if (isSelfReferential) {
			// Self-referential case: preserve as namespace (both named and default)
			apiAssignments[apiKey] = mod;
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
				setRootDefault(mod.default);
				rootDefaultSet = true;

				if (debug) {
					console.log(`[DEBUG] ${mode}: Set rootDefaultFunction to:`, mod.default.name);
				}

				// Add named exports to root level in traditional single-default case
				for (const [key, value] of Object.entries(mod)) {
					if (key !== "default") {
						apiAssignments[key] = value;
					}
				}
			} else {
				// In subfolder context or when root already exists, treat as namespace
				apiAssignments[apiKey] = mod.default;
				namespaced = true;

				// Add named exports to the function
				for (const [key, value] of Object.entries(mod)) {
					if (key !== "default") {
						apiAssignments[apiKey][key] = value;
					}
				}
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
			apiKey,
			hasMultipleDefaultExports,
			isSelfReferential,
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
			apiAssignments[apiKey] = mod[moduleKeys[0]];
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
			apiAssignments[apiKey] = mod[apiKey] || mod;
			namespaced = true;
		} else {
			// Traditional: preserve as namespace
			apiAssignments[apiKey] = mod;
			namespaced = true;
		}
	}

	// Apply assignments to target API
	for (const [key, value] of Object.entries(apiAssignments)) {
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
 * @param {string} options.apiKey - Sanitized API key
 * @param {object} options.categoryModules - Target category modules object
 * @param {function} options.toApiKey - Function to sanitize names to API keys
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
 *   fileName: "auto-ip", apiKey: "autoIp",
 *   categoryModules, toApiKey: this._toApiKey, debug: true
 * });
 * // Returns: { hasPreferredName: true, preferredKey: "autoIP" }
 */
export function applyFunctionNamePreference(options) {
	const { mod, fileName, apiKey, categoryModules, toApiKey, debug = false } = options;

	let hasPreferredName = false;
	let preferredKey = apiKey;

	// Check if any export function names should be preferred over sanitized filename
	for (const [exportName, exportValue] of Object.entries(mod)) {
		if (typeof exportValue === "function" && exportValue.name) {
			const functionNameLower = exportValue.name.toLowerCase();
			const filenameLower = fileName.toLowerCase();

			// Check if function name semantically matches filename but has different casing
			if (functionNameLower === filenameLower && exportValue.name !== apiKey) {
				// Use original function name as the preferred API key
				preferredKey = exportValue.name;
				hasPreferredName = true;

				if (debug) {
					console.log(`[DEBUG] Using function name preference: ${exportValue.name} instead of ${apiKey} for ${fileName}`);
				}
				break;
			}

			// Also check if sanitized function name matches sanitized filename
			const sanitizedFunctionName = toApiKey(exportValue.name);
			if (sanitizedFunctionName.toLowerCase() === apiKey.toLowerCase() && exportValue.name !== apiKey) {
				preferredKey = exportValue.name;
				hasPreferredName = true;

				if (debug) {
					console.log(`[DEBUG] Using function name preference: ${exportValue.name} instead of ${apiKey} for ${fileName}`);
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
 * Comprehensive module loading and processing function that replaces _loadSingleModule.
 * Handles all module loading, CJS unwrapping, default export processing, and named export merging.
 * @function loadAndProcessModule
 * @internal
 * @package
 * @async
 * @param {string} modulePath - Absolute path to the module file
 * @param {object} options - Loading options
 * @param {boolean} [options.rootLevel=false] - Whether this is root-level loading
 * @param {boolean} [options.debug=false] - Enable debug logging
 * @param {object} options.instance - Slothlet instance for _toApiKey access
 * @returns {Promise<any>} Processed module with proper export structure
 *
 * @description
 * Complete module loading pipeline that handles:
 * - Dynamic import with proper URL conversion
 * - CJS automatic wrapper unwrapping (Node.js wraps module.exports in 'default')
 * - Default function export processing with named export merging
 * - Default object export processing with named export merging
 * - Pure named exports object creation
 * - Function name preservation and callable object creation
 * - Proper slothlet markers for downstream processing
 *
 * @example
 * // Internal usage - load any module type
 * const mod = await loadAndProcessModule("/path/to/module.mjs", {
 *   rootLevel: false, debug: true, instance: slothletInstance
 * });
 */
export async function loadAndProcessModule(modulePath, options = {}) {
	const { rootLevel = false, debug = false, instance } = options;

	if (!instance || typeof instance._toApiKey !== "function") {
		throw new Error("loadAndProcessModule requires a valid slothlet instance with _toApiKey method");
	}

	const moduleUrl = pathToFileURL(modulePath).href;
	if (debug) console.log(`[DEBUG] Loading module: ${modulePath}`);

	const rawModule = await import(moduleUrl);
	let module = rawModule;

	// CJS unwrapping: Node.js automatically wraps module.exports in a 'default' property
	if (modulePath.endsWith(".cjs") && "default" in rawModule) {
		module = rawModule.default;
		if (debug) console.log(`[DEBUG] Unwrapped CJS module: ${modulePath}`);
	}

	if (debug) console.log(`[DEBUG] Module structure:`, Object.keys(module));

	// DEFAULT FUNCTION EXPORT processing
	if (typeof module.default === "function") {
		let fn;

		if (rootLevel) {
			// Root level: return entire module structure
			fn = module;
		} else {
			// Non-root: extract default function and merge named exports
			fn = module.default;

			// Mark as originating from default export for downstream processing
			try {
				Object.defineProperty(fn, "__slothletDefault", {
					value: true,
					enumerable: false,
					configurable: true
				});
			} catch {
				// Ignore if property cannot be defined
			}

			// Merge named exports as function properties
			for (const [exportName, exportValue] of Object.entries(module)) {
				if (exportName !== "default") {
					fn[instance._toApiKey(exportName)] = exportValue;
				}
			}
		}

		if (debug) console.log(`[DEBUG] Processed default function export`);
		return fn;
	}

	// Validate module has exports
	const moduleExports = Object.entries(module);
	if (!moduleExports.length) {
		throw new Error(
			`slothlet: No exports found in module '${modulePath}'. The file is empty or does not export any function/object/variable.`
		);
	}

	// DEFAULT OBJECT EXPORT with potential callable function
	const defaultExportObj =
		typeof module.default === "object" && module.default !== null
			? module.default
			: typeof moduleExports[0][1] === "object" && typeof moduleExports[0][1].default === "function" && moduleExports[0][1] !== null
				? moduleExports[0][1]
				: null;

	let objectName = null;
	if (typeof module.default === "function" && module.default.name) {
		objectName = module.default.name;
	} else if (moduleExports[0] && moduleExports[0][0] !== "default") {
		objectName = moduleExports[0][0];
	}

	// CALLABLE OBJECT (object with default function)
	if (defaultExportObj && typeof defaultExportObj.default === "function") {
		if (debug) console.log(`[DEBUG] Processing callable object with default function`);

		const callableApi = {
			[objectName]: function (...args) {
				return defaultExportObj.default.apply(defaultExportObj, args);
			}
		}[objectName];

		// Add all methods except 'default' to the callable function
		for (const [methodName, method] of Object.entries(defaultExportObj)) {
			if (methodName === "default") continue;
			callableApi[methodName] = method;
		}

		if (debug) console.log(`[DEBUG] Created callable API object`);
		return callableApi;
	}

	// REGULAR DEFAULT OBJECT
	if (defaultExportObj) {
		if (debug) console.log(`[DEBUG] Processing default object export`);

		const obj = { ...defaultExportObj };

		// Merge additional named exports
		for (const [exportName, exportValue] of Object.entries(module)) {
			if (exportName !== "default" && exportValue !== obj) {
				obj[instance._toApiKey(exportName)] = exportValue;
			}
		}

		return obj;
	}

	// PURE NAMED EXPORTS (no default)
	const namedExports = Object.entries(module).filter(([k]) => k !== "default");
	if (debug) console.log(`[DEBUG] Processing ${namedExports.length} named exports`);

	const apiExport = {};
	for (const [exportName, exportValue] of namedExports) {
		apiExport[instance._toApiKey(exportName)] = exportValue;
	}

	return apiExport;
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

	if (!instance || typeof instance._toApiKey !== "function" || typeof instance._shouldIncludeFile !== "function") {
		throw new Error("buildCategoryStructure requires a valid slothlet instance");
	}

	const debug = instance.config?.debug || false;

	if (debug) {
		console.log(`[DEBUG] buildCategoryStructure called with path: ${categoryPath}, mode: ${mode}, depth: ${currentDepth}`);
	}

	const files = await fs.readdir(categoryPath, { withFileTypes: true });
	const moduleFiles = files.filter((f) => instance._shouldIncludeFile(f));
	const categoryName = instance._toApiKey(path.basename(categoryPath));
	const subDirs = files.filter((e) => e.isDirectory() && !e.name.startsWith("."));

	// SINGLE FILE CASE - Special flattening rules
	if (moduleFiles.length === 1 && subDirs.length === 0) {
		const moduleExt = path.extname(moduleFiles[0].name);
		const moduleName = instance._toApiKey(path.basename(moduleFiles[0].name, moduleExt));
		const mod = await loadAndProcessModule(path.join(categoryPath, moduleFiles[0].name), {
			rootLevel: false,
			debug,
			instance
		});

		// Function name matching checks
		const functionNameMatchesFolder = typeof mod === "function" && mod.name && mod.name.toLowerCase() === categoryName.toLowerCase();

		const functionNameMatchesFilename =
			typeof mod === "function" &&
			mod.name &&
			instance._toApiKey(mod.name).toLowerCase() === instance._toApiKey(moduleName).toLowerCase() &&
			mod.name !== instance._toApiKey(moduleName);

		// Auto-flattening rules for single files

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
			const processedMod = await loadAndProcessModule(path.join(categoryPath, file.name), {
				rootLevel: false,
				debug,
				instance
			});
			defaultExportFiles.push({ file, moduleName: instance._toApiKey(fileName), mod: processedMod });
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
		const moduleName = instance._toApiKey(path.basename(file.name, moduleExt));
		const fileName = path.basename(file.name, moduleExt);
		const apiKey = instance._toApiKey(fileName);

		if (debug && moduleName === "config") {
			console.log(`[DEBUG] Processing config file: ${file.name}, moduleName: ${moduleName}`);
			console.log(`[DEBUG] selfReferentialFiles has config? ${selfReferentialFiles.has(moduleName)}`);
		}

		// Check if we already loaded this module during first pass
		let mod = null;
		const existingDefault = defaultExportFiles.find((def) => def.moduleName === moduleName);
		if (existingDefault) {
			mod = existingDefault.mod; // Reuse already loaded module
		} else {
			mod = await loadAndProcessModule(path.join(categoryPath, file.name), {
				rootLevel: false,
				debug,
				instance
			});
		}

		// Use centralized API builder for module processing
		processModuleForAPI({
			mod,
			fileName,
			apiKey,
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
			}
		});
	}

	// Process subdirectories
	for (const subDirEntry of subDirs) {
		if (currentDepth < maxDepth) {
			const key = instance._toApiKey(subDirEntry.name);
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
			const apiKey = instance._toApiKey(fileName);

			const mod = await loadAndProcessModule(path.join(dir, entry.name), {
				rootLevel: true,
				debug,
				instance
			});

			// Use centralized API builder for root module processing
			processModuleForAPI({
				mod,
				fileName,
				apiKey,
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
				api[instance._toApiKey(entry.name)] = await instance._loadCategory(categoryPath, 0, maxDepth);
			} else {
				// Eager mode: use new centralized category builder
				api[instance._toApiKey(entry.name)] = await buildCategoryStructure(categoryPath, {
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
