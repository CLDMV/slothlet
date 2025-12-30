/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /src/lib/helpers/api_builder/decisions.mjs
 *	@Date: 2025-12-29 00:00:00 -08:00
 *	@Author: Nate Hyson <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Hyson <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2025-12-30 07:26:43 -08:00 (1767108403)
 *	-----
 *	@Copyright: Copyright (c) 2013-2025 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Decision-making functions for slothlet API construction.
 * @module @cldmv/slothlet/src/lib/helpers/api_builder/decisions
 * @internal
 * @package
 *
 * @description
 * This module contains the core decision logic for API structure determination.
 * It analyzes modules and determines how they should be integrated into the API,
 * including flattening decisions, naming preferences, and structural transformations.
 *
 * Core responsibilities:
 * - Flattening decision logic (auto-flatten, multi-default, self-referential)
 * - Function name preference over sanitized names
 * - Module-to-API assignment decisions
 * - Category building decision pipeline
 */

import fs from "node:fs/promises";
import path from "node:path";
import { multidefault_analyzeModules } from "@cldmv/slothlet/helpers/multidefault";
import { analyzeModule, processModuleFromAnalysis } from "@cldmv/slothlet/helpers/api_builder/analysis";

// ============================================================================
// FLATTENING DECISION FUNCTIONS
// ============================================================================

/**
 * Auto-flattening decision logic that determines whether a module should be flattened
 * based on filename matching, export patterns, and context.
 *
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
		// eslint-disable-next-line no-unused-vars
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
 * Handles function name preference logic for better API naming.
 *
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

// ============================================================================
// MODULE PROCESSING FUNCTIONS
// ============================================================================

/**
 * Processes a single module and applies it to the target API object based on flattening decisions.
 *
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

// ============================================================================
// CATEGORY DECISION FUNCTIONS
// ============================================================================

/**
 * Centralized category building decisions - contains ALL logic for directory/category processing.
 * This function analyzes a directory and returns decisions about how to structure the API,
 * but doesn't actually build the API (allowing eager/lazy modes to implement differently).
 *
 * @function buildCategoryDecisions
 * @internal
 * @package
 * @param {string} categoryPath - Path to the category directory
 * @param {object} options - Configuration options
 * @param {number} [options.currentDepth=0] - Current nesting depth
 * @param {number} [options.maxDepth=Infinity] - Maximum nesting depth
 * @param {string} [options.mode="eager"] - Loading mode ("eager" or "lazy")
 * @param {Function} [options.subdirHandler] - Handler for subdirectories (lazy mode)
 * @param {object} options.instance - Slothlet instance with _toapiPathKey, _shouldIncludeFile, config
 * @returns {Promise<object>} Category building decisions and data
 *
 * @example
 * // ESM usage
 * import { buildCategoryDecisions } from "@cldmv/slothlet/helpers/api_builder_decisions";
 * const decisions = await buildCategoryDecisions("/path/to/category", {
 *   currentDepth: 1,
 *   instance: slothletInstance
 * });
 *
 * @example
 * // CJS usage
 * const { buildCategoryDecisions } = require("@cldmv/slothlet/helpers/api_builder_decisions");
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
		return decisions;
	}

	// MULTI-FILE CASE
	decisions.type = "multi-file";
	if (debug) {
		console.log(`[DEBUG] buildCategoryDecisions: Processing multi-file case for ${categoryPath}`);
	}

	// Use shared multi-default detection utility
	const analysis = await multidefault_analyzeModules(moduleFiles, categoryPath, { debug, instance });

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
		let analysis = null;
		const existingDefault = defaultExportFiles.find((def) => def.moduleName === moduleName);
		if (existingDefault) {
			mod = existingDefault.mod; // Reuse already loaded module
			// Use preserved analysis data from existingDefault
			analysis = existingDefault.analysis;
		} else {
			// Load processed module only if not already loaded
			analysis = await analyzeModule(path.join(categoryPath, file.name), {
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
				if (!hasMultipleDefaultExports && analysis.hasDefault && analysis.defaultExportType === "object") {
					moduleDecision.shouldFlatten = true;
					moduleDecision.flattenType = "single-default-object";
					moduleDecision.apiPathKey = apiPathKey;
				} else if (hasMultipleDefaultExports && !analysis.hasDefault && moduleKeys.length > 0) {
					// Multi-default context: flatten modules WITHOUT default exports to category
					moduleDecision.shouldFlatten = true;
					moduleDecision.flattenType = "multi-default-no-default";
				} else if (moduleKeys.length === 1 && moduleKeys[0] === apiPathKey) {
					// Auto-flatten: module exports single named export matching filename
					moduleDecision.shouldFlatten = true;
					moduleDecision.flattenType = "single-named-export-match";
					moduleDecision.apiPathKey = apiPathKey;
				} else if (!analysis.hasDefault && moduleKeys.length > 0 && moduleName === categoryName) {
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
