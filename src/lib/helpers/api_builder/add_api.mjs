/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /src/lib/helpers/api_builder/add_api.mjs
 *	@Date: 2025-12-30 08:45:36 -08:00 (1767113136)
 *	@Author: Nate Hyson <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Hyson <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-01-12 21:14:46 -08:00 (1768281286)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * Creates a wrapper function that can have its implementation updated without
 * changing its reference. Used for hot-reload support.
 *
 * @param {Function} fn - The function to wrap
 * @returns {Function} Wrapper function with _impl property for updates
 */
function createFunctionWrapper(fn) {
	// Create wrapper function that delegates to stored implementation
	// Use the original function name if available
	const funcName = fn.name || "anonymous";
	const wrapper = {
		[funcName]: function (...args) {
			return wrapper[funcName]._impl.apply(this, args);
		}
	}[funcName];

	// Store implementation and mark as wrapped
	wrapper._impl = fn;
	Object.defineProperty(wrapper, "_slothletWrapped", {
		value: true,
		writable: false,
		enumerable: false,
		configurable: false
	});

	// Copy properties from original function
	const props = Object.keys(fn);
	for (const prop of props) {
		wrapper[prop] = fn[prop];
	}

	// Copy non-enumerable slothlet properties
	if (fn.__owners) wrapper.__owners = fn.__owners;
	if (fn.__slothletPath) wrapper.__slothletPath = fn.__slothletPath;
	if (fn.__metadata) wrapper.__metadata = fn.__metadata;

	return wrapper;
}

/**
 * Recursively wraps all functions in an object for hot-reload support.
 * @param {any} obj - Object to process
 * @param {WeakSet} [visited] - Tracks visited objects to prevent loops
 */
function wrapFunctionsRecursively(obj, visited = new WeakSet()) {
	if (!obj || typeof obj !== "object") return;
	if (visited.has(obj)) return;
	visited.add(obj);

	for (const key of Object.keys(obj)) {
		const value = obj[key];
		// Only wrap if it's a function AND not already wrapped
		if (typeof value === "function" && !value._slothletWrapped) {
			obj[key] = createFunctionWrapper(value);
		} else if (value && typeof value === "object") {
			wrapFunctionsRecursively(value, visited);
		}
	}
}

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
import { tagLoadedFunctions } from "./metadata.mjs";
import { removeApiByModuleId } from "./remove_api.mjs";

/**
 * Recursively add moduleId as owner to all objects/functions
 * @param {object} obj - Object to mark
 * @param {string} moduleId - Module identifier
 * @param {WeakSet} visited - Visited objects
 */
function addOwnership(obj, moduleId, visited = new WeakSet()) {
	if (!obj || (typeof obj !== "object" && typeof obj !== "function")) return;
	if (visited.has(obj)) return;
	visited.add(obj);

	// Add __owners array if not present
	if (!obj.__owners) {
		Object.defineProperty(obj, "__owners", {
			value: [],
			writable: true,
			enumerable: false,
			configurable: true
		});
	}

	// Add moduleId if not already present
	if (!obj.__owners.includes(moduleId)) {
		obj.__owners.push(moduleId);
	}

	// Recursively mark nested objects
	for (const key of Object.keys(obj)) {
		if (key !== "__owners" && key !== "__metadata" && key !== "__slothletPath") {
			addOwnership(obj[key], moduleId, visited);
		}
	}
}

/**
 * Recursively remove moduleId from owners
 * @param {object} obj - Object to update
 * @param {string} moduleId - Module identifier
 * @param {WeakSet} visited - Visited objects
 */
function removeOwnership(obj, moduleId, visited = new WeakSet()) {
	if (!obj || (typeof obj !== "object" && typeof obj !== "function")) return;
	if (visited.has(obj)) return;
	visited.add(obj);

	// Remove moduleId from owners
	if (obj.__owners && Array.isArray(obj.__owners)) {
		const index = obj.__owners.indexOf(moduleId);
		if (index !== -1) {
			obj.__owners.splice(index, 1);
		}
	}

	// Recursively process nested objects
	for (const key of Object.keys(obj)) {
		if (key !== "__owners" && key !== "__metadata" && key !== "__slothletPath") {
			removeOwnership(obj[key], moduleId, visited);
		}
	}
}

/**
 * Remove properties with no owners
 * @param {object} obj - Object to clean
 * @param {WeakSet} visited - Visited objects
 */
function removeOrphans(obj, visited = new WeakSet()) {
	if (!obj || (typeof obj !== "object" && typeof obj !== "function")) return;
	if (visited.has(obj)) return;
	visited.add(obj);

	// Get keys to check (avoid modifying during iteration)
	const keys = Object.keys(obj);
	for (const key of keys) {
		if (key !== "__owners" && key !== "__metadata" && key !== "__slothletPath") {
			const value = obj[key];
			if (value && (typeof value === "object" || typeof value === "function")) {
				// Check if this object has no owners
				if (value.__owners && Array.isArray(value.__owners) && value.__owners.length === 0) {
					delete obj[key];
				} else {
					// Recursively clean nested objects
					removeOrphans(value, visited);
				}
			}
		}
	}
}

/**
 * Recursively mutate objects/functions while preserving references.
 * Handles lazy proxy preservation by updating _materialize instead of replacing.
 * @param {object} existingObj - Existing object to mutate
 * @param {object} newObj - New object with updated values
 * @param {object} options - Options for mutation
 * @param {object} options.instance - Slothlet instance
 * @param {boolean} options.skipDeletion - Whether to skip deleting removed properties (for multi-module paths)
 * @param {WeakSet} [visited] - Visited objects to prevent infinite loops
 * @returns {Promise<void>}
 */
async function recursivelyMutateWithLazyPreservation(existingObj, newObj, options, visited = new WeakSet()) {
	const { instance, skipDeletion = false, mutateExisting = false } = options;

	// Prevent infinite loops
	if (visited.has(existingObj)) return;
	visited.add(existingObj);

	// LAZY MODE: If existingObj is itself a lazy folder proxy, work with its materialized content
	const isExistingFolderProxy = existingObj && typeof existingObj === "function" && existingObj._materialize && existingObj.__state;
	const isNewFolderProxy = newObj && typeof newObj === "function" && newObj._materialize && newObj.__state;

	if (isExistingFolderProxy && isNewFolderProxy) {
		// Both are lazy folder proxies - update _materialize and state, then recurse on materialized content
		if (instance.config.debug) {
			console.log(`[DEBUG] recursivelyMutate: Both objects are lazy folder proxies - updating _materialize and state`);
		}
		// Update the _materialize function to point to the new implementation
		existingObj._materialize = newObj._materialize;
		// Handle state synchronization
		const existingState = existingObj.__state;
		const newState = newObj.__state;
		if (existingState && newState) {
			// Get the new materialized content (either already materialized or we need to materialize)
			let newMaterialized = newState.materialized;
			if (!newMaterialized && newObj._materialize) {
				// New proxy not yet materialized - materialize it to get the content
				await newObj._materialize();
				newMaterialized = newState.materialized;
			}

			if (existingState.materialized && newMaterialized) {
				// BOTH are materialized - recursively mutate to preserve internal references
				if (instance.config.debug) {
					console.log(`[DEBUG] recursivelyMutate: Both folder proxies are materialized - recursively mutating contents`);
				}
				await recursivelyMutateWithLazyPreservation(existingState.materialized, newMaterialized, options, visited);
			} else if (!existingState.materialized && newMaterialized) {
				// Existing not materialized yet - just copy the new materialized reference
				existingState.materialized = newMaterialized;
			}
			// If new is not materialized, leave existing state as-is (it will materialize on demand)
			// Always update inFlight to match
			existingState.inFlight = newState.inFlight;
		}
		return; // Done - we've updated the lazy folder proxy in place
	}

	if (isExistingFolderProxy && !isNewFolderProxy) {
		// Existing is a lazy folder proxy, new is a regular object
		// Materialize existing and mutate its contents
		if (!existingObj.__state?.materialized) {
			await existingObj._materialize();
		}
		if (existingObj.__state?.materialized) {
			await recursivelyMutateWithLazyPreservation(existingObj.__state.materialized, newObj, options, visited);
		}
		return;
	}

	if (!isExistingFolderProxy && isNewFolderProxy) {
		// Existing is NOT a lazy folder proxy, new IS
		// Materialize new proxy to get its contents, then recurse
		if (!newObj.__state?.materialized) {
			await newObj._materialize();
		}
		const newMaterialized = newObj.__state?.materialized;
		if (newMaterialized) {
			// Continue with the materialized content as newObj
			await recursivelyMutateWithLazyPreservation(existingObj, newMaterialized, options, visited);
		}
		return;
	}

	// Delete properties that no longer exist (unless skipDeletion is true)
	if (!skipDeletion) {
		for (const key of Object.keys(existingObj)) {
			if (!(key in newObj)) {
				delete existingObj[key];
			}
		}
	}

	// Update or add properties
	for (const key of Object.keys(newObj)) {
		const existingValue = existingObj[key];
		const newValue = newObj[key];

		// LAZY MODE: Check if both are lazy proxies - preserve reference by updating _materialize
		const isExistingLazyProxy = existingValue && typeof existingValue === "function" && existingValue._materialize;
		const isNewLazyProxy = newValue && typeof newValue === "function" && newValue._materialize;

		if (isExistingLazyProxy && isNewLazyProxy) {
			// Both are lazy proxies - update _materialize to preserve the reference
			if (instance.config.debug) {
				console.log(`[DEBUG] recursivelyMutate: Preserving lazy proxy reference for "${key}" - updating _materialize`);
			}
			existingValue._materialize = newValue._materialize;
			// Copy state if new one has materialized content
			const existingState = existingValue.__state;
			const newState = newValue.__state;
			if (existingState && newState && newState.materialized !== undefined && newState.materialized !== null) {
				existingState.materialized = newState.materialized;
			}
			// If both are materialized, recursively mutate the materialized contents
			if (existingValue.__materialized && newValue.__materialized) {
				await recursivelyMutateWithLazyPreservation(existingValue.__materialized, newValue.__materialized, options, visited);
			}
			continue; // Skip normal assignment - we've updated in place
		}

		// Handle case where existing is lazy proxy but new is not (or vice versa)
		if (isExistingLazyProxy && !isNewLazyProxy) {
			// Existing is lazy, new is not - materialize existing and mutate if new is an object
			if (newValue && typeof newValue === "object" && !Array.isArray(newValue)) {
				if (!existingValue.__materialized) {
					await existingValue._materialize();
				}
				if (existingValue.__materialized) {
					await recursivelyMutateWithLazyPreservation(existingValue.__materialized, newValue, options, visited);
				}
				continue;
			}
		}

		// CRITICAL: Check function-to-function updates FIRST, before object recursion
		// Wrapped functions have __metadata, so they'd match the slothlet object check below
		// and recurse into their properties instead of updating ._impl
		if (typeof existingValue === "function" && typeof newValue === "function" && mutateExisting) {
			// Both are functions and mutateExisting is true - update wrapper implementation if wrapped,
			// otherwise we must replace the reference (cannot mutate function implementation)
			if (existingValue._slothletWrapped) {
				// Existing is wrapped - update its implementation
				// If new value is also wrapped, extract its implementation; otherwise use it directly
				const newImpl = newValue._slothletWrapped ? newValue._impl : newValue;

				if (instance.config.debug) {
					console.log(`[DEBUG] recursivelyMutate: Updating wrapped function implementation at "${key}"`);
				}
				existingValue._impl = newImpl;

				// Copy properties from newValue to wrapper (excluding internal wrapper properties)
				const newProps = Object.keys(newValue);
				for (const prop of newProps) {
					if (prop !== "_impl" && prop !== "_slothletWrapped") {
						existingValue[prop] = newValue[prop];
					}
				}

				// Merge ownership
				if (newValue.__owners && Array.isArray(newValue.__owners)) {
					if (!existingValue.__owners) {
						Object.defineProperty(existingValue, "__owners", {
							value: [...newValue.__owners],
							writable: true,
							enumerable: false,
							configurable: true
						});
					} else {
						for (const owner of newValue.__owners) {
							if (!existingValue.__owners.includes(owner)) {
								existingValue.__owners.push(owner);
							}
						}
					}
				}
				continue; // Skip rest of checks - we've updated the wrapper
			} else {
				// Not wrapped - cannot update implementation without replacing reference
				if (instance.config.debug) {
					console.log(`[DEBUG] recursivelyMutate: Replacing function at "${key}" (not wrapped)`);
				}
				existingObj[key] = newValue;
				continue;
			}
		}

		// Check if existing value is a slothlet-tagged object/function that should be recursively mutated
		const isExistingSlothletObject =
			existingValue &&
			(typeof existingValue === "object" || typeof existingValue === "function") &&
			!Array.isArray(existingValue) &&
			(existingValue.__metadata || existingValue.__slothletPath);
		const isNewObject = newValue && (typeof newValue === "object" || typeof newValue === "function") && !Array.isArray(newValue);

		// Check if existing is a plain object (materialized content without tags) that can be mutated
		const isExistingPlainObjectOrFunction =
			existingValue &&
			(typeof existingValue === "object" || typeof existingValue === "function") &&
			!Array.isArray(existingValue) &&
			!existingValue.__metadata &&
			!existingValue.__slothletPath;

		if (instance.config.debug) {
			console.log(
				`[DEBUG] recursivelyMutate key="${key}": existingType=${typeof existingValue}, newType=${typeof newValue}, isExistingSlothlet=${isExistingSlothletObject}, isExistingPlain=${isExistingPlainObjectOrFunction}, isNewLazyProxy=${isNewLazyProxy}, isNewObject=${isNewObject}`
			);
		}

		// Handle case where existing is slothlet-tagged object and new is lazy proxy
		// This happens when the existing object was materialized before reload
		if (isExistingSlothletObject && isNewLazyProxy) {
			if (instance.config.debug) {
				console.log(
					`[DEBUG] recursivelyMutate: Existing is slothlet-tagged object, new is lazy proxy - materializing new and mutating existing`
				);
			}
			// Trigger materialization of the new lazy proxy
			if (newValue._materialize) {
				await newValue._materialize();
			}
			// Get materialized content - either from __materialized or __state.materialized
			const newMaterialized = newValue.__materialized ?? newValue.__state?.materialized;
			if (newMaterialized) {
				await recursivelyMutateWithLazyPreservation(existingValue, newMaterialized, options, visited);
			} else {
				// Fallback: materialize failed or returned nothing, do direct assignment
				existingObj[key] = newValue;
			}
			continue;
		}

		if (isExistingSlothletObject && isNewObject) {
			// Both are objects/functions and existing is slothlet-tagged - recursively mutate
			// Copy ownership from new to existing since we're preserving the existing reference
			if (newValue.__owners && Array.isArray(newValue.__owners)) {
				if (!existingValue.__owners) {
					Object.defineProperty(existingValue, "__owners", {
						value: [...newValue.__owners],
						writable: true,
						enumerable: false,
						configurable: true
					});
				} else {
					// Merge owners - add any from newValue that aren't already present
					for (const owner of newValue.__owners) {
						if (!existingValue.__owners.includes(owner)) {
							existingValue.__owners.push(owner);
						}
					}
				}
			}
			await recursivelyMutateWithLazyPreservation(existingValue, newValue, options, visited);
		} else if (isExistingPlainObjectOrFunction && isNewLazyProxy) {
			// Existing is a plain materialized object, new is a lazy proxy
			// Materialize new and mutate existing content to preserve reference
			if (instance.config.debug) {
				console.log(`[DEBUG] recursivelyMutate: Existing is plain object, new is lazy proxy - materializing new and mutating existing`);
			}
			// Trigger materialization of the new lazy proxy
			if (newValue._materialize) {
				await newValue._materialize();
			}
			// Get materialized content - either from __materialized or __state.materialized
			const newMaterialized = newValue.__materialized ?? newValue.__state?.materialized;
			if (newMaterialized) {
				// Copy ownership from new materialized to existing
				if (newMaterialized.__owners && Array.isArray(newMaterialized.__owners)) {
					if (!existingValue.__owners) {
						Object.defineProperty(existingValue, "__owners", {
							value: [...newMaterialized.__owners],
							writable: true,
							enumerable: false,
							configurable: true
						});
					} else {
						for (const owner of newMaterialized.__owners) {
							if (!existingValue.__owners.includes(owner)) {
								existingValue.__owners.push(owner);
							}
						}
					}
				}
				await recursivelyMutateWithLazyPreservation(existingValue, newMaterialized, options, visited);
			} else {
				// Fallback: materialize failed or returned nothing, do direct assignment
				existingObj[key] = newValue;
			}
		} else {
			// Different types, primitives, arrays, or not slothlet-tagged - direct assignment
			if (instance.config.debug) {
				console.log(`[DEBUG] recursivelyMutate: ASSIGNING existingObj["${key}"] = newValue (replacing reference!)`);
			}
			existingObj[key] = newValue;
		}
	}
}

/**
 * @typedef {Object} AddApiFromFolderParams
 * @property {string} apiPath - Dot-notation path where modules will be added
 * @property {string} folderPath - Path to folder containing modules to load
 * @property {object} instance - Slothlet instance with api, boundapi, config, modes, etc.
 * @property {object} [metadata={}] - Metadata to attach to all loaded functions
 * @property {object} [options={}] - Additional options for module loading
 * @property {boolean} [options.forceOverwrite=false] - Allow complete replacement of existing APIs (bypasses merge behavior)
 * @property {boolean} [options.mutateExisting=true] - Preserve references by mutating existing objects in-place instead of replacing them. Set to false to replace references entirely.
 * @property {string} [options.moduleId] - Module identifier for ownership tracking. Required for hot reload cleanup.
 */

/**
 * @description
 * Dynamically adds API modules from a new folder to the existing API at a specified path.
 *
 * @function addApiFromFolder
 * @memberof module:@cldmv/slothlet.lib.helpers.api_builder.add_api
 * @param {AddApiFromFolderParams} params - Configuration object
 * @returns {Promise<void>}
 * @throws {Error} If API not loaded, invalid parameters, folder does not exist, or merge conflicts
 * @package
 *
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
 * await addApiFromFolder(
 *   "runtime.plugins",
 *   "./plugins",
 *   slothletInstance
 * );
 *
 * @example
 * // Add modules to root level
 * await addApiFromFolder(
 *   "utilities",
 *   "./utils",
 *   slothletInstance
 * );
 *
 * @example
 * // Add deep nested modules
 * await addApiFromFolder(
 *   "services.external.stripe",
 *   "./services/stripe",
 *   slothletInstance
 * );
 *
 * @example
 * // Add modules with metadata
 * await addApiFromFolder(
 *   "extensions.untrusted",
 *   "./untrusted-plugins",
 *   slothletInstance,
 *   {
 *     trusted: false,
 *     permissions: ["read"],
 *     version: "1.0.0",
 *     author: "external"
 *   }
 * );
 */
export async function addApiFromFolder({ apiPath, folderPath, instance, metadata = {}, options = {} }) {
	const { forceOverwrite = false, mutateExisting = false, moduleId } = options;

	// Rule 12: Module Ownership validation
	if (forceOverwrite && !moduleId) {
		throw new Error(`[slothlet] Rule 12: forceOverwrite requires moduleId parameter for ownership tracking`);
	}

	if (forceOverwrite && !instance.config.hotReload) {
		throw new Error(`[slothlet] Rule 12: forceOverwrite requires hotReload: true in slothlet configuration`);
	}

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

	// Note: forceOverwrite=true means "allow complete replacement" - it does NOT block overwrites
	// Ownership tracking via __owners arrays handles cleanup of orphaned entities

	// Rule 13: Auto-cleanup before reload when hot reload tracking enabled
	// Remove existing APIs owned by this module to prevent orphan functions
	// CRITICAL: This must happen AFTER path resolution and cross-module check but BEFORE module loading
	// to preserve the synchronous call stack for resolvePathFromCaller()
	// EXCEPTION: Skip auto-cleanup when mutateExisting is true to preserve references
	if (instance.config.hotReload && moduleId && !mutateExisting) {
		if (instance.config.debug) {
			console.log(`[DEBUG] addApi: Auto-cleanup enabled - removing existing APIs for moduleId: ${moduleId}`);
		}
		await removeApiByModuleId(instance, moduleId);
	} else if (instance.config.hotReload && moduleId && mutateExisting) {
		if (instance.config.debug) {
			console.log(`[DEBUG] addApi: Auto-cleanup skipped due to mutateExisting=true - preserving references for moduleId: ${moduleId}`);
		}
	}

	// Track addApi call for hot reload (before any potential errors)
	// Skip tracking if this is a rollback operation (mutateExisting is only used during rollback)
	if (instance.config.hotReload && !mutateExisting) {
		// Remove any previous entry for this apiPath/moduleId (if reloading)
		// Use moduleId if available, otherwise use apiPath as identifier
		const identifier = moduleId || apiPath;
		instance._addApiHistory = instance._addApiHistory.filter((entry) => {
			const entryId = entry.options?.moduleId || entry.apiPath;
			return entryId !== identifier;
		});
		// Add new entry with all options preserved (except mutateExisting which is operation-specific)
		const { mutateExisting: _, ...optionsToStore } = options || {};
		instance._addApiHistory.push({
			apiPath,
			folderPath,
			metadata: metadata ? { ...metadata } : {},
			options: { ...optionsToStore }
		});
		// Remove from removal history if it was there (using same identifier)
		if (moduleId) {
			instance._removeApiHistory.delete(moduleId);
		}
	}

	if (instance.config.debug) {
		console.log(`[DEBUG] addApi: Loading modules from ${resolvedFolderPath} to path: ${normalizedApiPath}`);
	}

	// *** SUPER CRITICAL: Capture existing API content BEFORE loading new modules ***
	// New module loading can corrupt the existing bound API state in lazy mode
	// This must happen before lazy.create() to preserve previous addApi results

	// Navigate to the target location to check existing content
	let earlyCurrentTarget = instance.api;
	let earlyCurrentBoundTarget = instance.boundapi;
	const earlyPathParts = normalizedApiPath.split(".");

	for (let i = 0; i < earlyPathParts.length - 1; i++) {
		const part = earlyPathParts[i];
		const key = instance._toapiPathKey(part);
		if (earlyCurrentTarget[key]) {
			earlyCurrentTarget = earlyCurrentTarget[key];
		} else {
			earlyCurrentTarget = null;
			break;
		}
		if (earlyCurrentBoundTarget[key]) {
			earlyCurrentBoundTarget = earlyCurrentBoundTarget[key];
		} else {
			earlyCurrentBoundTarget = null;
			break;
		}
	}

	const earlyFinalKey = instance._toapiPathKey(earlyPathParts[earlyPathParts.length - 1]);
	let superEarlyExistingTargetContent = null;
	let superEarlyExistingBoundContent = null;

	if (earlyCurrentTarget && earlyCurrentTarget[earlyFinalKey]) {
		if (typeof earlyCurrentTarget[earlyFinalKey] === "function" && earlyCurrentTarget[earlyFinalKey].__slothletPath) {
			if (instance.config.debug) {
				console.log(`[DEBUG] addApi: SUPER EARLY - Target is lazy proxy - materializing to capture existing content`);
			}
			const _ = earlyCurrentTarget[earlyFinalKey].__trigger;
			await earlyCurrentTarget[earlyFinalKey]();
		}
		if (typeof earlyCurrentTarget[earlyFinalKey] === "object") {
			superEarlyExistingTargetContent = { ...earlyCurrentTarget[earlyFinalKey] };
			if (instance.config.debug) {
				console.log(`[DEBUG] addApi: SUPER EARLY - Captured existing target content:`, Object.keys(superEarlyExistingTargetContent));
			}
		}
	}

	if (earlyCurrentBoundTarget && earlyCurrentBoundTarget[earlyFinalKey]) {
		if (instance.config.debug) {
			console.log(
				`[DEBUG] addApi: SUPER EARLY - currentBoundTarget[${earlyFinalKey}] exists, type:`,
				typeof earlyCurrentBoundTarget[earlyFinalKey]
			);
		}
		if (typeof earlyCurrentBoundTarget[earlyFinalKey] === "function" && earlyCurrentBoundTarget[earlyFinalKey].__slothletPath) {
			if (instance.config.debug) {
				console.log(`[DEBUG] addApi: SUPER EARLY - Bound target is lazy proxy - materializing to capture existing bound content`);
			}
			const _ = earlyCurrentBoundTarget[earlyFinalKey].__trigger;
			await earlyCurrentBoundTarget[earlyFinalKey]();
		}
		if (typeof earlyCurrentBoundTarget[earlyFinalKey] === "object") {
			superEarlyExistingBoundContent = { ...earlyCurrentBoundTarget[earlyFinalKey] };
			if (instance.config.debug) {
				console.log(`[DEBUG] addApi: SUPER EARLY - Captured existing bound content:`, Object.keys(superEarlyExistingBoundContent));
			}
		}
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
		}

		// Handle lazy mode proxies - need to materialize to get function names
		let fileContent = newModules[lastSegment];
		if (typeof fileContent === "function" && fileContent.name && fileContent.name.startsWith("lazyFolder_")) {
			// This is a lazy proxy - trigger materialization like the existing addApi pattern
			if (fileContent.__slothletPath) {
				const _ = fileContent.__trigger; // Trigger _materialize()
				await fileContent(); // Wait for materialization to complete
				// After materialization, the proxy should be replaced with the actual object
				fileContent = newModules[lastSegment]; // Get the materialized result
				if (instance.config.debug) {
					console.log(`[DEBUG] addApi: Materialized lazy proxy for root-level file:`, Object.keys(fileContent || {}));
				}
			}
		}

		if (instance.config.debug) {
			console.log(`[DEBUG] addApi: Root-level file content:`, Object.keys(fileContent || {}));
		}

		// Store the root-level file content for later merging
		// IMPORTANT: Make a copy to prevent reference contamination during merge operations
		rootLevelFileContent = fileContent && typeof fileContent === "object" ? { ...fileContent } : fileContent;

		// Remove the matching file from the structure so it doesn't interfere with subdirectory content
		delete newModules[lastSegment];

		if (instance.config.debug) {
			console.log(`[DEBUG] addApi: After removing root-level file, remaining structure:`, Object.keys(newModules));
		}
	}

	// Handle metadata tagging:
	// ALWAYS tag functions with __metadata for reference tracking during hot reload
	// User-provided metadata is optional and merged in if provided
	if (newModules) {
		// Build metadata object (always include sourceFolder, optionally merge user metadata)
		const fullMetadata = {
			sourceFolder: resolvedFolderPath
		};

		// Merge user-provided metadata if present
		if (metadata && typeof metadata === "object" && Object.keys(metadata).length > 0) {
			Object.assign(fullMetadata, metadata);
			if (instance.config.debug) {
				console.log(`[DEBUG] addApi: Tagging functions with metadata:`, Object.keys(fullMetadata));
			}
		} else if (instance.config.debug) {
			console.log(`[DEBUG] addApi: Tagging functions with system metadata (no user metadata provided)`);
		}

		tagLoadedFunctions(newModules, fullMetadata, resolvedFolderPath);

		// Track ownership if moduleId is provided
		if (moduleId) {
			if (instance.config.debug) {
				console.log(`[DEBUG] addApi: Marking new modules with owner: ${moduleId}`);
			}
			addOwnership(newModules, moduleId);
		}
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

	if (instance.config.debug) {
		console.log(`[DEBUG] addApi: Final assignment - newModules type:`, typeof newModules, "keys:", Object.keys(newModules || {}));
	}

	// *** CRITICAL: Capture existing content BEFORE any processing that might overwrite it ***
	// This must happen after API navigation but before Rule 7 materialization to preserve previous addApi results
	// (Content already captured in super early phase before module loading - this is just to validate the structure)

	// Merge the new modules into the target location
	if (typeof newModules === "function") {
		// If the loaded modules result in a function, set it directly
		// Check for existing value and handle based on allowApiOverwrite config and Rule 12
		if (Object.prototype.hasOwnProperty.call(currentTarget, finalKey)) {
			let existing = currentTarget[finalKey];

			// LAZY MODE: Check if both existing and new are lazy proxies - preserve reference by updating _materialize
			const isExistingLazyProxy = existing && typeof existing === "function" && existing._materialize;
			const isNewLazyProxy = newModules && typeof newModules === "function" && newModules._materialize;

			if (mutateExisting && isExistingLazyProxy && isNewLazyProxy) {
				if (instance.config.debug) {
					console.log(`[DEBUG] addApi: Preserving lazy proxy reference at "${finalKey}" - updating _materialize instead of materializing`);
				}
				// Update _materialize to point to new content, preserving the proxy reference
				existing._materialize = newModules._materialize;
				// Copy state from new proxy if it has materialized content
				const existingState = existing.__state;
				const newState = newModules.__state;
				if (existingState && newState) {
					// Clear existing materialized so next access uses new _materialize
					existingState.materialized = null;
					existingState.inFlight = null;
				}
				// Copy metadata and properties from new to existing
				for (const key of Object.keys(newModules)) {
					if (key !== "_materialize" && key !== "__state" && key !== "__materialized") {
						existing[key] = newModules[key];
					}
				}
				// Mark ownership at the API path level
				if (moduleId) {
					instance._registerApiOwnership(normalizedApiPath, moduleId);
				}
				return; // Skip normal assignment - we've updated in place
			}

			// LAZY MODE: If only existing is lazy proxy, materialize before mutation
			if (mutateExisting && instance.config.lazy && isExistingLazyProxy && !isNewLazyProxy) {
				if (instance.config.debug) {
					console.log(`[DEBUG] addApi: Materializing lazy proxy at "${finalKey}" before mutation (new is not lazy)`);
				}
				try {
					// Materialize the lazy proxy to get the actual module data
					await existing._materialize();
					// After materialization, the parent should have the real data, not the proxy
					existing = currentTarget[finalKey];
				} catch (error) {
					console.warn(`[slothlet] Failed to materialize lazy proxy at "${finalKey}":`, error.message);
				}
			}

			// Rule 12: Check module ownership for overwrites
			if (instance.config.hotReload && existing && moduleId) {
				// Check ownership at the apiPath level (not apiPath.finalKey since finalKey is already part of apiPath)
				const existingOwners = instance._getApiOwnership(normalizedApiPath);

				// Check if a different module owns this path
				if (existingOwners && existingOwners.size > 0 && !existingOwners.has(moduleId)) {
					// Different module owns it - only allow if allowApiOverwrite is true
					if (instance.config.allowApiOverwrite === false) {
						const ownersList = Array.from(existingOwners).join(", ");
						throw new Error(
							`[slothlet] Rule 12: Cannot overwrite API "${normalizedApiPath}" - owned by module(s) "${ownersList}", ` +
								`attempted by module "${moduleId}". Set allowApiOverwrite: true to allow cross-module overwrites.`
						);
					}
					// allowApiOverwrite is true - allow the cross-module overwrite
				}
			}

			// Special case: If existing is an object and new is a function, we're creating a callable object
			// This allows multiple modules to share the path - one provides the function, others add properties
			if (existing !== null && typeof existing === "object" && !Array.isArray(existing)) {
				// Check if we're allowed to replace object with function
				// Same module updates are always allowed; cross-module blocked when allowApiOverwrite=false
				const existingOwners = instance._getApiOwnership?.(normalizedApiPath);
				const isSameModuleUpdate = moduleId && existingOwners && existingOwners.has(moduleId);
				if (!forceOverwrite && !mutateExisting && instance.config.allowApiOverwrite === false && !isSameModuleUpdate) {
					// Get ownership info for better error message
					const ownerInfo = existingOwners && existingOwners.size > 0 ? ` Owned by: "${Array.from(existingOwners).join(", ")}".` : "";
					const attemptInfo = moduleId ? ` Attempted by module: "${moduleId}".` : "";
					console.warn(
						`[slothlet] Skipping addApi: Cannot replace object with function at "${normalizedApiPath}" ` +
							`(config: allowApiOverwrite=${instance.config.allowApiOverwrite}, forceOverwrite=${forceOverwrite}, mutateExisting=${mutateExisting}).${ownerInfo}${attemptInfo}`
					);
					return; // Skip the replacement
				}

				if (mutateExisting) {
					// Preserve references: recursively update nested objects, delete removed props, add new ones
					if (process.env.DEBUG_API_BUILDER === "1" || process.env.DEBUG_API_BUILDER === "true") {
						console.log(
							`[slothlet] Mutating existing object at API path "${normalizedApiPath}" final key "${finalKey}": ` +
								`clearing and copying new properties to preserve references.`
						);
					}

					// Determine if we should skip property deletion
					let skipDeletion = true; // Default to safe behavior
					if (moduleId) {
						const multipleModules = instance._addApiHistory.filter((entry) => entry.apiPath === normalizedApiPath).length > 1;
						skipDeletion = multipleModules;
						if (multipleModules && instance.config.debug) {
							console.log(`[DEBUG] Multiple modules contribute to "${normalizedApiPath}" - skipping property deletion during reload`);
						}
					}

					// Use unified recursive mutation helper
					await recursivelyMutateWithLazyPreservation(existing, newModules, {
						instance,
						skipDeletion
					});

					return; // Done - we've mutated in place
				}

				// Preserve existing object properties by copying them to the new function
				console.warn(
					`[slothlet] Creating callable object at API path "${normalizedApiPath}" final key "${finalKey}": ` +
						`merging object properties onto function for shared module ownership.`
				);
				Object.assign(newModules, existing);
			} else if (typeof existing === "function") {
				// Replacing function with another function
				// Same module updates are always allowed; cross-module blocked when allowApiOverwrite=false
				const existingOwners = instance._getApiOwnership?.(normalizedApiPath);
				const isSameModuleUpdate = moduleId && existingOwners && existingOwners.has(moduleId);
				if (!forceOverwrite && !mutateExisting && instance.config.allowApiOverwrite === false && !isSameModuleUpdate) {
					// Get ownership info for better error message
					const ownerInfo = existingOwners && existingOwners.size > 0 ? ` Owned by: "${Array.from(existingOwners).join(", ")}".` : "";
					const attemptInfo = moduleId ? ` Attempted by module: "${moduleId}".` : "";
					console.warn(
						`[slothlet] Skipping addApi: API path "${normalizedApiPath}" already exists (type: "function") ` +
							`(config: allowApiOverwrite=${instance.config.allowApiOverwrite}, forceOverwrite=${forceOverwrite}, mutateExisting=${mutateExisting}).${ownerInfo}${attemptInfo}`
					);
					return; // Skip the overwrite
				}

				if (mutateExisting) {
					// Preserve references: recursively update nested objects, delete removed props, add new ones
					if (process.env.DEBUG_API_BUILDER === "1" || process.env.DEBUG_API_BUILDER === "true") {
						console.log(
							`[slothlet] Mutating existing function at API path "${normalizedApiPath}" final key "${finalKey}": ` +
								`updating properties to preserve references.`
						);
					}
					await recursivelyMutateWithLazyPreservation(existing, newModules, {
						instance,
						skipDeletion: false
					});

					// Remove orphaned properties (those with no owners)
					if (moduleId) {
						if (instance.config.debug) {
							console.log(`[DEBUG] Removing orphaned properties from existing object`);
						}
						removeOrphans(existing);
					}

					return;
				}

				console.warn(
					`[slothlet] Overwriting existing function at API path "${normalizedApiPath}" ` + `final key "${finalKey}" with a new function.`
				);
			} else {
				// Replacing primitive with function
				console.warn(
					`[slothlet] Overwriting existing value at API path "${normalizedApiPath}" ` +
						`final key "${finalKey}" with a function. Previous type: "${typeof existing}".`
				);
			}
		}
		currentTarget[finalKey] = newModules;
		currentBoundTarget[finalKey] = newModules;
	} else if (typeof newModules === "object" && newModules !== null) {
		// SECOND: Validate existing target is compatible (object or function, not primitive)
		if (Object.prototype.hasOwnProperty.call(currentTarget, finalKey)) {
			const existing = currentTarget[finalKey];

			// Rule 12: Check module ownership for object merges
			if (instance.config.hotReload && existing && moduleId) {
				// Check ownership at the apiPath level (not apiPath.finalKey since finalKey is already part of apiPath)
				const existingOwners = instance._getApiOwnership(normalizedApiPath);

				// Check if a different module owns this path
				if (existingOwners && existingOwners.size > 0 && !existingOwners.has(moduleId)) {
					// Different module owns it - only allow if allowApiOverwrite is true
					if (instance.config.allowApiOverwrite === false) {
						const ownersList = Array.from(existingOwners).join(", ");
						throw new Error(
							`[slothlet] Rule 12: Cannot overwrite API "${normalizedApiPath}" - owned by module(s) "${ownersList}", ` +
								`attempted by module "${moduleId}". Set allowApiOverwrite: true to allow cross-module overwrites.`
						);
					}
					// allowApiOverwrite is true - allow the cross-module overwrite
				}
			}

			// Note: Object merging is always allowed - allowApiOverwrite only controls property-level overwrites
			// Special case: If existing is a function, we can merge properties onto it (creating callable object)
			// unless forceOverwrite is used to replace the function entirely
			if (existing !== null && typeof existing === "function") {
				// Existing is a function, new is object - merge properties onto function for shared ownership
				// Same module updates are always allowed; cross-module blocked when allowApiOverwrite=false
				const existingOwners = instance._getApiOwnership?.(normalizedApiPath);
				const isSameModuleUpdate = moduleId && existingOwners && existingOwners.has(moduleId);
				if (forceOverwrite && instance.config.allowApiOverwrite === false && !isSameModuleUpdate) {
					// Get ownership info for better error message
					const ownerInfo = existingOwners && existingOwners.size > 0 ? ` Owned by: "${Array.from(existingOwners).join(", ")}".` : "";
					const attemptInfo = moduleId ? ` Attempted by module: "${moduleId}".` : "";
					console.warn(
						`[slothlet] Skipping addApi: Cannot replace function with object at "${normalizedApiPath}" ` +
							`(config: allowApiOverwrite=${instance.config.allowApiOverwrite}, forceOverwrite=${forceOverwrite}).${ownerInfo}${attemptInfo} ` +
							`Function will be preserved and new properties merged instead.`
					);
					// Don't return - continue to merge properties onto function
				}
				if (process.env.DEBUG_API_BUILDER === "1" || process.env.DEBUG_API_BUILDER === "true") {
					console.log(
						`[slothlet] Creating callable object at API path "${normalizedApiPath}" final key "${finalKey}": ` +
							`merging object properties onto existing function for shared module ownership.`
					);
				}
				// Continue to merge - properties will be added to the function below
			} else if (existing !== null && typeof existing !== "object") {
				throw new Error(
					`[slothlet] Cannot merge API at "${normalizedApiPath}": ` +
						`existing value at final key "${finalKey}" is type "${typeof existing}", cannot merge into primitives.`
				);
			}
		}
		if (Object.prototype.hasOwnProperty.call(currentBoundTarget, finalKey)) {
			const existingBound = currentBoundTarget[finalKey];
			if (existingBound !== null && typeof existingBound === "function") {
				// Same handling for bound target
				if (process.env.DEBUG_API_BUILDER === "1" || process.env.DEBUG_API_BUILDER === "true") {
					console.log(
						`[slothlet] Creating callable object in bound API at "${normalizedApiPath}" final key "${finalKey}": ` +
							`merging object properties onto existing function.`
					);
				}
			} else if (existingBound !== null && typeof existingBound !== "object") {
				throw new Error(
					`[slothlet] Cannot merge bound API at "${normalizedApiPath}": ` +
						`existing value at final key "${finalKey}" is type "${typeof existingBound}", cannot merge into primitives.`
				);
			}
		}

		// Detect and materialize lazy proxies in new modules before extracting Rule 7 content
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

		// First restore any existing content that may have been lost during materialization
		if (superEarlyExistingTargetContent) {
			if (instance.config.debug) {
				console.log(`[DEBUG] addApi: Restoring existing content - keys:`, Object.keys(superEarlyExistingTargetContent));
			}
			Object.assign(currentTarget[finalKey], superEarlyExistingTargetContent);
		}
		if (superEarlyExistingBoundContent) {
			if (instance.config.debug) {
				console.log(`[DEBUG] addApi: Restoring existing BOUND content - keys:`, Object.keys(superEarlyExistingBoundContent));
			}
			Object.assign(currentBoundTarget[finalKey], superEarlyExistingBoundContent);
		}

		// Then merge new modules
		if (instance.config.debug) {
			console.log(`[DEBUG] addApi: Before merging new modules - current keys:`, Object.keys(currentTarget[finalKey] || {}));
			console.log(`[DEBUG] addApi: New modules to merge - keys:`, Object.keys(newModules));
		}

		// When mutateExisting is true, use ownership tracking for clean reload
		if (mutateExisting && currentTarget[finalKey]) {
			// Remove this moduleId's ownership from existing properties
			if (moduleId) {
				if (instance.config.debug) {
					console.log(`[DEBUG] addApi: Removing ownership of moduleId "${moduleId}" before merge`);
				}
				removeOwnership(currentTarget[finalKey], moduleId);
			}
		}
		if (mutateExisting && currentBoundTarget[finalKey]) {
			// Remove this moduleId's ownership from bound target
			if (moduleId) {
				removeOwnership(currentBoundTarget[finalKey], moduleId);
			}
		}

		// When mutateExisting is true, use unified recursive mutation to preserve lazy proxy references
		if (mutateExisting) {
			// Wrap all functions in newModules to enable implementation updates without breaking references
			wrapFunctionsRecursively(newModules);

			// Determine if we should skip property deletion:
			// - Without moduleId: always skip deletion (we're just merging, not doing tracked reload)
			// - With moduleId: skip deletion if multiple modules contribute to this path
			let skipDeletion = true; // Default to safe behavior (skip deletion)
			if (moduleId) {
				// Only delete properties if this is the only module at this path
				const multipleModules = instance._addApiHistory.filter((entry) => entry.apiPath === normalizedApiPath).length > 1;
				skipDeletion = multipleModules;
				if (multipleModules && instance.config.debug) {
					console.log(`[DEBUG] Multiple modules contribute to "${normalizedApiPath}" - skipping property deletion during reload`);
				}
			} else if (instance.config.debug) {
				console.log(`[DEBUG] No moduleId provided - skipping property deletion (merge mode)`);
			}

			// Use unified recursive mutation helper for both targets
			await recursivelyMutateWithLazyPreservation(currentTarget[finalKey], newModules, {
				instance,
				skipDeletion
			});
			await recursivelyMutateWithLazyPreservation(currentBoundTarget[finalKey], newModules, {
				instance,
				skipDeletion
			});
		} else {
			// Not mutateExisting - use standard Object.assign
			Object.assign(currentTarget[finalKey], newModules);
			Object.assign(currentBoundTarget[finalKey], newModules);
		}

		// Clean up orphaned properties after merge
		if (mutateExisting && moduleId) {
			if (instance.config.debug) {
				console.log(`[DEBUG] addApi: Cleaning up orphaned properties`);
			}
			removeOrphans(currentTarget[finalKey]);
			removeOrphans(currentBoundTarget[finalKey]);
		}
		if (instance.config.debug) {
			console.log(`[DEBUG] addApi: After merging new modules - keys:`, Object.keys(currentTarget[finalKey] || {}));
		}

		// Rule 7: Merge root-level file content if it was stored earlier
		if (rootLevelFileContent !== null) {
			if (instance.config.debug) {
				console.log(`[DEBUG] addApi: Merging root-level file content into API path "${normalizedApiPath}"`);
				console.log(`[DEBUG] addApi: Root-level file functions:`, Object.keys(rootLevelFileContent));
				console.log(`[DEBUG] addApi: Target before root-level merge:`, Object.keys(currentTarget[finalKey]));
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
	if (instance.config.debug) {
		console.log(`[DEBUG] addApi: Before updateBindings - currentTarget[${finalKey}]:`, Object.keys(currentTarget[finalKey] || {}));
		console.log(
			`[DEBUG] addApi: Before updateBindings - currentBoundTarget[${finalKey}]:`,
			Object.keys(currentBoundTarget[finalKey] || {})
		);
	}

	// Rule 12: Register ownership after successful update
	if (instance.config.hotReload && moduleId) {
		// The API is being added AT normalizedApiPath, not under it
		// finalKey is the last segment of pathParts and is already included in normalizedApiPath
		instance._registerApiOwnership(normalizedApiPath, moduleId);
	}

	instance.updateBindings(instance.context, instance.reference, instance.boundapi);
	if (instance.config.debug) {
		console.log(`[DEBUG] addApi: After updateBindings - api[${finalKey}]:`, Object.keys(instance.api[finalKey] || {}));
	}

	if (instance.config.debug) {
		console.log(`[DEBUG] addApi: Successfully added modules at ${normalizedApiPath}`);
	}
}
