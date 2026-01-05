/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /src/lib/helpers/api_builder/remove_api.mjs
 *	@Date: 2026-01-04 00:00:00 -08:00
 *	@Author: Nate Hyson <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Hyson <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-01-04 00:00:00 -08:00
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview API removal functionality for cleaning up endpoints and ownership tracking.
 * @module @cldmv/slothlet/lib/helpers/api_builder/remove_api
 * @memberof module:@cldmv/slothlet.lib.helpers.api_builder
 * @internal
 *
 * @description
 * Provides functions for removing API endpoints from the slothlet API structure
 * and cleaning up module ownership registries. Supports removal by API path
 * or by module ID (all paths owned by a module).
 */

/**
 * @description
 * Removes a specific API path from the API structure and cleans up ownership tracking.
 *
 * @function removeApiPath
 * @memberof module:@cldmv/slothlet.lib.helpers.api_builder.remove_api
 * @async
 * @param {object} instance - Slothlet instance with api, boundapi, config, etc.
 * @param {string} apiPath - The API path to remove (e.g., "plugins.myModule")
 * @returns {Promise<boolean>} True if removed, false if path didn't exist
 * @throws {TypeError} If apiPath is not a non-empty string
 * @throws {Error} If apiPath contains empty segments
 * @internal
 *
 * @example
 * await removeApiPath(instance, "plugins.myModule");
 */
export async function removeApiPath(instance, apiPath) {
	if (!apiPath || typeof apiPath !== "string") {
		throw new TypeError("[slothlet] removeApiPath: apiPath must be a non-empty string");
	}

	const normalizedApiPath = apiPath.trim();
	const pathParts = normalizedApiPath.split(".");

	if (pathParts.some((part) => part === "")) {
		throw new Error(`[slothlet] removeApiPath: apiPath must not contain empty segments. Received: "${normalizedApiPath}"`);
	}

	// Navigate to the parent of the target
	let currentTarget = instance.api;
	let currentBoundTarget = instance.boundapi;

	for (let i = 0; i < pathParts.length - 1; i++) {
		const part = pathParts[i];
		const key = instance._toapiPathKey(part);

		if (!currentTarget[key]) {
			// Path doesn't exist, nothing to remove
			if (instance.config.debug) {
				console.log(`[DEBUG] removeApi: Path "${normalizedApiPath}" does not exist (stopped at "${pathParts.slice(0, i + 1).join(".")}")`);
			}
			return false;
		}

		currentTarget = currentTarget[key];
		currentBoundTarget = currentBoundTarget[key];
	}

	const finalKey = instance._toapiPathKey(pathParts[pathParts.length - 1]);

	if (!Object.prototype.hasOwnProperty.call(currentTarget, finalKey)) {
		if (instance.config.debug) {
			console.log(`[DEBUG] removeApi: Final key "${finalKey}" does not exist at path "${normalizedApiPath}"`);
		}
		return false;
	}

	// Remove from API structure
	delete currentTarget[finalKey];
	delete currentBoundTarget[finalKey];

	// Clean up ownership tracking
	if (instance.config.hotReload) {
		const moduleId = instance._moduleOwnership.get(normalizedApiPath);
		if (moduleId) {
			// Remove from moduleId -> apiPaths mapping
			const apiPaths = instance._moduleApiPaths.get(moduleId);
			if (apiPaths) {
				apiPaths.delete(normalizedApiPath);
				if (apiPaths.size === 0) {
					instance._moduleApiPaths.delete(moduleId);
				}
			}
			// Remove from apiPath -> moduleId mapping
			instance._moduleOwnership.delete(normalizedApiPath);
		}
	}

	// Clean up empty parent segments (working from deepest to shallowest)
	const cleanupParts = normalizedApiPath.split(".");
	for (let i = cleanupParts.length - 1; i > 0; i--) {
		const parentPath = cleanupParts.slice(0, i).join(".");
		const parentParts = parentPath.split(".");

		// Navigate to parent
		let target = instance.api;
		let boundTarget = instance.boundapi;
		for (let j = 0; j < parentParts.length - 1; j++) {
			const key = instance._toapiPathKey(parentParts[j]);
			if (!target[key]) break;
			target = target[key];
			boundTarget = boundTarget[key];
		}

		// Check if the parent segment is empty
		const parentKey = instance._toapiPathKey(parentParts[parentParts.length - 1]);
		if (target[parentKey] && typeof target[parentKey] === "object" && Object.keys(target[parentKey]).length === 0) {
			delete target[parentKey];
			delete boundTarget[parentKey];
			if (instance.config.debug) {
				console.log(`[DEBUG] removeApi: Cleaned up empty parent segment "${parentPath}"`);
			}
		} else {
			// Parent has content, stop cleaning up
			break;
		}
	}

	// Update live bindings
	instance.updateBindings(instance.context, instance.reference, instance.boundapi);

	if (instance.config.debug) {
		console.log(`[DEBUG] removeApi: Successfully removed API at "${normalizedApiPath}"`);
	}

	return true;
}

/**
 * @description
 * Removes all API paths owned by a specific module ID.
 *
 * @function removeApiByModuleId
 * @memberof module:@cldmv/slothlet.lib.helpers.api_builder.remove_api
 * @async
 * @param {object} instance - Slothlet instance with api, boundapi, config, etc.
 * @param {string} moduleId - The module identifier
 * @returns {Promise<boolean>} True if any paths were removed, false otherwise
 * @throws {TypeError} If moduleId is not a non-empty string
 * @internal
 *
 * @example
 * await removeApiByModuleId(instance, "myModule");
 */
export async function removeApiByModuleId(instance, moduleId) {
	if (!moduleId || typeof moduleId !== "string") {
		throw new TypeError("[slothlet] removeApiByModuleId: moduleId must be a non-empty string");
	}

	if (!instance.config.hotReload) {
		console.warn(`[slothlet] removeApi: hotReload is disabled. Module ID-based removal requires hotReload: true`);
		return false;
	}

	const apiPaths = instance._moduleApiPaths.get(moduleId);
	if (!apiPaths || apiPaths.size === 0) {
		if (instance.config.debug) {
			console.log(`[DEBUG] removeApi: No API paths found for moduleId "${moduleId}"`);
		}
		return false;
	}

	// Track removal for hot reload
	if (instance.config.hotReload) {
		instance._removeApiHistory.add(moduleId);
		// Remove from addApi history
		instance._addApiHistory = instance._addApiHistory.filter((entry) => entry.options?.moduleId !== moduleId);
	}

	// Create array copy since we'll be modifying the set during iteration
	const pathsToRemove = Array.from(apiPaths);

	if (instance.config.debug) {
		console.log(`[DEBUG] removeApi: Removing ${pathsToRemove.length} API paths for moduleId "${moduleId}":`, pathsToRemove);
	}

	let anyRemoved = false;
	for (const apiPath of pathsToRemove) {
		const removed = await removeApiPath(instance, apiPath);
		if (removed) anyRemoved = true;
	}

	return anyRemoved;
}
