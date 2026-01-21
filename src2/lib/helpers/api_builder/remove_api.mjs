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
 * @param {string} [specificModuleId] - Optional: Remove only this moduleId's ownership. If current owner, trigger rollback.
 * @returns {Promise<boolean>} True if removed, false if path didn't exist
 * @throws {TypeError} If apiPath is not a non-empty string
 * @throws {Error} If apiPath contains empty segments
 * @internal
 *
 * @example
 * await removeApiPath(instance, "plugins.myModule");
 *
 * @example
 * // Remove specific module's ownership
 * await removeApiPath(instance, "plugins.myModule", "module-v2");
 */
export async function removeApiPath(instance, apiPath, specificModuleId = null) {
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

	// Check if we need rollback (ownership tracking enabled and path has multiple owners)
	let needsRollback = false;
	let rollbackModuleId = null;
	let removingModuleId = null;

	if (instance.config.hotReload && instance._moduleOwnership.has(normalizedApiPath)) {
		const owners = instance._moduleOwnership.get(normalizedApiPath);
		if (owners && owners.length > 0) {
			// If we're removing the current owner (last in array) and there are previous owners, we need rollback
			if (owners.length > 1) {
				// We'll determine which moduleId to remove later
				needsRollback = true;
			}
		}
	}

	// Only delete from API structure if NOT rolling back (to preserve references)
	// If rolling back, we'll update the existing entity in-place below
	if (!needsRollback) {
		if (instance.config.debug) {
			console.log(`[DEBUG] removeApi: Deleting "${normalizedApiPath}" (finalKey: "${finalKey}", needsRollback: ${needsRollback})`);
			console.log(
				`[DEBUG] removeApi: currentTarget type: ${typeof currentTarget}, has finalKey: ${Object.prototype.hasOwnProperty.call(currentTarget, finalKey)}`
			);
		}
		delete currentTarget[finalKey];
		delete currentBoundTarget[finalKey];
		if (instance.config.debug) {
			console.log(
				`[DEBUG] removeApi: After deletion - currentTarget has finalKey: ${Object.prototype.hasOwnProperty.call(currentTarget, finalKey)}`
			);
			console.log(`[DEBUG] removeApi: After deletion - api[${finalKey}]: ${instance.api[finalKey]}`);
		}
	}

	// Clean up ownership tracking and determine rollback target
	if (instance.config.hotReload) {
		const owners = instance._moduleOwnership.get(normalizedApiPath);
		if (owners && owners.length > 0) {
			// Determine which moduleId to remove
			if (specificModuleId) {
				// Remove specific moduleId
				const index = owners.indexOf(specificModuleId);
				if (index === -1) {
					if (instance.config.debug) {
						console.log(`[DEBUG] removeApi: moduleId "${specificModuleId}" not found in owners for "${normalizedApiPath}"`);
					}
					return false; // moduleId not an owner, nothing to remove
				}

				removingModuleId = specificModuleId;
				const wasCurrentOwner = index === owners.length - 1;

				if (wasCurrentOwner && owners.length > 1) {
					// Removing current owner with rollback available
					rollbackModuleId = owners[owners.length - 2];
					owners.splice(index, 1);

					if (instance.config.debug) {
						console.log(
							`[DEBUG] removeApi: Removed current owner "${removingModuleId}" from "${normalizedApiPath}", rolling back to "${rollbackModuleId}"`
						);
					}
				} else if (wasCurrentOwner) {
					// Removing sole owner
					instance._moduleOwnership.delete(normalizedApiPath);

					if (instance.config.debug) {
						console.log(`[DEBUG] removeApi: Removed sole owner "${removingModuleId}" from "${normalizedApiPath}"`);
					}
				} else {
					// Removing non-current owner (no rollback needed)
					owners.splice(index, 1);

					if (instance.config.debug) {
						console.log(
							`[DEBUG] removeApi: Removed non-current owner "${removingModuleId}" from "${normalizedApiPath}" (current remains: "${owners[owners.length - 1]}")`
						);
					}
				}
			} else {
				// No specific moduleId - remove current owner (last in array)
				removingModuleId = owners[owners.length - 1];

				if (owners.length > 1) {
					// Multiple owners - remove current and rollback to previous
					rollbackModuleId = owners[owners.length - 2];
					owners.pop(); // Remove current owner

					if (instance.config.debug) {
						console.log(
							`[DEBUG] removeApi: Removed current owner "${removingModuleId}" from "${normalizedApiPath}", rolling back to "${rollbackModuleId}"`
						);
					}
				} else {
					// Single owner - remove entirely
					instance._moduleOwnership.delete(normalizedApiPath);

					if (instance.config.debug) {
						console.log(`[DEBUG] removeApi: Removed sole owner "${removingModuleId}" from "${normalizedApiPath}"`);
					}
				}
			}

			// Remove from moduleId -> apiPaths mapping
			const apiPaths = instance._moduleApiPaths.get(removingModuleId);
			if (apiPaths) {
				apiPaths.delete(normalizedApiPath);
				if (apiPaths.size === 0) {
					instance._moduleApiPaths.delete(removingModuleId);
				}
			}
		}
	}

	// If rollback is needed, restore previous owner's implementation
	if (needsRollback && rollbackModuleId) {
		if (instance.config.debug) {
			console.log(`[DEBUG] removeApi: Performing rollback for "${normalizedApiPath}" to owner "${rollbackModuleId}"`);
		}

		// Special case: rolling back to "core" - need to reload from original directory
		if (rollbackModuleId === "core") {
			if (instance.config.debug) {
				console.log(`[DEBUG] removeApi: Rolling back to core implementation - reloading from original directory`);
			}

			// Re-execute initial load from original directory to restore core functions
			const { addApiFromFolder } = await import("./add_api.mjs");
			await addApiFromFolder({
				apiPath: normalizedApiPath,
				folderPath: instance.config.dir,
				instance,
				metadata: {},
				options: { moduleId: "core", forceOverwrite: true, mutateExisting: true }
			});

			if (instance.config.debug) {
				console.log(`[DEBUG] removeApi: Core rollback complete for "${normalizedApiPath}"`);
			}
		} else {
			// Find the addApi history entry for the rollback moduleId at this path
			const rollbackEntry = instance._addApiHistory.find(
				(entry) => entry.apiPath === normalizedApiPath && entry.options?.moduleId === rollbackModuleId
			);

			if (rollbackEntry) {
				// Re-execute the addApi to restore previous implementation
				const { addApiFromFolder } = await import("./add_api.mjs");
				await addApiFromFolder({
					apiPath: rollbackEntry.apiPath,
					folderPath: rollbackEntry.folderPath,
					instance,
					metadata: rollbackEntry.metadata || {},
					options: { ...rollbackEntry.options, forceOverwrite: true, mutateExisting: true }
				});

				if (instance.config.debug) {
					console.log(`[DEBUG] removeApi: Rollback complete for "${normalizedApiPath}"`);
				}
			} else if (instance.config.debug) {
				console.warn(`[DEBUG] removeApi: No addApi history found for rollback to "${rollbackModuleId}" at "${normalizedApiPath}"`);
			}
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
		if (process.env.DEBUG_API_BUILDER === "1" || process.env.DEBUG_API_BUILDER === "true") {
			console.warn(`[slothlet] removeApi: hotReload is disabled. Module ID-based removal requires hotReload: true`);
		}
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
		const before = instance._addApiHistory.length;
		instance._addApiHistory = instance._addApiHistory.filter((entry) => entry.options?.moduleId !== moduleId);
		const after = instance._addApiHistory.length;
		if (instance.config.debug) {
			console.log(
				`[DEBUG] removeApiByModuleId: Filtered _addApiHistory from ${before} to ${after} entries (removed ${before - after} with moduleId "${moduleId}")`
			);
		}
	}

	// Before removing, collect rollback information for each path
	const rollbackInfo = new Map(); // apiPath -> { needsRollback, rollbackModuleId }

	for (const apiPath of apiPaths) {
		const owners = instance._moduleOwnership.get(apiPath);
		if (owners && owners.length > 0) {
			const currentOwner = owners[owners.length - 1];
			if (currentOwner === moduleId && owners.length > 1) {
				// This moduleId is the current owner and there's a previous owner to rollback to
				const rollbackModuleId = owners[owners.length - 2];
				rollbackInfo.set(apiPath, { needsRollback: true, rollbackModuleId });

				if (instance.config.debug) {
					console.log(`[DEBUG] removeApi: Will rollback "${apiPath}" from "${moduleId}" to "${rollbackModuleId}"`);
				}
			}
		}
	}

	// Create array copy since we'll be modifying the set during iteration
	const pathsToRemove = Array.from(apiPaths);

	if (instance.config.debug) {
		console.log(`[DEBUG] removeApi: Removing ${pathsToRemove.length} API paths for moduleId "${moduleId}":`, pathsToRemove);
	}

	let anyRemoved = false;
	for (const apiPath of pathsToRemove) {
		if (instance.config.debug) {
			console.log(`[DEBUG] removeApiByModuleId: Calling removeApiPath for "${apiPath}" with moduleId "${moduleId}"`);
		}
		// Remove this specific moduleId's ownership from the path
		const removed = await removeApiPath(instance, apiPath, moduleId);
		if (instance.config.debug) {
			console.log(`[DEBUG] removeApiByModuleId: removeApiPath returned ${removed} for "${apiPath}"`);
		}
		if (removed) anyRemoved = true;
	}

	return anyRemoved;
}
