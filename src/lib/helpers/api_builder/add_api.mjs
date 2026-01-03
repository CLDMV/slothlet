/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /src/lib/helpers/api_builder/add_api.mjs
 *	@Date: 2025-12-30 08:45:36 -08:00 (1767113136)
 *	@Author: Nate Hyson <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Hyson <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-01-01 11:30:10 -08:00 (1767295810)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Dynamic API extension functionality for adding modules at runtime.
 * @module @cldmv/slothlet/lib/helpers/api_builder/add_api
 * @memberof module:@cldmv/slothlet.lib.helpers.api_builder
 * @internal
 * @private
 *
 * @description
 * Provides the addApi functionality for dynamically loading and merging API modules
 * from a folder into a specified API path at runtime. Handles path validation,
 * folder verification, module loading (lazy/eager), path navigation, and safe merging
 * with overwrite protection.
 *
 * Key Features:
 * - Dynamic module loading from filesystem
 * - Dot-notation API path navigation
 * - Safe merging with existing API structures
 * - Overwrite protection via allowApiOverwrite config
 * - Support for both lazy and eager loading modes
 * - Automatic live-binding updates
 *
 * @example
 * // Internal usage in slothlet
 * import { addApiFromFolder } from "./add_api.mjs";
 *
 * await addApiFromFolder({
 *   apiPath: "runtime.plugins",
 *   folderPath: "./plugins",
 *   instance: slothletInstance
 * });
 */

import fs from "node:fs/promises";
import path from "node:path";
import { resolvePathFromCaller } from "@cldmv/slothlet/helpers/resolve-from-caller";
import { cleanMetadata, tagLoadedFunctions } from "./metadata.mjs";

/**
 * Dynamically adds API modules from a new folder to the existing API at a specified path.
 *
 * @function addApiFromFolder
 * @memberof module:@cldmv/slothlet.lib.helpers.api_builder.add_api
 * @param {object} options - Configuration object
 * @param {string} options.apiPath - Dot-notation path where modules will be added
 * @param {string} options.folderPath - Path to folder containing modules to load
 * @param {object} options.instance - Slothlet instance with api, boundapi, config, modes, etc.
 * @param {object} [options.metadata={}] - Metadata to attach to all loaded functions
 * @returns {Promise<void>}
 * @throws {Error} If API not loaded, invalid parameters, folder does not exist, or merge conflicts
 * @package
 *
 * @description
 * This function enables runtime extension of the API by loading modules from a folder
 * and merging them into a specified location in the API tree. It performs comprehensive
 * validation, supports both relative and absolute paths, handles intermediate object
 * creation, and respects the allowApiOverwrite configuration.
 *
 * The method performs the following steps:
 * 1. Validates that the API is loaded and the folder exists
 * 2. Resolves relative folder paths from the caller location
 * 3. Loads modules from the specified folder using the current loading mode
 * 4. Navigates to the specified API path, creating intermediate objects as needed
 * 5. Merges the new modules into the target location
 * 6. Updates all live bindings to reflect the changes
 *
 * @example
 * // Internal usage
 * import { addApiFromFolder } from "./add_api.mjs";
 *
 * // Add additional modules at runtime.plugins path
 * await addApiFromFolder({
 *   apiPath: "runtime.plugins",
 *   folderPath: "./plugins",
 *   instance: slothletInstance
 * });
 *
 * @example
 * // Add modules to root level
 * await addApiFromFolder({
 *   apiPath: "utilities",
 *   folderPath: "./utils",
 *   instance: slothletInstance
 * });
 *
 * @example
 * // Add deep nested modules
 * await addApiFromFolder({
 *   apiPath: "services.external.stripe",
 *   folderPath: "./services/stripe",
 *   instance: slothletInstance
 * });
 *
 * @example
 * // Add modules with metadata
 * await addApiFromFolder({
 *   apiPath: "plugins",
 *   folderPath: "./untrusted-plugins",
 *   instance: slothletInstance,
 *   metadata: {
 *     trusted: false,
 *     permissions: ["read"],
 *     version: "1.0.0",
 *     author: "external"
 *   }
 * });
 */
export async function addApiFromFolder({ apiPath, folderPath, instance, metadata = {} }) {
	if (!instance.loaded) {
		throw new Error("[slothlet] Cannot add API: API not loaded. Call create() or load() first.");
	}

	// Validate apiPath parameter
	if (typeof apiPath !== "string") {
		throw new TypeError("[slothlet] addApi: 'apiPath' must be a string.");
	}
	const normalizedApiPath = apiPath.trim();
	if (normalizedApiPath === "") {
		throw new TypeError("[slothlet] addApi: 'apiPath' must be a non-empty, non-whitespace string.");
	}
	const pathParts = normalizedApiPath.split(".");
	if (pathParts.some((part) => part === "")) {
		throw new Error(`[slothlet] addApi: 'apiPath' must not contain empty segments. Received: "${normalizedApiPath}"`);
	}

	// Validate folderPath parameter
	if (typeof folderPath !== "string") {
		throw new TypeError("[slothlet] addApi: 'folderPath' must be a string.");
	}

	// Resolve folder paths:
	// - If absolute: use as-is
	// - If relative: resolve from caller's location (where addApi was called)
	let resolvedFolderPath = folderPath;
	const isAbsolute = path.isAbsolute(folderPath);

	if (instance.config.debug) {
		console.log(`[DEBUG] addApi: folderPath="${folderPath}"`);
		console.log(`[DEBUG] addApi: isAbsolute=${isAbsolute}`);
	}

	if (!isAbsolute) {
		resolvedFolderPath = resolvePathFromCaller(folderPath);
		if (instance.config.debug) {
			console.log(`[DEBUG] addApi: Resolved relative path to: ${resolvedFolderPath}`);
		}
	}

	// Verify the folder exists
	let stats;
	try {
		stats = await fs.stat(resolvedFolderPath);
	} catch (error) {
		throw new Error(`[slothlet] addApi: Cannot access folder: ${resolvedFolderPath} - ${error.message}`);
	}
	if (!stats.isDirectory()) {
		throw new Error(`[slothlet] addApi: Path is not a directory: ${resolvedFolderPath}`);
	}

	if (instance.config.debug) {
		console.log(`[DEBUG] addApi: Loading modules from ${resolvedFolderPath} to path: ${normalizedApiPath}`);
	}

	// Load modules from the new folder using the appropriate mode
	let newModules;
	if (instance.config.lazy) {
		// Use lazy mode to create the API structure
		newModules = await instance.modes.lazy.create.call(instance, resolvedFolderPath, instance.config.apiDepth || Infinity, 0);
	} else {
		// Use eager mode to create the API structure
		newModules = await instance.modes.eager.create.call(instance, resolvedFolderPath, instance.config.apiDepth || Infinity, 0);
	}

	if (instance.config.debug) {
		console.log(`[DEBUG] addApi: Loaded modules structure:`, Object.keys(newModules || {}));
		console.log(`[DEBUG] addApi: Full newModules:`, newModules);
	}

	// Rule 6: AddApi Special File Pattern - Handle addapi.mjs flattening
	// Check if the loaded modules contain an 'addapi' key and flatten it
	if (newModules && typeof newModules === "object" && newModules.addapi) {
		if (instance.config.debug) {
			console.log(`[DEBUG] addApi: Found addapi.mjs - applying Rule 6 flattening`);
			console.log(`[DEBUG] addApi: Original structure:`, Object.keys(newModules));
			console.log(`[DEBUG] addApi: Addapi contents:`, Object.keys(newModules.addapi));
		}

		// Extract the addapi module content
		const addapiContent = newModules.addapi;

		// Remove the addapi key from newModules
		delete newModules.addapi;

		// Merge addapi content directly into the root level of newModules
		if (addapiContent && typeof addapiContent === "object") {
			// Handle both function exports and object exports
			Object.assign(newModules, addapiContent);

			if (instance.config.debug) {
				console.log(`[DEBUG] addApi: After addapi flattening:`, Object.keys(newModules));
			}
		} else if (typeof addapiContent === "function") {
			// If addapi exports a single function, merge its properties
			Object.assign(newModules, addapiContent);

			if (instance.config.debug) {
				console.log(`[DEBUG] addApi: Flattened addapi function with properties:`, Object.keys(newModules));
			}
		}
	}

	// Rule 7: AddApi Root-Level File Matching
	// Handle root-level files that match the API path segment by flattening them
	// The root-level file content should be merged at the API level, not replace subdirectory content
	const pathSegments = normalizedApiPath.split(".");
	const lastSegment = pathSegments[pathSegments.length - 1];
	let rootLevelFileContent = null;

	if (newModules && typeof newModules === "object" && newModules[lastSegment]) {
		if (instance.config.debug) {
			console.log(`[DEBUG] addApi: Found root-level file matching API path segment "${lastSegment}" - applying Rule 7 flattening`);
			console.log(`[DEBUG] addApi: Root-level file content:`, Object.keys(newModules[lastSegment]));
		}

		// Store the root-level file content for later merging
		rootLevelFileContent = newModules[lastSegment];

		// Remove the matching file from the structure so it doesn't interfere with subdirectory content
		delete newModules[lastSegment];

		if (instance.config.debug) {
			console.log(`[DEBUG] addApi: After removing root-level file, remaining structure:`, Object.keys(newModules));
		}
	}

	// Handle metadata tagging:
	// - If metadata provided: tag all functions with metadata
	// - If no metadata provided: clean any existing metadata (handles CJS module caching)
	if (newModules && metadata && typeof metadata === "object" && Object.keys(metadata).length > 0) {
		// Add sourceFolder to metadata
		const fullMetadata = {
			...metadata,
			sourceFolder: resolvedFolderPath
		};

		if (instance.config.debug) {
			console.log(`[DEBUG] addApi: Tagging functions with metadata:`, Object.keys(fullMetadata));
		}

		tagLoadedFunctions(newModules, fullMetadata, resolvedFolderPath);
	} else if (newModules) {
		// No metadata provided - clean any existing metadata from cached modules
		if (instance.config.debug) {
			console.log(`[DEBUG] addApi: Cleaning metadata from functions (no metadata provided)`);
		}
		cleanMetadata(newModules);
	}

	if (instance.config.debug) {
		if (newModules && typeof newModules === "object") {
			console.log(`[DEBUG] addApi: Loaded modules:`, Object.keys(newModules));
		} else {
			console.log(
				`[DEBUG] addApi: Loaded modules (non-object):`,
				typeof newModules === "function" ? `[Function: ${newModules.name || "anonymous"}]` : newModules
			);
		}
	}

	// Navigate to the target location in the API, creating intermediate objects as needed
	let currentTarget = instance.api;
	let currentBoundTarget = instance.boundapi;

	for (let i = 0; i < pathParts.length - 1; i++) {
		const part = pathParts[i];
		const key = instance._toapiPathKey(part);

		// Create intermediate objects if they don't exist
		// Allow both objects and functions as containers (slothlet's function.property pattern)
		// Functions are valid containers in JavaScript and can have properties added to them
		if (Object.prototype.hasOwnProperty.call(currentTarget, key)) {
			const existing = currentTarget[key];
			if (existing === null || (typeof existing !== "object" && typeof existing !== "function")) {
				throw new Error(
					`[slothlet] Cannot extend API path "${normalizedApiPath}" through segment "${part}": ` +
						`existing value is type "${typeof existing}", cannot add properties.`
				);
			}
			// At this point, existing is guaranteed to be an object or function
			// Both are valid containers that can be traversed and extended with properties
		} else {
			currentTarget[key] = {};
		}
		if (Object.prototype.hasOwnProperty.call(currentBoundTarget, key)) {
			const existingBound = currentBoundTarget[key];
			if (existingBound === null || (typeof existingBound !== "object" && typeof existingBound !== "function")) {
				throw new Error(
					`[slothlet] Cannot extend bound API path "${normalizedApiPath}" through segment "${part}": ` +
						`existing value is type "${typeof existingBound}", cannot add properties.`
				);
			}
			// At this point, existingBound is guaranteed to be an object or function
		} else {
			currentBoundTarget[key] = {};
		}

		// Navigate into the container (object or function) to continue path traversal
		currentTarget = currentTarget[key];
		currentBoundTarget = currentBoundTarget[key];
	}

	// Get the final key where we'll merge the new modules
	const finalKey = instance._toapiPathKey(pathParts[pathParts.length - 1]);

	// Merge the new modules into the target location
	if (typeof newModules === "function") {
		// If the loaded modules result in a function, set it directly
		// Check for existing value and handle based on allowApiOverwrite config
		if (Object.prototype.hasOwnProperty.call(currentTarget, finalKey)) {
			const existing = currentTarget[finalKey];

			// Check if overwrites are disabled
			if (instance.config.allowApiOverwrite === false) {
				console.warn(
					`[slothlet] Skipping addApi: API path "${normalizedApiPath}" final key "${finalKey}" ` +
						`already exists (type: "${typeof existing}"). Set allowApiOverwrite: true to allow overwrites.`
				);
				return; // Skip the overwrite
			}

			// Warn if overwriting an existing non-function value (potential data loss)
			if (existing !== null && typeof existing !== "function") {
				console.warn(
					`[slothlet] Overwriting existing non-function value at API path "${normalizedApiPath}" ` +
						`final key "${finalKey}" with a function. Previous type: "${typeof existing}".`
				);
			} else if (typeof existing === "function") {
				// Warn when replacing an existing function
				console.warn(
					`[slothlet] Overwriting existing function at API path "${normalizedApiPath}" ` + `final key "${finalKey}" with a new function.`
				);
			}
		}
		currentTarget[finalKey] = newModules;
		currentBoundTarget[finalKey] = newModules;
	} else if (typeof newModules === "object" && newModules !== null) {
		// Validate existing target is compatible (object or function, not primitive)
		if (Object.prototype.hasOwnProperty.call(currentTarget, finalKey)) {
			const existing = currentTarget[finalKey];

			// Check if overwrites are disabled and target already has content
			if (instance.config.allowApiOverwrite === false && existing !== undefined && existing !== null) {
				// For objects, check if they have any keys (non-empty)
				const hasContent = typeof existing === "object" ? Object.keys(existing).length > 0 : true;
				if (hasContent) {
					console.warn(
						`[slothlet] Skipping addApi merge: API path "${normalizedApiPath}" final key "${finalKey}" ` +
							`already exists with content (type: "${typeof existing}"). Set allowApiOverwrite: true to allow merging.`
					);
					return; // Skip the merge
				}
			}

			if (existing !== null && typeof existing !== "object" && typeof existing !== "function") {
				throw new Error(
					`[slothlet] Cannot merge API at "${normalizedApiPath}": ` +
						`existing value at final key "${finalKey}" is type "${typeof existing}", cannot merge into primitives.`
				);
			}
		}
		if (Object.prototype.hasOwnProperty.call(currentBoundTarget, finalKey)) {
			const existingBound = currentBoundTarget[finalKey];
			if (existingBound !== null && typeof existingBound !== "object" && typeof existingBound !== "function") {
				throw new Error(
					`[slothlet] Cannot merge bound API at "${normalizedApiPath}": ` +
						`existing value at final key "${finalKey}" is type "${typeof existingBound}", cannot merge into primitives.`
				);
			}
		}

		// Detect and materialize lazy proxies FIRST, before checking existence
		// Lazy proxies have __slothletPath property and are functions
		// To materialize: access a property (triggers _materialize), then await the proxy (waits for completion)
		const targetValue = currentTarget[finalKey];
		if (typeof targetValue === "function" && targetValue.__slothletPath) {
			// This is a lazy folder proxy - trigger materialization by accessing a property
			// then await the proxy to complete materialization and replacement
			const _ = targetValue.__trigger; // Trigger _materialize()
			await targetValue(); // Wait for materialization to complete
			// Now replacePlaceholder has replaced the proxy in currentTarget[finalKey] with the materialized object
		}

		const boundTargetValue = currentBoundTarget[finalKey];
		if (typeof boundTargetValue === "function" && boundTargetValue.__slothletPath) {
			// Trigger materialization and await completion
			const _ = boundTargetValue.__trigger;
			await boundTargetValue();
		}

		// If target doesn't exist (after materialization), create it
		if (!currentTarget[finalKey]) {
			currentTarget[finalKey] = {};
		}
		if (!currentBoundTarget[finalKey]) {
			currentBoundTarget[finalKey] = {};
		}

		// Merge new modules into existing object
		// Note: Object.assign performs shallow merge, which is intentional here.
		// We want to preserve references to the actual module exports, including
		// proxies (lazy mode) and function references (eager mode). Deep cloning
		// would break these references and lose the proxy/function behavior.
		Object.assign(currentTarget[finalKey], newModules);
		Object.assign(currentBoundTarget[finalKey], newModules);

		// Rule 7: Merge root-level file content if it was stored earlier
		if (rootLevelFileContent !== null) {
			if (instance.config.debug) {
				console.log(`[DEBUG] addApi: Merging root-level file content into API path "${normalizedApiPath}"`);
				console.log(`[DEBUG] addApi: Root-level file functions:`, Object.keys(rootLevelFileContent));
			}

			// Merge the root-level file content at the API level
			if (rootLevelFileContent && typeof rootLevelFileContent === "object") {
				Object.assign(currentTarget[finalKey], rootLevelFileContent);
				Object.assign(currentBoundTarget[finalKey], rootLevelFileContent);
			} else if (typeof rootLevelFileContent === "function") {
				// For function exports, add the function and any properties
				Object.assign(currentTarget[finalKey], rootLevelFileContent);
				Object.assign(currentBoundTarget[finalKey], rootLevelFileContent);
			}

			if (instance.config.debug) {
				console.log(`[DEBUG] addApi: After merging root-level file, final API structure:`, Object.keys(currentTarget[finalKey]));
			}
		}
	} else if (newModules === null || newModules === undefined) {
		// Warn when loaded modules result in null or undefined
		const receivedType = newModules === null ? "null" : "undefined";
		console.warn(
			`[slothlet] addApi: No modules loaded from folder at API path "${normalizedApiPath}". ` +
				`Loaded modules resulted in ${receivedType}. Check that the folder contains valid module files.`
		);
	} else {
		// Handle primitive values (string, number, boolean, symbol, bigint)
		// Set them directly like functions
		currentTarget[finalKey] = newModules;
		currentBoundTarget[finalKey] = newModules;
	}

	// Update live bindings to reflect the changes
	instance.updateBindings(instance.context, instance.reference, instance.boundapi);

	if (instance.config.debug) {
		console.log(`[DEBUG] addApi: Successfully added modules at ${normalizedApiPath}`);
	}
}
