/**
 * @fileoverview Hot reload helpers for adding, removing, and reloading API components at
 * runtime.
 * @module @cldmv/slothlet/helpers/hot_reload
 * @package
 *
 * @description
 * Provides runtime helpers that extend a loaded API with new modules, remove modules by path
 * or moduleId, and reapply additions to support hot reload workflows. This module stores
 * per-instance state externally and applies updates without requiring a full instance rebuild.
 *
 * @example
 * // Add a runtime folder into the API
 * await addApiComponent({
 * 	instance,
 * 	apiPath: "plugins",
 * 	folderPath: "./plugins",
 * 	options: { moduleId: "plugins-core" }
 * });
 */
import fs from "node:fs/promises";
import path from "node:path";
import { buildAPI } from "@cldmv/slothlet/builders/builder";
import { SlothletError } from "@cldmv/slothlet/errors";
import { resolvePathFromCaller } from "@cldmv/slothlet/helpers/resolve-from-caller";

const hotReloadState = new WeakMap();

/**
 * Get or initialize hot reload state for an instance.
 * @param {object} instance - Slothlet instance.
 * @returns {{ addHistory: Record<string, unknown>[], removedModuleIds: Set<string>,
 * initialConfig: object|null }}
 * @private
 *
 * @description
 * Creates an entry in the weak map on first access to track add/remove history
 * and preserve configuration for later reload operations.
 *
 * @example
 * const state = getHotReloadState(instance);
 */
function getHotReloadState(instance) {
	const existing = hotReloadState.get(instance);
	if (existing) {
		if (!existing.initialConfig && instance?.config) {
			existing.initialConfig = instance.config;
		}
		return existing;
	}

	const state = {
		addHistory: [],
		removedModuleIds: new Set(),
		initialConfig: instance?.config || null
	};
	hotReloadState.set(instance, state);
	return state;
}

/**
 * Normalize and validate an API path.
 * @param {string} apiPath - Dot-delimited API path.
 * @returns {{ apiPath: string, parts: string[] }} Normalized path data.
 * @throws {SlothletError} When apiPath is invalid.
 * @private
 *
 * @description
 * Ensures the API path is a non-empty string and contains no empty segments.
 *
 * @example
 * const { apiPath, parts } = normalizeApiPath("plugins.tools");
 */
function normalizeApiPath(apiPath) {
	if (!apiPath || typeof apiPath !== "string") {
		throw new SlothletError("INVALID_CONFIG_API_PATH_INVALID", {
			apiPath,
			validationError: true
		});
	}

	const normalized = apiPath.trim();
	const parts = normalized.split(".");
	if (parts.length === 0 || parts.some((part) => part.trim() === "")) {
		throw new SlothletError("INVALID_CONFIG_API_PATH_INVALID", {
			apiPath: normalized,
			validationError: true
		});
	}

	if (parts[0] === "slothlet" || normalized === "shutdown" || normalized === "destroy") {
		throw new SlothletError("INVALID_CONFIG_API_PATH_INVALID", {
			apiPath: normalized,
			validationError: true
		});
	}

	return { apiPath: normalized, parts };
}

/**
 * Resolve and validate a folder path from caller context.
 * @param {string} folderPath - Folder path provided by caller.
 * @returns {Promise<string>} Absolute folder path.
 * @throws {SlothletError} When the folder does not exist or is not a directory.
 * @private
 *
 * @description
 * Resolves relative paths from the caller and verifies the folder exists.
 *
 * @example
 * const resolved = await resolveFolderPath("./plugins");
 */
async function resolveFolderPath(folderPath) {
	if (!folderPath || typeof folderPath !== "string") {
		throw new SlothletError("INVALID_CONFIG_DIR_INVALID", {
			dir: folderPath,
			validationError: true
		});
	}

	const resolvedPath = resolvePathFromCaller(folderPath);
	try {
		const stats = await fs.stat(resolvedPath);
		if (!stats.isDirectory()) {
			throw new SlothletError("INVALID_CONFIG_DIR_INVALID", {
				dir: resolvedPath,
				validationError: true
			});
		}
	} catch (error) {
		if (error instanceof SlothletError) {
			throw error;
		}
		throw new SlothletError("INVALID_CONFIG_DIR_INVALID", {
			dir: resolvedPath,
			validationError: true
		});
	}

	return resolvedPath;
}

/**
 * Build a default moduleId when none is provided.
 * @param {string} apiPath - API path for this module.
 * @param {string} resolvedFolderPath - Absolute folder path.
 * @returns {string} Stable module identifier.
 * @private
 *
 * @description
 * Generates a stable moduleId using the apiPath and resolved folder path.
 *
 * @example
 * const moduleId = buildDefaultModuleId("plugins", "/abs/path/plugins");
 */
function buildDefaultModuleId(apiPath, resolvedFolderPath) {
	const folderName = path.basename(resolvedFolderPath);
	return `${apiPath}:${folderName}`;
}

/**
 * Read the current value at an API path.
 * @param {function|object} root - API root object.
 * @param {string[]} parts - Path segments.
 * @returns {unknown} Current value or undefined.
 * @private
 *
 * @description
 * Traverses the API graph by path segments and returns the value if found.
 *
 * @example
 * const value = getValueAtPath(api, ["plugins", "tools"]);
 */
function getValueAtPath(root, parts) {
	let current = root;
	for (const part of parts) {
		if (!current || (typeof current !== "object" && typeof current !== "function")) {
			return undefined;
		}
		current = current[part];
	}
	return current;
}

/**
 * Ensure parent path exists and return the parent object.
 * @param {function|object} root - API root object.
 * @param {string[]} parts - Path segments.
 * @returns {function|object} Parent container for the final segment.
 * @throws {SlothletError} When a non-object path segment blocks creation.
 * @private
 *
 * @description
 * Walks through the path segments, creating missing objects as needed.
 *
 * @example
 * const parent = ensureParentPath(api, ["plugins", "tools"]);
 */
function ensureParentPath(root, parts) {
	let current = root;
	for (let i = 0; i < parts.length - 1; i += 1) {
		const part = parts[i];
		const next = current[part];
		if (next === undefined) {
			current[part] = {};
			current = current[part];
			continue;
		}
		if (next && (typeof next === "object" || typeof next === "function")) {
			current = next;
			continue;
		}
		throw new SlothletError("INVALID_CONFIG_API_PATH_INVALID", {
			apiPath: parts.slice(0, i + 1).join("."),
			validationError: true
		});
	}
	return current;
}

/**
 * Determine whether a value is a UnifiedWrapper proxy.
 * @param {unknown} value - Value to inspect.
 * @returns {boolean} True when value looks like a wrapper proxy.
 * @private
 *
 * @description
 * Checks for wrapper markers that are exposed on UnifiedWrapper proxies.
 *
 * @example
 * if (isWrapperProxy(api.plugins)) {
 * 	// Update wrapper implementation
 * }
 */
function isWrapperProxy(value) {
	return !!(
		value &&
		(typeof value === "object" || typeof value === "function") &&
		(value.__wrapper || value.__setImpl || value.__getState)
	);
}

/**
 * Synchronize an existing wrapper proxy with a new wrapper.
 * @param {function|object} existingProxy - Existing wrapper proxy.
 * @param {function|object} nextProxy - New wrapper proxy.
 * @returns {Promise<boolean>} True when a wrapper update occurred.
 * @private
 *
 * @description
 * Copies materialization behavior and implementation from the new proxy into the existing
 * proxy to preserve references during reload operations.
 *
 * @example
 * await syncWrapper(existingProxy, nextProxy);
 */
async function syncWrapper(existingProxy, nextProxy) {
	if (!isWrapperProxy(existingProxy) || !isWrapperProxy(nextProxy)) {
		return false;
	}

	const existingWrapper = existingProxy.__wrapper || existingProxy;
	const nextWrapper = nextProxy.__wrapper || nextProxy;
	const existingState = existingProxy.__getState ? existingProxy.__getState() : existingWrapper._state;
	const nextState = nextProxy.__getState ? nextProxy.__getState() : nextWrapper._state;

	if (nextWrapper._materializeFunc) {
		existingWrapper._materializeFunc = nextWrapper._materializeFunc;
	}

	if (nextState?.materialized) {
		if (nextProxy.__materialize) {
			await nextProxy.__materialize();
		}
		if (existingProxy.__setImpl) {
			existingProxy.__setImpl(nextProxy.__impl);
		}
	} else if (existingState?.materialized && nextProxy.__materialize) {
		await nextProxy.__materialize();
		if (existingProxy.__setImpl) {
			existingProxy.__setImpl(nextProxy.__impl);
		}
	} else if (existingProxy.__setImpl && nextProxy.__impl !== undefined) {
		existingProxy.__setImpl(nextProxy.__impl);
	}

	return true;
}

/**
 * Recursively mutate an existing API value to match a new value.
 * @param {function|object} existingValue - Existing value to mutate.
 * @param {unknown} nextValue - New value to apply.
 * @param {object} options - Mutation options.
 * @param {boolean} options.removeMissing - Remove properties not present in nextValue.
 * @returns {Promise<void>}
 * @private
 *
 * @description
 * Mutates objects and wrapper proxies in place to preserve references during reload.
 *
 * @example
 * await mutateApiValue(existing, next, { removeMissing: true });
 */
async function mutateApiValue(existingValue, nextValue, options) {
	if (existingValue === nextValue) {
		return;
	}

	if (isWrapperProxy(existingValue)) {
		if (isWrapperProxy(nextValue)) {
			await syncWrapper(existingValue, nextValue);
			return;
		}

		if (existingValue.__setImpl) {
			existingValue.__setImpl(nextValue?.__impl ?? nextValue);
			return;
		}
	}

	if (existingValue && typeof existingValue === "object" && nextValue && typeof nextValue === "object") {
		const nextKeys = new Set(Object.keys(nextValue));
		for (const key of nextKeys) {
			if (Object.prototype.hasOwnProperty.call(existingValue, key)) {
				await mutateApiValue(existingValue[key], nextValue[key], options);
			} else {
				existingValue[key] = nextValue[key];
			}
		}

		if (options.removeMissing) {
			for (const key of Object.keys(existingValue)) {
				if (!nextKeys.has(key)) {
					delete existingValue[key];
				}
			}
		}
	}
}

/**
 * Set a value at a path within an API root.
 * @param {function|object} root - API root object.
 * @param {string[]} parts - Path segments.
 * @param {unknown} value - New value to assign.
 * @param {object} options - Assignment options.
 * @param {boolean} options.mutateExisting - Mutate existing values in place.
 * @param {boolean} options.allowOverwrite - Allow overwriting existing values.
 * @returns {Promise<void>}
 * @throws {SlothletError} When overwrite is not allowed.
 * @private
 *
 * @description
 * Writes a new value at the requested path, optionally mutating existing objects.
 *
 * @example
 * await setValueAtPath(api, ["plugins"], newApi, { mutateExisting: true, allowOverwrite: true });
 */
async function setValueAtPath(root, parts, value, options) {
	const parent = ensureParentPath(root, parts);
	const finalKey = parts[parts.length - 1];
	const existing = parent ? parent[finalKey] : undefined;
	if (existing !== undefined && !options.allowOverwrite && !options.mutateExisting) {
		throw new SlothletError("INVALID_CONFIG_API_PATH_INVALID", {
			apiPath: parts.join("."),
			validationError: true
		});
	}

	if (existing !== undefined && options.mutateExisting) {
		await mutateApiValue(existing, value, { removeMissing: true });
		return;
	}

	parent[finalKey] = value;
}

/**
 * Delete a value at a path and prune empty parents.
 * @param {function|object} root - API root object.
 * @param {string[]} parts - Path segments.
 * @returns {boolean} True when a value was deleted.
 * @private
 *
 * @description
 * Removes the property at the provided path and cleans up any empty parent objects.
 *
 * @example
 * const deleted = deletePath(api, ["plugins", "tools"]);
 */
function deletePath(root, parts) {
	let current = root;
	const stack = [];
	for (const part of parts.slice(0, -1)) {
		if (!current || (typeof current !== "object" && typeof current !== "function")) {
			return false;
		}
		stack.push({ parent: current, key: part });
		current = current[part];
	}

	const finalKey = parts[parts.length - 1];
	if (!current || (typeof current !== "object" && typeof current !== "function")) {
		return false;
	}
	if (!Object.prototype.hasOwnProperty.call(current, finalKey)) {
		return false;
	}
	delete current[finalKey];

	for (let i = stack.length - 1; i >= 0; i -= 1) {
		const { parent, key } = stack[i];
		const value = parent[key];
		if (value && typeof value === "object" && Object.keys(value).length === 0) {
			delete parent[key];
		}
	}

	return true;
}

/**
 * Register ownership for a subtree using a single moduleId.
 * @param {object} ownership - Ownership manager.
 * @param {string} moduleId - Module identifier.
 * @param {string} apiPath - Base API path.
 * @param {unknown} value - Value at the base path.
 * @returns {void}
 * @private
 *
 * @description
 * Registers the base path and child paths with the ownership manager, allowing
 * overwrite conflicts so hot reload can stack modules.
 *
 * @example
 * registerOwnership(ownership, "plugins-core", "plugins", api.plugins);
 */
function registerOwnership(ownership, moduleId, apiPath, value) {
	if (!ownership || !moduleId) {
		return;
	}

	const registerRecursive = (currentValue, pathParts) => {
		const pathKey = pathParts.join(".");
		ownership.register({
			moduleId,
			apiPath: pathKey,
			value: currentValue,
			source: "add",
			allowConflict: true
		});

		if (currentValue && (typeof currentValue === "object" || typeof currentValue === "function") && !Array.isArray(currentValue)) {
			for (const [key, child] of Object.entries(currentValue)) {
				registerRecursive(child, [...pathParts, key]);
			}
		}
	};

	registerRecursive(value, apiPath.split("."));
}

/**
 * Remove a module ownership entry for a path.
 * @param {object} ownership - Ownership manager.
 * @param {string} apiPath - API path to modify.
 * @param {?string} moduleId - Specific moduleId to remove (or current owner if null).
 * @returns {{ action: "delete"|"none"|"restore", removedModuleId: string|null, restoreModuleId: string|null }}
 * @private
 *
 * @description
 * Updates ownership maps for a single path without removing other paths owned by the module.
 *
 * @example
 * const result = removeOwnershipEntry(ownership, "plugins.tools", null);
 */
function removeOwnershipEntry(ownership, apiPath, moduleId) {
	if (!ownership || typeof ownership.removePath !== "function") {
		return { action: "none", removedModuleId: null, restoreModuleId: null };
	}

	return ownership.removePath(apiPath, moduleId ?? null);
}

/**
 * Restore a path from addApi history or core load.
 * @param {object} instance - Slothlet instance.
 * @param {string} apiPath - API path to restore.
 * @param {?string} moduleId - ModuleId to restore.
 * @returns {Promise<void>}
 * @private
 *
 * @description
 * Attempts to reapply a previous addApi entry or rebuild the core API for the path.
 *
 * @example
 * await restoreApiPath(instance, "plugins", "plugins-core");
 */
async function restoreApiPath(instance, apiPath, moduleId) {
	const state = getHotReloadState(instance);
	const normalizedModuleId = moduleId || null;
	const historyEntry = state.addHistory
		.slice()
		.reverse()
		.find((entry) => entry.apiPath === apiPath && (normalizedModuleId ? entry.moduleId === normalizedModuleId : true));

	if (historyEntry) {
		await addApiComponent({
			instance,
			apiPath: historyEntry.apiPath,
			folderPath: historyEntry.folderPath,
			metadata: historyEntry.metadata,
			options: {
				...historyEntry.options,
				mutateExisting: true,
				forceOverwrite: true,
				recordHistory: false
			}
		});
		return;
	}

	if (normalizedModuleId === "base" || normalizedModuleId === "core") {
		const baseApi = await buildAPI({
			dir: instance.config.dir,
			mode: instance.config.mode,
			ownership: null,
			contextManager: instance.contextManager,
			instanceID: instance.instanceID,
			config: instance.config
		});

		const { parts } = normalizeApiPath(apiPath);
		const baseValue = getValueAtPath(baseApi, parts);
		if (baseValue === undefined) {
			deletePath(instance.api, parts);
			deletePath(instance.boundApi, parts);
			return;
		}
		await setValueAtPath(instance.api, parts, baseValue, {
			mutateExisting: true,
			allowOverwrite: true
		});
		await setValueAtPath(instance.boundApi, parts, baseValue, {
			mutateExisting: true,
			allowOverwrite: true
		});
	}
}

/**
 * Add new API modules at runtime.
 * @param {object} params - Add parameters.
 * @param {object} params.instance - Slothlet instance.
 * @param {string} params.apiPath - API path to attach.
 * @param {string} params.folderPath - Folder path to load.
 * @param {Record<string, unknown>} [params.metadata={}] - Optional metadata.
 * @param {Record<string, unknown>} [params.options={}] - Add options.
 * @returns {Promise<void>}
 * @throws {SlothletError} When the instance is not loaded or inputs are invalid.
 * @package
 *
 * @description
 * Loads modules from a folder using the instance configuration and merges the resulting
 * API under the specified apiPath.
 *
 * @example
 * await addApiComponent({
 * 	instance,
 * 	apiPath: "plugins",
 * 	folderPath: "./plugins",
 * 	options: { moduleId: "plugins-core" }
 * });
 */
export async function addApiComponent(params) {
	const { instance, apiPath, folderPath, metadata = {}, options = {} } = params || {};
	if (!instance || !instance.isLoaded) {
		throw new SlothletError("INVALID_CONFIG_NOT_LOADED", {
			operation: "addApi",
			validationError: true
		});
	}

	const { apiPath: normalizedPath, parts } = normalizeApiPath(apiPath);
	const resolvedFolderPath = await resolveFolderPath(folderPath);
	const allowOverwrite = !!(options.forceOverwrite || options.allowOverwrite || options.mutateExisting);
	const moduleId = options.moduleId ? String(options.moduleId) : buildDefaultModuleId(normalizedPath, resolvedFolderPath);
	if ((options.forceOverwrite || options.allowOverwrite) && !moduleId) {
		throw new SlothletError("INVALID_CONFIG_FORCE_OVERWRITE_REQUIRES_MODULE_ID", {
			apiPath: normalizedPath,
			validationError: true
		});
	}

	const newApi = await buildAPI({
		dir: resolvedFolderPath,
		mode: instance.config.mode,
		ownership: null,
		contextManager: instance.contextManager,
		instanceID: instance.instanceID,
		config: instance.config
	});

	await setValueAtPath(instance.api, parts, newApi, {
		mutateExisting: !!options.mutateExisting,
		allowOverwrite
	});
	await setValueAtPath(instance.boundApi, parts, newApi, {
		mutateExisting: !!options.mutateExisting,
		allowOverwrite
	});

	if (instance.ownership && moduleId) {
		registerOwnership(instance.ownership, moduleId, normalizedPath, newApi);
	}

	const state = getHotReloadState(instance);
	if (options.recordHistory !== false) {
		state.addHistory.push({
			apiPath: normalizedPath,
			folderPath: resolvedFolderPath,
			metadata,
			options: { ...options, moduleId },
			moduleId
		});
	}

	if (moduleId) {
		state.removedModuleIds.delete(moduleId);
	}
}

/**
 * Remove API modules at runtime.
 * @param {object} params - Remove parameters.
 * @param {object} params.instance - Slothlet instance.
 * @param {?string} params.apiPath - API path to remove.
 * @param {?string} params.moduleId - ModuleId to remove.
 * @returns {Promise<void>}
 * @throws {SlothletError} When inputs are invalid.
 * @package
 *
 * @description
 * Removes an API subtree by apiPath or removes all paths owned by a moduleId.
 *
 * @example
 * await removeApiComponent({ instance, apiPath: "plugins.tools" });
 */
export async function removeApiComponent(params) {
	const { instance, apiPath, moduleId } = params || {};
	if (!instance || !instance.isLoaded) {
		throw new SlothletError("INVALID_CONFIG_NOT_LOADED", {
			operation: "removeApi",
			validationError: true
		});
	}

	const state = getHotReloadState(instance);
	if (apiPath && moduleId) {
		const normalizedPath = normalizeApiPath(apiPath).apiPath;
		const moduleIdKey = String(moduleId);
		const history = instance.ownership?.getPathHistory?.(normalizedPath) || [];
		const ownershipResult = removeOwnershipEntry(instance.ownership, normalizedPath, moduleIdKey);
		const pathParts = normalizeApiPath(apiPath).parts;
		if (ownershipResult.action === "delete") {
			deletePath(instance.api, pathParts);
			deletePath(instance.boundApi, pathParts);
			return;
		}
		if (ownershipResult.action === "restore") {
			const restoredValue = instance.ownership?.getCurrentValue?.(normalizedPath);
			if (restoredValue !== undefined) {
				await setValueAtPath(instance.api, pathParts, restoredValue, {
					mutateExisting: true,
					allowOverwrite: true
				});
				await setValueAtPath(instance.boundApi, pathParts, restoredValue, {
					mutateExisting: true,
					allowOverwrite: true
				});
				return;
			}
			await restoreApiPath(instance, normalizedPath, ownershipResult.restoreModuleId);
			return;
		}
		if (ownershipResult.action === "none" && history.length === 0) {
			deletePath(instance.api, pathParts);
			deletePath(instance.boundApi, pathParts);
		}
		return;
	}

	if (moduleId) {
		const moduleIdKey = String(moduleId);
		const result = instance.ownership?.unregister?.(moduleIdKey) || { removed: [], rolledBack: [] };
		for (const removedPath of result.removed) {
			const { parts } = normalizeApiPath(removedPath);
			deletePath(instance.api, parts);
			deletePath(instance.boundApi, parts);
		}
		for (const rollback of result.rolledBack) {
			const { parts } = normalizeApiPath(rollback.apiPath);
			const restoredValue = instance.ownership?.getCurrentValue?.(rollback.apiPath);
			if (restoredValue !== undefined) {
				await setValueAtPath(instance.api, parts, restoredValue, {
					mutateExisting: true,
					allowOverwrite: true
				});
				await setValueAtPath(instance.boundApi, parts, restoredValue, {
					mutateExisting: true,
					allowOverwrite: true
				});
			} else {
				await restoreApiPath(instance, rollback.apiPath, rollback.restoredTo);
			}
		}

		state.removedModuleIds.add(moduleIdKey);
		state.addHistory = state.addHistory.filter((entry) => String(entry.moduleId) !== moduleIdKey);
		return;
	}

	if (!apiPath) {
		throw new SlothletError("INVALID_CONFIG_API_PATH_INVALID", {
			apiPath,
			validationError: true
		});
	}

	const { apiPath: normalizedPath, parts } = normalizeApiPath(apiPath);
	const ownershipResult = removeOwnershipEntry(instance.ownership, normalizedPath, null);
	if (ownershipResult.action === "none") {
		deletePath(instance.api, parts);
		deletePath(instance.boundApi, parts);
		return;
	}
	if (ownershipResult.action === "delete") {
		deletePath(instance.api, parts);
		deletePath(instance.boundApi, parts);
		return;
	}
	if (ownershipResult.action === "restore") {
		const restoredValue = instance.ownership?.getCurrentValue?.(normalizedPath);
		if (restoredValue !== undefined) {
			await setValueAtPath(instance.api, parts, restoredValue, {
				mutateExisting: true,
				allowOverwrite: true
			});
			await setValueAtPath(instance.boundApi, parts, restoredValue, {
				mutateExisting: true,
				allowOverwrite: true
			});
			return;
		}
		await restoreApiPath(instance, normalizedPath, ownershipResult.restoreModuleId);
	}
}

/**
 * Reload API modules from addApi history.
 * @param {object} params - Reload parameters.
 * @param {object} params.instance - Slothlet instance.
 * @param {?string} params.apiPath - API path to reload.
 * @param {?string} params.moduleId - ModuleId to reload.
 * @returns {Promise<void>}
 * @package
 *
 * @description
 * Replays recorded addApi calls using mutateExisting to preserve references.
 *
 * @example
 * await reloadApiComponent({ instance, apiPath: "plugins" });
 */
export async function reloadApiComponent(params) {
	const { instance, apiPath, moduleId } = params || {};
	if (!instance || !instance.isLoaded) {
		throw new SlothletError("INVALID_CONFIG_NOT_LOADED", {
			operation: "reloadApi",
			validationError: true
		});
	}

	const state = getHotReloadState(instance);
	let entries = state.addHistory;
	if (apiPath) {
		const normalizedPath = normalizeApiPath(apiPath).apiPath;
		entries = entries.filter((entry) => entry.apiPath === normalizedPath);
	} else if (moduleId) {
		entries = entries.filter((entry) => entry.moduleId === moduleId);
	}

	if (entries.length === 0 && apiPath) {
		await restoreApiPath(instance, normalizeApiPath(apiPath).apiPath, "base");
		return;
	}

	for (const entry of entries) {
		if (entry.moduleId && state.removedModuleIds.has(entry.moduleId)) {
			continue;
		}
		await addApiComponent({
			instance,
			apiPath: entry.apiPath,
			folderPath: entry.folderPath,
			metadata: entry.metadata,
			options: {
				...entry.options,
				mutateExisting: true,
				forceOverwrite: true,
				recordHistory: false
			}
		});
	}
}
