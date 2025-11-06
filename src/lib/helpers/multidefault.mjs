/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /src/lib/helpers/multidefault.mjs
 *	@Date: 2025-11-05 18:00:27 -08:00 (1762394427)
 *	@Author: Nate Hyson <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Hyson <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2025-11-05 19:24:55 -08:00 (1762399495)
 *	-----
 *	@Copyright: Copyright (c) 2013-2025 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Multi-default detection utilities for slothlet. Internal file (not exported in package.json).
 * @module @cldmv/slothlet/src/lib/helpers/multidefault
 */

import path from "path";

/**
 * Analyzes module files to detect multi-default and self-referential patterns.
 * @internal
 * @private
 * @param {Array<{name: string}>} moduleFiles - Array of module file objects with name property
 * @param {string} baseDir - Base directory path containing the modules
 * @param {object} [options={}] - Configuration options
 * @param {boolean} [options.debug=false] - Enable debug logging
 * @param {object|null} [options.instance=null] - Slothlet instance for cache isolation
 * @returns {Promise<{
 *   totalDefaultExports: number,
 *   hasMultipleDefaultExports: boolean,
 *   selfReferentialFiles: Set<string>,
 *   rawModuleCache: Map<string, object>,
 *   defaultExportFiles: Array<{fileName: string, rawModule: object}>
 * }>} Analysis results
 * @example // Internal usage in slothlet modes
 * const analysis = await multidefault_analyzeModules(moduleFiles, categoryPath, { debug: config.debug, instance });
 * if (analysis.hasMultipleDefaultExports) {
 *   // Handle multi-default context
 * }
 */
async function multidefault_analyzeModules(moduleFiles, baseDir, options = {}) {
	const { debug = false, instance = null } = options;
	const selfReferentialFiles = new Set();
	const rawModuleCache = new Map();
	const defaultExportFiles = [];
	let totalDefaultExports = 0;

	if (debug) {
		console.log(`[DEBUG] multidefault_analyzeModules: Processing ${moduleFiles.length} files in ${baseDir}`);
	}

	// First pass: Load raw modules and detect self-referential exports
	for (const file of moduleFiles) {
		const moduleExt = path.extname(file.name);
		const fileName = path.basename(file.name, moduleExt);
		const moduleFilePath = path.resolve(baseDir, file.name);

		// Create instance-isolated import URL for cache busting between slothlet instances
		let importUrl = `file://${moduleFilePath.replace(/\\/g, "/")}`;
		if (instance && instance.instanceId) {
			const separator = importUrl.includes("?") ? "&" : "?";
			importUrl = `${importUrl}${separator}slothlet_instance=${instance.instanceId}`;
		}

		// Load raw module once and cache it
		const rawImport = await import(importUrl);

		// Unwrap CJS modules (Node.js wraps them in { default: actualModule })
		const isCjsFile = moduleExt === ".cjs";
		const rawMod = isCjsFile ? rawImport.default : rawImport;
		rawModuleCache.set(file.name, rawMod);

		// Check if this module has a default export by looking at the raw module
		const hasRealDefault = rawMod && "default" in rawMod;
		if (hasRealDefault) {
			totalDefaultExports++; // Count all defaults for multi-default context

			// Check if default export is self-referential (points to a named export)
			const isSelfReferential = multidefault_isSelfReferential(rawMod);

			if (debug) {
				console.log(`[DEBUG] multidefault_analyzeModules: Checking ${file.name}`);
				console.log(`[DEBUG]   - fileName: ${fileName}`);
				console.log(`[DEBUG]   - has default: ${hasRealDefault}`);
				console.log(`[DEBUG]   - isSelfReferential: ${isSelfReferential}`);
			}

			if (!isSelfReferential) {
				// Track non-self-referential defaults
				defaultExportFiles.push({ fileName, rawModule: rawMod });
				if (debug) {
					console.log(`[DEBUG] Found default export in ${file.name} (non-self-referential)`);
				}
			} else {
				selfReferentialFiles.add(fileName); // Remember this file is self-referential
				if (debug) {
					console.log(`[DEBUG] Skipped ${file.name} - self-referential default export`);
				}
			}
		} else if (debug) {
			console.log(`[DEBUG] multidefault_analyzeModules: Checking ${file.name}`);
			console.log(`[DEBUG]   - fileName: ${fileName}`);
			console.log(`[DEBUG]   - has default: ${hasRealDefault}`);
			if (isCjsFile) {
				console.log(`[DEBUG]   - CJS file unwrapped from Node.js wrapper`);
			}
		}
	}

	// Multi-default context: triggered when there are multiple files with defaults (including self-referential)
	const hasMultipleDefaultExports = totalDefaultExports > 1;

	if (debug) {
		console.log(`[DEBUG] multidefault_analyzeModules results:`);
		console.log(`[DEBUG]   - selfReferentialFiles:`, Array.from(selfReferentialFiles));
		console.log(`[DEBUG]   - totalDefaultExports:`, totalDefaultExports);
		console.log(`[DEBUG]   - hasMultipleDefaultExports:`, hasMultipleDefaultExports);
		console.log(`[DEBUG]   - defaultExportFiles count:`, defaultExportFiles.length);
	}

	return {
		totalDefaultExports,
		hasMultipleDefaultExports,
		selfReferentialFiles,
		rawModuleCache,
		defaultExportFiles
	};
}

/**
 * Checks if a raw module's default export is self-referential (points to a named export).
 * @internal
 * @private
 * @param {object} rawModule - Raw module object to check
 * @returns {boolean} True if default export points to a named export
 * @example // Internal usage
 * const isSelfRef = multidefault_isSelfReferential(rawModule);
 */
function multidefault_isSelfReferential(rawModule) {
	if (!rawModule || !("default" in rawModule)) {
		return false;
	}

	// Check if default export is self-referential (points to a named export)
	return Object.entries(rawModule).some(([key, value]) => key !== "default" && value === rawModule.default);
}

/**
 * Determines auto-flattening behavior based on multi-default context and module structure.
 * @internal
 * @private
 * @param {object} options - Configuration options
 * @param {boolean} options.hasMultipleDefaultExports - Whether multiple default exports exist
 * @param {boolean} options.moduleHasDefault - Whether current module has default export
 * @param {boolean} options.isSelfReferential - Whether current module is self-referential
 * @param {Array<string>} options.moduleKeys - Named export keys from the module
 * @param {string} options.apiPathKey - API key for the module
 * @param {number} options.totalModuleCount - Total number of modules in directory
 * @param {boolean} [options.debug=false] - Enable debug logging
 * @returns {{
 *   shouldFlatten: boolean,
 *   flattenToRoot: boolean,
 *   preserveAsNamespace: boolean,
 *   reason: string
 * }} Flattening decision and reasoning
 * @example // Internal usage in processing logic
 * const decision = multidefault_getFlatteningDecision({
 *   hasMultipleDefaultExports: true,
 *   moduleHasDefault: false,
 *   isSelfReferential: false,
 *   moduleKeys: ["add", "subtract"],
 *   apiPathKey: "math",
 *   totalModuleCount: 3
 * });
 */
function multidefault_getFlatteningDecision(options) {
	const {
		hasMultipleDefaultExports,
		moduleHasDefault,
		isSelfReferential,
		moduleKeys,
		apiPathKey,
		totalModuleCount,
		debug = false
	} = options;

	if (debug) {
		console.log(`[DEBUG] multidefault_getFlatteningDecision: Analyzing flattening for ${apiPathKey}`);
		console.log(`[DEBUG]   - hasMultipleDefaultExports: ${hasMultipleDefaultExports}`);
		console.log(`[DEBUG]   - moduleHasDefault: ${moduleHasDefault}`);
		console.log(`[DEBUG]   - isSelfReferential: ${isSelfReferential}`);
		console.log(`[DEBUG]   - moduleKeys: [${moduleKeys.join(", ")}]`);
		console.log(`[DEBUG]   - totalModuleCount: ${totalModuleCount}`);
	}

	// Self-referential case: treat as namespace (don't flatten)
	if (isSelfReferential) {
		return {
			shouldFlatten: false,
			flattenToRoot: false,
			preserveAsNamespace: true,
			reason: "self-referential default export"
		};
	}

	// Multi-default context rules
	if (hasMultipleDefaultExports) {
		if (moduleHasDefault) {
			// Multi-default context: preserve modules WITH default exports as namespaces
			return {
				shouldFlatten: false,
				flattenToRoot: false,
				preserveAsNamespace: true,
				reason: "multi-default context with default export"
			};
		} else {
			// Multi-default context: flatten modules WITHOUT default exports to root
			return {
				shouldFlatten: true,
				flattenToRoot: true,
				preserveAsNamespace: false,
				reason: "multi-default context without default export"
			};
		}
	}

	// Traditional context (no multi-defaults)
	// Check for auto-flattening: if module has single named export matching filename, use it directly
	if (moduleKeys.length === 1 && moduleKeys[0] === apiPathKey) {
		return {
			shouldFlatten: true,
			flattenToRoot: false,
			preserveAsNamespace: false,
			reason: "single named export matching filename"
		};
	}

	// Auto-flatten: module has no default export, only named exports → flatten to root
	// Two cases: 1) Multiple defaults context (already handled above), 2) Single-file context
	// COMMENTED OUT: Rule 11 - reduces API path flexibility
	// if (!moduleHasDefault && moduleKeys.length > 0 && totalModuleCount === 1) {
	// 	return {
	// 		shouldFlatten: true,
	// 		flattenToRoot: true,
	// 		preserveAsNamespace: false,
	// 		reason: "single file with no default, only named exports"
	// 	};
	// }

	// Default case: preserve as namespace
	return {
		shouldFlatten: false,
		flattenToRoot: false,
		preserveAsNamespace: true,
		reason: "default namespace preservation"
	};
}

export { multidefault_analyzeModules, multidefault_isSelfReferential, multidefault_getFlatteningDecision };
