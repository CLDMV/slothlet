/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /src/lib/helpers/api_builder/add_api.mjs
 *	@Date: 2025-12-30 08:45:36 -08:00 (1767113136)
 *	@Author: Nate Hyson <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Hyson <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2025-12-30 08:52:51 -08:00 (1767113571)
 *	-----
 *	@Copyright: Copyright (c) 2013-2025 Catalyzed Motivation Inc. All rights reserved.
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

/**
 * Dynamically adds API modules from a new folder to the existing API at a specified path.
 *
 * @function addApiFromFolder
 * @memberof module:@cldmv/slothlet.lib.helpers.api_builder.add_api
 * @param {object} options - Configuration object
 * @param {string} options.apiPath - Dot-notation path where modules will be added
 * @param {string} options.folderPath - Path to folder containing modules to load
 * @param {object} options.instance - Slothlet instance with api, boundapi, config, modes, etc.
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
 */
export async function addApiFromFolder({ apiPath, folderPath, instance }) {
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

	// Resolve relative folder paths from the caller's location
	let resolvedFolderPath = folderPath;
	if (!path.isAbsolute(folderPath)) {
		resolvedFolderPath = resolvePathFromCaller(folderPath);
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

		// If target doesn't exist, create it
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
