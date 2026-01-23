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
import { mergeApiObjects } from "@cldmv/slothlet/helpers/api_assignment";

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
			reason: "must be a non-empty string",
			validationError: true
		});
	}

	const normalized = apiPath.trim();
	const parts = normalized.split(".");
	if (parts.length === 0 || parts.some((part) => part.trim() === "")) {
		throw new SlothletError("INVALID_CONFIG_API_PATH_INVALID", {
			apiPath: normalized,
			reason: "contains empty path segments",
			validationError: true
		});
	}

	if (parts[0] === "slothlet" || normalized === "shutdown" || normalized === "destroy") {
		throw new SlothletError("INVALID_CONFIG_API_PATH_INVALID", {
			apiPath: normalized,
			reason: "conflicts with reserved names (slothlet, shutdown, destroy)",
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
			reason: "path segment does not exist or is not traversable",
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
	console.log(`[syncWrapper ENTRY] existingProxy apiPath:`, existingProxy?.__wrapper?.apiPath);
	console.log(`[syncWrapper ENTRY] nextProxy apiPath:`, nextProxy?.__wrapper?.apiPath);

	if (!isWrapperProxy(existingProxy) || !isWrapperProxy(nextProxy)) {
		return false;
	}

	const existingWrapper = existingProxy.__wrapper || existingProxy;
	const nextWrapper = nextProxy.__wrapper || nextProxy;

	console.log(`[syncWrapper] existingWrapper.apiPath: ${existingWrapper.apiPath}`);
	console.log(`[syncWrapper] nextWrapper.apiPath: ${nextWrapper.apiPath}`);

	// Copy materialize function if present (lazy mode support)
	if (nextWrapper._materializeFunc) {
		existingWrapper._materializeFunc = nextWrapper._materializeFunc;
	}

	// THE ACTUAL FIX: Transfer _childCache entries directly
	// nextProxy.__impl is empty because buildAPI already moved everything to _childCache
	// We need to transfer the child wrappers from nextWrapper to existingWrapper
	if (nextWrapper._childCache && existingWrapper._childCache) {
		console.log(
			`[syncWrapper] Before merge - existing cache size: ${existingWrapper._childCache.size}, next cache size: ${nextWrapper._childCache.size}`
		);
		console.log(`[syncWrapper] Next wrapper _impl keys:`, Object.keys(nextWrapper._impl || {}));
		console.log(`[syncWrapper] Next wrapper _childCache keys:`, Array.from(nextWrapper._childCache.keys()));

		// Clear existing cache first
		existingWrapper._childCache.clear();

		// Transfer all child wrappers from next to existing
		// IMPORTANT: _childCache should contain PROXIES (from createProxy()), not raw wrappers
		for (const [key, childValue] of nextWrapper._childCache.entries()) {
			existingWrapper._childCache.set(key, childValue);
			if (existingWrapper._proxyTarget) {
				existingWrapper._proxyTarget[key] = childValue;
			}
		}

		console.log(`[syncWrapper] After merge - existing cache size: ${existingWrapper._childCache.size}`);
	}

	// Mark as materialized
	if (existingWrapper._state) {
		existingWrapper._state.materialized = true;
		existingWrapper._state.inFlight = false;
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
 * Uses unified mergeApiObjects logic from api_assignment.mjs to ensure consistent
 * merge behavior between initial build and hot reload.
 *
 * @example
 * await mutateApiValue(existing, next, { removeMissing: true });
 */
async function mutateApiValue(existingValue, nextValue, options) {
	console.log(`[mutateApiValue] called - existing type: ${typeof existingValue}, next type: ${typeof nextValue}`);
	console.log(`[mutateApiValue] existing isWrapper: ${isWrapperProxy(existingValue)}, next isWrapper: ${isWrapperProxy(nextValue)}`);
	console.log(`[mutateApiValue] nextValue:`, nextValue);
	console.log(`[mutateApiValue] nextValue keys:`, nextValue ? Object.keys(nextValue) : "N/A");

	if (existingValue === nextValue) {
		return;
	}

	// If both are wrapper proxies, sync them
	if (isWrapperProxy(existingValue) && isWrapperProxy(nextValue)) {
		console.log(`[mutateApiValue] Both are wrappers - calling syncWrapper`);
		await syncWrapper(existingValue, nextValue);
		return;
	}

	// If existing is a wrapper but next is a plain object with children,
	// merge each child into the wrapper instead of replacing
	if (isWrapperProxy(existingValue) && !isWrapperProxy(nextValue)) {
		// Check if next is an object or function with properties
		const nextIsObjectLike = nextValue && (typeof nextValue === "object" || typeof nextValue === "function");
		const nextHasKeys = nextIsObjectLike && Object.keys(nextValue).length > 0;

		if (nextHasKeys) {
			console.log(`[mutateApiValue] Merging object/function properties into existing wrapper`);
			console.log(`[mutateApiValue] nextValue keys:`, Object.keys(nextValue));
			// Merge each child from nextValue into the existing wrapper
			await mergeApiObjects(existingValue, nextValue, {
				removeMissing: options.removeMissing,
				mutateExisting: true,
				allowOverwrite: true,
				syncWrapper
			});
			return;
		}

		// Fallback: if nextValue has no properties, try __setImpl
		if (existingValue.__setImpl) {
			console.log(`[mutateApiValue] Using __setImpl fallback`);
			existingValue.__setImpl(nextValue?.__impl ?? nextValue);
			return;
		}
	}

	// Use unified merge logic for objects
	if (existingValue && typeof existingValue === "object" && nextValue && typeof nextValue === "object") {
		await mergeApiObjects(existingValue, nextValue, {
			removeMissing: options.removeMissing,
			mutateExisting: true,
			allowOverwrite: true,
			syncWrapper
		});
		return;
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
 * @param {string} [options.collisionMode] - Collision handling mode (skip/warn/replace/merge/error).
 * @param {object} [instance] - Slothlet instance for accessing config.
 * @returns {Promise<void>}
 * @throws {SlothletError} When overwrite is not allowed or collision mode is "error".
 * @private
 *
 * @description
 * Writes a new value at the requested path with configurable collision handling.
 * Supports five collision modes:
 * - skip: Silently ignore collision, keep existing
 * - warn: Warn about collision, keep existing
 * - replace: Replace existing value completely
 * - merge: Merge properties (preserve original + add new)
 * - error: Throw error on collision
 *
 * @example
 * await setValueAtPath(api, ["plugins"], newApi, {
 *   mutateExisting: true,
 *   allowOverwrite: true,
 *   collisionMode: "merge"
 * });
 */
async function setValueAtPath(root, parts, value, options, instance) {
	const parent = ensureParentPath(root, parts);
	const finalKey = parts[parts.length - 1];
	const existing = parent ? parent[finalKey] : undefined;
	const collisionMode = options.collisionMode || "merge";

	console.log(
		`[setValueAtPath] finalKey="${finalKey}", existing=${typeof existing}, value=${typeof value}, collisionMode=${collisionMode}, options:`,
		options
	);

	// Handle collision based on mode
	if (existing !== undefined) {
		if (collisionMode === "error") {
			throw new SlothletError("INVALID_CONFIG_API_PATH_INVALID", {
				apiPath: parts.join("."),
				reason: "path already exists and collision mode is 'error'",
				validationError: true,
				collisionMode: "error"
			});
		}

		if (collisionMode === "skip") {
			console.log(`[setValueAtPath] Skipping collision at ${parts.join(".")} (mode: skip)`);
			return;
		}

		if (collisionMode === "warn") {
			if (instance && !instance.config?.silent) {
				console.warn(`[slothlet] Warning: Path collision at ${parts.join(".")} - keeping existing value`);
			}
			return;
		}

		if (collisionMode === "replace") {
			console.log(`[setValueAtPath] Replacing value at ${parts.join(".")} (mode: replace)`);
			parent[finalKey] = value;
			return;
		}

		// Default: merge mode
		if (collisionMode === "merge") {
			const existingIsObject = typeof existing === "object" || typeof existing === "function";
			const valueIsObject = typeof value === "object" || typeof value === "function";

			if (existingIsObject && valueIsObject) {
				console.log("[setValueAtPath] Merging properties (mode: merge)");
				await mutateApiValue(existing, value, { removeMissing: false, allowOverwrite: true });
				return;
			} else {
				// Can't merge primitives - log warning and keep existing
				if (instance && !instance.config?.silent) {
					console.warn(`[slothlet] Warning: Cannot merge primitive values at ${parts.join(".")} - keeping existing`);
				}
				return;
			}
		}
	}

	// No collision - simple assignment
	console.log(`[setValueAtPath] No collision - assigning: parent["${finalKey}"] = value`);
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
		await setValueAtPath(
			instance.api,
			parts,
			baseValue,
			{
				mutateExisting: true,
				allowOverwrite: true
			},
			instance
		);
		await setValueAtPath(
			instance.boundApi,
			parts,
			baseValue,
			{
				mutateExisting: true,
				allowOverwrite: true
			},
			instance
		);
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

	// Determine collision handling based on config.collision.addApi
	const collisionMode = instance.config.collision.addApi || "merge";
	const allowOverwrite = !!(options.forceOverwrite || options.allowOverwrite || collisionMode === "replace" || collisionMode === "merge");
	const mutateExisting = !!(options.mutateExisting || collisionMode === "merge");

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
		ownership: instance.ownership,
		contextManager: instance.contextManager,
		instanceID: instance.instanceID,
		config: instance.config,
		apiPathPrefix: normalizedPath,
		collisionContext: "addApi"
	});

	console.log("\n=== [addApiComponent] buildAPI RETURN STRUCTURE ===");
	console.log("Top-level keys:", Object.keys(newApi));

	// Check if flattened children exist as top-level keys with dotted names
	const dottedKeys = Object.keys(newApi).filter((k) => k.includes("."));
	if (dottedKeys.length > 0) {
		console.log("FOUND DOTTED KEYS (flattened children as siblings!):", dottedKeys);
	}

	// Walk through ALL top-level entries to see the full structure
	for (const [key, value] of Object.entries(newApi)) {
		if (value?.__wrapper) {
			console.log(`\n[${key}] is a wrapper:`);
			console.log("  apiPath:", value.__wrapper.apiPath);
			console.log("  _impl keys:", Object.keys(value.__wrapper._impl || {}));
			console.log("  _childCache size:", value.__wrapper._childCache?.size);
			console.log("  _childCache keys:", Array.from(value.__wrapper._childCache?.keys() || []));

			// Check properties accessible via the proxy
			const proxyProps = Object.keys(value).filter((k) => k !== "__wrapper");
			console.log("  Proxy properties:", proxyProps);

			// For each proxy property, check if it's a wrapper
			for (const prop of proxyProps.slice(0, 3)) {
				// First 3 to avoid spam
				const child = value[prop];
				if (child?.__wrapper) {
					console.log(`    [${prop}] -> wrapper apiPath="${child.__wrapper.apiPath}"`);
				}
			}
		} else {
			console.log(`\n[${key}] is NOT a wrapper:`, typeof value);
		}
	}
	console.log("=== END buildAPI RETURN STRUCTURE ===\n");

	// Extract nested API if buildAPI returned { [apiPath]: {...} } structure
	// This happens when the folder contains a file matching the target path name
	// Example: api.add("config", folder) where folder has config.mjs WITHOUT apiPathPrefix
	// buildAPI returns { config: {...} }, we want just {...}
	//
	// HOWEVER: When apiPathPrefix is used, buildAPI returns the content directly
	// (e.g., { main: ..., config: ... } for apiPathPrefix="math"), so we use the whole newApi
	let apiToMerge = newApi;
	const finalKey = parts[parts.length - 1];
	const newApiKeys = Object.keys(newApi);
	console.log(`[addApiComponent] finalKey: ${finalKey}, newApiKeys:`, newApiKeys);

	// Only extract finalKey if we're NOT using apiPathPrefix (prefix means content is already structured)
	if (newApi[finalKey] !== undefined && !normalizedPath.includes(".")) {
		console.log(`[addApiComponent] Extracting ${finalKey}, isWrapper:`, isWrapperProxy(newApi[finalKey]));
		apiToMerge = newApi[finalKey];
		if (instance.config.debug?.api) {
			console.log(`[hot_reload] Extracted ${finalKey} from newApi:`, Object.keys(apiToMerge || {}));
		}
	} else {
		console.log(`[addApiComponent] Using full newApi as apiToMerge (apiPathPrefix mode or no finalKey match)`);
	}

	if (instance.config.debug?.api) {
		console.log(`[hot_reload] apiToMerge keys:`, Object.keys(apiToMerge));
	}

	await setValueAtPath(
		instance.api,
		parts,
		apiToMerge,
		{
			mutateExisting,
			allowOverwrite,
			collisionMode
		},
		instance
	);

	await setValueAtPath(
		instance.boundApi,
		parts,
		apiToMerge,
		{
			mutateExisting,
			allowOverwrite,
			collisionMode
		},
		instance
	);

	if (instance.ownership && moduleId) {
		registerOwnership(instance.ownership, moduleId, normalizedPath, apiToMerge);
	}

	if (instance.ownership) {
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
				await setValueAtPath(
					instance.api,
					pathParts,
					restoredValue,
					{
						mutateExisting: true,
						allowOverwrite: true
					},
					instance
				);
				await setValueAtPath(
					instance.boundApi,
					pathParts,
					restoredValue,
					{
						mutateExisting: true,
						allowOverwrite: true
					},
					instance
				);
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
				await setValueAtPath(
					instance.api,
					parts,
					restoredValue,
					{
						mutateExisting: true,
						allowOverwrite: true
					},
					instance
				);
				await setValueAtPath(
					instance.boundApi,
					parts,
					restoredValue,
					{
						mutateExisting: true,
						allowOverwrite: true
					},
					instance
				);
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
			reason: "apiPath is required for removeApi operation",
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
			await setValueAtPath(
				instance.api,
				parts,
				restoredValue,
				{
					mutateExisting: true,
					allowOverwrite: true
				},
				instance
			);
			await setValueAtPath(
				instance.boundApi,
				parts,
				restoredValue,
				{
					mutateExisting: true,
					allowOverwrite: true
				},
				instance
			);
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
