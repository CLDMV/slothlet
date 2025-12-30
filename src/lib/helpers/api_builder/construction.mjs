/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /src/lib/helpers/api_builder/construction.mjs
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
import { multidefault_analyzeModules } from "@cldmv/slothlet/helpers/multidefault";
import { analyzeModule, processModuleFromAnalysis } from "./analysis.mjs";
import { processModuleForAPI } from "./decisions.mjs";

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
	const analysis = await multidefault_analyzeModules(moduleFiles, categoryPath, { debug, instance });
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
