/**
 * @fileoverview Hot reload handlers for adding, removing, and reloading API components at
 * runtime using class-based architecture.
 * @module @cldmv/slothlet/handlers/api-manager
 * @package
 *
 * @description
 * Provides runtime handlers that extend a loaded API with new modules, remove modules by path
 * or moduleId, and reapply additions to support hot reload workflows. This module manages
 * per-instance state as class properties and applies updates without requiring a full instance rebuild.
 *
 * @example
 * // ESM
 * import { ApiManager } from "@cldmv/slothlet/handlers/api-manager";
 * const manager = new ApiManager(instance);
 * await manager.addApiComponent({
 * 	apiPath: "plugins",
 * 	folderPath: "./plugins",
 * 	options: { moduleId: "plugins-core", metadata: { version: "1.0.0" } }
 * });
 *
 * @example
 * // CJS
 * const { ApiManager } = require("@cldmv/slothlet/handlers/api-manager");
 * const manager = new ApiManager(instance);
 * await manager.addApiComponent({
 * 	apiPath: "plugins",
 * 	folderPath: "./plugins",
 * 	options: { moduleId: "plugins-core", metadata: { version: "1.0.0" } }
 * });
 */
import fs from "node:fs/promises";
import path from "node:path";
import { ComponentBase } from "@cldmv/slothlet/factories/component-base";

/**
 * Manages runtime API component lifecycle (add/remove/reload).
 * @class ApiManager
 * @extends ComponentBase
 * @package
 *
 * @description
 * Class-based handler for managing API components at runtime. Tracks add history,
 * removed module IDs, and initial configuration per instance. Extends ComponentBase
 * for common Slothlet property access (config, debug, api, error classes, etc.).
 *
 * @example
 * const manager = new ApiManager(slothlet);
 * await manager.addApiComponent({ apiPath: "plugins", folderPath: "./plugins" });
 */
export class ApiManager extends ComponentBase {
	static slothletProperty = "apiManager";

	/**
	 * Create an ApiManager instance.
	 * @param {object} slothlet - Slothlet class instance.
	 * @package
	 *
	 * @description
	 * Initializes manager state with empty add history, removed module tracking,
	 * and stores the initial configuration.
	 *
	 * @example
	 * const manager = new ApiManager(slothlet);
	 */
	constructor(slothlet) {
		super(slothlet);
		this.state = {
			addHistory: [],
			removedModuleIds: new Set(),
			initialConfig: slothlet?.config || null
		};
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
	 * const { apiPath, parts } = this.normalizeApiPath("plugins.tools");
	 */
	normalizeApiPath(apiPath) {
		if (!apiPath || typeof apiPath !== "string") {
			throw new this.SlothletError("INVALID_CONFIG_API_PATH_INVALID", {
				apiPath,
				reason: "must be a non-empty string",
				validationError: true
			});
		}

		const normalized = apiPath.trim();
		const parts = normalized.split(".");
		if (parts.length === 0 || parts.some((part) => part.trim() === "")) {
			throw new this.SlothletError("INVALID_CONFIG_API_PATH_INVALID", {
				apiPath: normalized,
				reason: "contains empty path segments",
				validationError: true
			});
		}

		if (parts[0] === "slothlet" || normalized === "shutdown" || normalized === "destroy") {
			throw new this.SlothletError("INVALID_CONFIG_API_PATH_INVALID", {
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
	 * const resolved = await this.resolveFolderPath("./plugins");
	 */
	async resolveFolderPath(folderPath) {
		if (!folderPath || typeof folderPath !== "string") {
			throw new this.SlothletError("INVALID_CONFIG_DIR_INVALID", {
				dir: folderPath,
				validationError: true
			});
		}

		const resolvedPath = this.slothlet.helpers.resolver.resolvePathFromCaller(folderPath);
		try {
			const stats = await fs.stat(resolvedPath);
			if (!stats.isDirectory()) {
				throw new this.SlothletError("INVALID_CONFIG_DIR_INVALID", {
					dir: resolvedPath,
					validationError: true
				});
			}
		} catch (error) {
			if (error instanceof this.SlothletError) {
				throw error;
			}
			throw new this.SlothletError("INVALID_CONFIG_DIR_INVALID", {
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
	 * const moduleId = this.buildDefaultModuleId("plugins", "/abs/path/plugins");
	 */
	buildDefaultModuleId(apiPath, resolvedFolderPath) {
		const randomSuffix = Math.random().toString(36).substring(2, 8);
		return `${apiPath}_${randomSuffix}`;
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
	 * const value = this.getValueAtPath(api, ["plugins", "tools"]);
	 */
	getValueAtPath(root, parts) {
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
	 * const parent = this.ensureParentPath(api, ["plugins", "tools"]);
	 */
	ensureParentPath(root, parts) {
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
			throw new this.SlothletError("INVALID_CONFIG_API_PATH_INVALID", {
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
	 * if (this.isWrapperProxy(api.plugins)) {
	 * 	// Update wrapper implementation
	 * }
	 */
	isWrapperProxy(value) {
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
	 * @param {object} config - Configuration object for debug logging.
	 * @returns {Promise<boolean>} True when a wrapper update occurred.
	 * @private
	 *
	 * @description
	 * Copies materialization behavior and implementation from the new proxy into the existing
	 * proxy to preserve references during reload operations.
	 *
	 * @example
	 * await this.syncWrapper(existingProxy, nextProxy, this.config);
	 */
	async syncWrapper(existingProxy, nextProxy, config, collisionMode = "replace", moduleId = null) {
		if (config?.debug?.api) {
			this.slothlet.debug("api", {
				message: "syncWrapper entry - existingProxy",
				apiPath: existingProxy?.__wrapper?.apiPath
			});
			this.slothlet.debug("api", {
				message: "syncWrapper entry - nextProxy",
				apiPath: nextProxy?.__wrapper?.apiPath
			});
		}

		if (!this.isWrapperProxy(existingProxy) || !this.isWrapperProxy(nextProxy)) {
			return false;
		}

		const existingWrapper = existingProxy.__wrapper || existingProxy;
		const nextWrapper = nextProxy.__wrapper || nextProxy;

		if (config?.debug?.api) {
			this.slothlet.debug("api", {
				message: "syncWrapper existingWrapper",
				apiPath: existingWrapper.apiPath
			});
			this.slothlet.debug("api", {
				message: "syncWrapper nextWrapper",
				apiPath: nextWrapper.apiPath
			});
		}

		// Copy materialize function if present (lazy mode support)
		if (nextWrapper._materializeFunc) {
			existingWrapper._materializeFunc = nextWrapper._materializeFunc;
		}

		// THE ACTUAL FIX: Transfer _childCache entries directly
		// nextProxy.__impl is empty because buildAPI already moved everything to _childCache
		// We need to transfer the child wrappers from nextWrapper to existingWrapper
		if (nextWrapper._childCache && existingWrapper._childCache) {
			if (config?.debug?.api) {
				this.slothlet.debug("api", {
					message: "syncWrapper before merge",
					existingCacheSize: existingWrapper._childCache.size,
					nextCacheSize: nextWrapper._childCache.size
				});
				this.slothlet.debug("api", {
					message: "syncWrapper next wrapper impl keys",
					implKeys: Object.keys(nextWrapper._impl || {})
				});
				this.slothlet.debug("api", {
					message: "syncWrapper next wrapper childCache keys",
					childCacheKeys: Array.from(nextWrapper._childCache.keys())
				});
			}

			// Merge child wrappers from next to existing based on collision mode
			// IMPORTANT: _childCache should contain PROXIES (from createProxy()), not raw wrappers
			if (collisionMode === "replace") {
				// CRITICAL: Use __setImpl to trigger lifecycle events for ownership tracking
				// This ensures impl:changed fires with the correct moduleId
				if (existingWrapper.__setImpl && nextWrapper._impl !== undefined) {
					// Pass moduleId for correct ownership tracking in lifecycle events
					existingWrapper.__setImpl(nextWrapper._impl, moduleId);
				} else if (nextWrapper._impl === undefined) {
					// For lazy mode or unmaterialized wrappers, clear the existing impl
					// so that materialization will load the correct module
					existingWrapper._impl = null;
				} else {
					// Fallback for non-unified wrappers
					if (nextWrapper._impl !== undefined) {
						existingWrapper._impl = nextWrapper._impl;
						// Update callable status
						if (typeof nextWrapper._impl === "function" || (nextWrapper._impl && typeof nextWrapper._impl.default === "function")) {
							existingWrapper.isCallable = true;
						}
					}
				}

				// Clear existing child cache and adopt children from the new impl
				existingWrapper._childCache.clear();
				existingWrapper._adoptImplChildren();

				// Also copy any child wrappers that nextWrapper already has in its cache
				// (this handles cases where nextWrapper was built with pre-existing children)
				for (const [key, childValue] of nextWrapper._childCache.entries()) {
					existingWrapper._childCache.set(key, childValue);
				}
			} else if (collisionMode === "merge") {
				// Keep existing, only add new keys
				for (const [key, childValue] of nextWrapper._childCache.entries()) {
					if (!existingWrapper._childCache.has(key)) {
						existingWrapper._childCache.set(key, childValue);
					}
				}
			} else if (collisionMode === "merge-replace") {
				// Add new keys and replace existing
				for (const [key, childValue] of nextWrapper._childCache.entries()) {
					existingWrapper._childCache.set(key, childValue);
				}
			}
		}

		// Mark as materialized only if _impl is actually materialized (not a function)
		if (existingWrapper._state) {
			// In lazy mode, _impl being a function means it's not materialized yet
			const isActuallyMaterialized = existingWrapper._impl && typeof existingWrapper._impl !== "function";
			existingWrapper._state.materialized = isActuallyMaterialized;
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
	 * @param {object} config - Configuration object for debug logging.
	 * @returns {Promise<void>}
	 * @private
	 *
	 * @description
	 * Uses unified mergeApiObjects logic from api_assignment.mjs to ensure consistent
	 * merge behavior between initial build and hot reload.
	 *
	 * @example
	 * await this.mutateApiValue(existing, next, { removeMissing: true }, this.config);
	 */
	async mutateApiValue(existingValue, nextValue, options, config) {
		if (config?.debug?.api) {
			this.slothlet.debug("api", {
				message: "mutateApiValue called",
				existingType: typeof existingValue,
				nextType: typeof nextValue
			});
			this.slothlet.debug("api", {
				message: "mutateApiValue wrapper status",
				existingIsWrapper: this.isWrapperProxy(existingValue),
				nextIsWrapper: this.isWrapperProxy(nextValue)
			});
			this.slothlet.debug("api", {
				message: "mutateApiValue nextValue",
				nextValue
			});
			this.slothlet.debug("api", {
				message: "mutateApiValue nextValue keys",
				nextValueKeys: nextValue ? Object.keys(nextValue) : []
			});
		}

		if (existingValue === nextValue) {
			return;
		}

		// If both are wrapper proxies, sync them
		if (this.isWrapperProxy(existingValue) && this.isWrapperProxy(nextValue)) {
			if (config?.debug?.api) {
				this.slothlet.debug("api", {
					message: "mutateApiValue - both are wrappers, calling syncWrapper"
				});
			}
			await this.syncWrapper(existingValue, nextValue, config, options.collisionMode, options.moduleId);
			return;
		}

		// If existing is a wrapper but next is a plain object with children,
		// merge each child into the wrapper instead of replacing
		if (this.isWrapperProxy(existingValue) && !this.isWrapperProxy(nextValue)) {
			// Check if next is an object or function with properties
			const nextIsObjectLike = nextValue && (typeof nextValue === "object" || typeof nextValue === "function");
			const nextHasKeys = nextIsObjectLike && Object.keys(nextValue).length > 0;

			if (nextHasKeys) {
				if (config?.debug?.api) {
					this.slothlet.debug("api", {
						message: "mutateApiValue - merging properties into existing wrapper"
					});
					this.slothlet.debug("api", {
						message: "mutateApiValue nextValue keys to merge",
						keys: Object.keys(nextValue)
					});
				}
				// Merge each child from nextValue into the existing wrapper
				await this.slothlet.builders.apiAssignment.mergeApiObjects(existingValue, nextValue, {
					removeMissing: options.removeMissing,
					mutateExisting: true,
					allowOverwrite: true,
					syncWrapper: this.syncWrapper.bind(this),
					collisionMode: options.collisionMode
				});
				return;
			}

			// Fallback: if nextValue has no properties, try __setImpl
			if (existingValue.__setImpl) {
				if (config?.debug?.api) {
					this.slothlet.debug("api", {
						message: "mutateApiValue - using __setImpl fallback"
					});
				}
				existingValue.__setImpl(nextValue?.__impl ?? nextValue);
				return;
			}
		}

		// Use unified merge logic for objects
		if (existingValue && typeof existingValue === "object" && nextValue && typeof nextValue === "object") {
			await this.slothlet.builders.apiAssignment.mergeApiObjects(existingValue, nextValue, {
				removeMissing: options.removeMissing,
				mutateExisting: true,
				allowOverwrite: true,
				syncWrapper: this.syncWrapper.bind(this),
				collisionMode: options.collisionMode
			});
			return existingValue;
		}

		// For primitives and functions, return the next value
		return nextValue;
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
	 * @returns {Promise<boolean>} True if value was set, false if skipped due to collision.
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
	 * await this.setValueAtPath(api, ["plugins"], newApi, {
	 *   mutateExisting: true,
	 *   allowOverwrite: true,
	 *   collisionMode: "merge"
	 * });
	 */
	async setValueAtPath(root, parts, value, options) {
		const parent = this.ensureParentPath(root, parts);
		const finalKey = parts[parts.length - 1];
		const existing = parent ? parent[finalKey] : undefined;
		const collisionMode = options.collisionMode || "merge";
		const moduleId = options.moduleId; // Extract moduleId for lifecycle events

		this.slothlet.debug("api", {
			message: "setValueAtPath",
			finalKey,
			existingType: typeof existing,
			valueType: typeof value,
			collisionMode,
			options
		});

		// Handle collision based on mode
		if (existing !== undefined) {
			if (collisionMode === "error") {
				throw new this.SlothletError("INVALID_CONFIG_API_PATH_INVALID", {
					apiPath: parts.join("."),
					reason: "path already exists and collision mode is 'error'",
					validationError: true
				});
			}

			if (collisionMode === "skip") {
				this.slothlet.debug("api", {
					message: "setValueAtPath - skipping collision",
					path: parts.join("."),
					mode: "skip"
				});
				return false;
			}

			if (collisionMode === "warn") {
				if (this.slothlet && !this.config?.silent) {
					new this.SlothletWarning("WARNING_HOT_RELOAD_PATH_COLLISION", {
						apiPath: parts.join(".")
					});
				}
				return false;
			}

			if (collisionMode === "replace") {
				const existingIsObject = typeof existing === "object" || typeof existing === "function";
				const valueIsObject = typeof value === "object" || typeof value === "function";

				if (existingIsObject && valueIsObject) {
					this.slothlet.debug("api", {
						message: "setValueAtPath - replacing with merge (preserves wrapper)",
						path: parts.join("."),
						mode: "replace"
					});
					// Replace mode: call mutateApiValue to preserve wrapper, syncWrapper will clear children
					await this.mutateApiValue(
						existing,
						value,
						{ removeMissing: false, allowOverwrite: true, collisionMode: "replace", moduleId },
						this.config
					);
					return true;
				} else {
					// Primitives - just replace
					parent[finalKey] = value;
					return true;
				}
			}

			if (collisionMode === "merge" || collisionMode === "merge-replace") {
				const existingIsObject = typeof existing === "object" || typeof existing === "function";
				const valueIsObject = typeof value === "object" || typeof value === "function";

				if (existingIsObject && valueIsObject) {
					this.slothlet.debug("api", {
						message: "setValueAtPath - merging properties",
						mode: collisionMode
					});
					await this.mutateApiValue(existing, value, { removeMissing: false, allowOverwrite: true, collisionMode }, this.config);
					return true;
				} else {
					// Can't merge primitives - log warning and keep existing
					if (this.slothlet && !this.config?.silent) {
						new this.SlothletWarning("WARNING_HOT_RELOAD_MERGE_PRIMITIVES", {
							apiPath: parts.join(".")
						});
					}
					return false;
				}
			}
		}

		// No collision - simple assignment
		this.slothlet.debug("api", {
			message: "setValueAtPath - no collision, assigning",
			finalKey
		});
		parent[finalKey] = value;
		return true;
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
	 * const deleted = this.deletePath(api, ["plugins", "tools"]);
	 */
	deletePath(root, parts) {
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

		// Get the impl being removed and its metadata before deletion
		const removedImpl = current[finalKey];
		const apiPath = parts.join(".");

		// Emit lifecycle event for removal
		if (removedImpl && this.slothlet.handlers?.lifecycle) {
			const metadata = this.slothlet.handlers.metadata?.getMetadata?.(removedImpl);
			this.slothlet.handlers.lifecycle.emit("impl:removed", {
				apiPath,
				impl: removedImpl,
				source: "removal",
				moduleId: metadata?.moduleID,
				filePath: metadata?.filePath,
				sourceFolder: metadata?.sourceFolder
			});
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
	 * this.registerOwnership(ownership, "plugins-core", "plugins", api.plugins);
	 */
	registerOwnership(ownership, moduleId, apiPath, value) {
		if (!ownership || !moduleId) {
			return;
		}

		const visited = new WeakSet();
		const maxDepth = 10; // Prevent excessive recursion

		// Get collision mode from config (defaults to "merge")
		const collisionMode = this.config.collision?.addApi || "merge";

		const registerRecursive = (currentValue, pathParts, depth = 0) => {
			// Depth limit check
			if (depth > maxDepth) {
				return;
			}

			const pathKey = pathParts.join(".");
			ownership.register({
				moduleId,
				apiPath: pathKey,
				value: currentValue,
				source: "add",
				collisionMode: collisionMode,
				filePath: null
			});

			// Only recurse into objects/functions, not primitives or arrays
			if (currentValue && (typeof currentValue === "object" || typeof currentValue === "function") && !Array.isArray(currentValue)) {
				// Circular reference check
				if (visited.has(currentValue)) {
					return;
				}
				visited.add(currentValue);

				// Skip special properties that shouldn't be recursively registered
				const skipProps = new Set(["__wrapper", "__metadata", "__materialize", "__type", "_impl", "_childCache"]);

				for (const [key, child] of Object.entries(currentValue)) {
					if (!skipProps.has(key)) {
						registerRecursive(child, [...pathParts, key], depth + 1);
					}
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
	 * const result = this.removeOwnershipEntry(ownership, "plugins.tools", null);
	 */
	removeOwnershipEntry(ownership, apiPath, moduleId) {
		if (!ownership || typeof ownership.removePath !== "function") {
			return { action: "none", removedModuleId: null, restoreModuleId: null };
		}

		return ownership.removePath(apiPath, moduleId ?? null);
	}

	/**
	 * Restore a path from addApi history or core load.
	 * @param {string} apiPath - API path to restore.
	 * @param {?string} moduleId - ModuleId to restore.
	 * @returns {Promise<void>}
	 * @private
	 *
	 * @description
	 * Attempts to reapply a previous addApi entry or rebuild the core API for the path.
	 *
	 * @example
	 * await this.restoreApiPath("plugins", "plugins-core");
	 */
	async restoreApiPath(apiPath, moduleId) {
		const normalizedModuleId = moduleId || null;
		const historyEntry = this.state.addHistory
			.slice()
			.reverse()
			.find((entry) => entry.apiPath === apiPath && (normalizedModuleId ? entry.moduleId === normalizedModuleId : true));

		if (historyEntry) {
			await this.addApiComponent({
				apiPath: historyEntry.apiPath,
				folderPath: historyEntry.folderPath,
				options: {
					...historyEntry.options,
					metadata: historyEntry.metadata,
					mutateExisting: true,
					forceOverwrite: true,
					collisionMode: "replace", // CRITICAL: Must use replace mode for rollback restoration
					recordHistory: false
				}
			});
			return;
		}

		if (normalizedModuleId === "base" || normalizedModuleId === "core") {
			const baseApi = await this.slothlet.builders.builder.buildAPI({
				dir: this.config.dir,
				mode: this.config.mode,
				ownership: null
			});

			const { parts } = this.normalizeApiPath(apiPath);
			const baseValue = this.getValueAtPath(baseApi, parts);
			if (baseValue === undefined) {
				this.deletePath(this.slothlet.api, parts);
				this.deletePath(this.slothlet.boundApi, parts);
				return;
			}
			await this.setValueAtPath(this.slothlet.api, parts, baseValue, {
				mutateExisting: true,
				allowOverwrite: true,
				collisionMode: "replace" // CRITICAL: Must use replace mode for restoration
			});
			await this.setValueAtPath(this.slothlet.boundApi, parts, baseValue, {
				mutateExisting: true,
				allowOverwrite: true,
				collisionMode: "replace" // CRITICAL: Must use replace mode for restoration
			});
		}
	}

	/**
	 * Recursively apply metadata to all functions in an API object.
	 * @param {unknown} target - API object or function to tag with metadata.
	 * @param {object} metadata - Metadata key/value pairs to apply.
	 * @param {WeakSet} [visited] - WeakSet to track visited objects (prevents circular refs)
	 * @param {string[]} [pathStack] - Path stack to track current depth (e.g., ["api", "math", "add"])
	 * @returns {void}
	 * @private
	 *
	 * @description
	 * Traverses the API structure and applies metadata to every function encountered.
	 * Skips reserved root-level keys (from Slothlet.RESERVED_ROOT_KEYS) at depth 0 only.
	 *
	 * @example
	 * this.applyMetadataRecursively(api.nested, { level: "nested", depth: 1 });
	 */
	applyMetadataRecursively(target, metadata, visited = new WeakSet(), pathStack = []) {
		if (!target || !this.slothlet.handlers.metadata) {
			return;
		}

		// Prevent infinite recursion on circular references
		if (visited.has(target)) {
			return;
		}
		visited.add(target);

		// Apply metadata to functions (including wrapper proxies)
		if (typeof target === "function") {
			for (const [key, value] of Object.entries(metadata)) {
				this.slothlet.handlers.metadata.setUserMetadata(target, key, value);
			}
		}

		// Recursively apply to children (for objects and function properties)
		if (typeof target === "object" || typeof target === "function") {
			for (const key of Object.keys(target)) {
				// Skip reserved root-level keys ONLY at depth 0
				const isRootLevel = pathStack.length === 0;
				const isReservedKey = this.slothlet.constructor.RESERVED_ROOT_KEYS.includes(key);
				if (isRootLevel && isReservedKey) {
					continue;
				}

				const child = target[key];
				if (child && (typeof child === "object" || typeof child === "function")) {
					this.applyMetadataRecursively(child, metadata, visited, [...pathStack, key]);
				}
			}
		}
	}

	/**
	 * Add new API modules at runtime.
	 * @param {object} params - Add parameters.
	 * @param {string} params.apiPath - API path to attach.
	 * @param {string} params.folderPath - Folder path to load.
	 * @param {Record<string, unknown>} [params.options={}] - Add options (including optional metadata).
	 * @returns {Promise<void>}
	 * @throws {SlothletError} When the instance is not loaded or inputs are invalid.
	 * @package
	 *
	 * @description
	 * Loads modules from a folder using the instance configuration and merges the resulting
	 * API under the specified apiPath.
	 *
	 * @example
	 * await manager.addApiComponent({
	 * 	apiPath: "plugins",
	 * 	folderPath: "./plugins",
	 * 	options: { moduleId: "plugins-core", metadata: { version: "1.0.0" } }
	 * });
	 */
	async addApiComponent(params) {
		const { apiPath, folderPath, options = {} } = params || {};
		const { metadata = {}, ...restOptions } = options;
		if (!this.slothlet || !this.slothlet.isLoaded) {
			throw new this.SlothletError("INVALID_CONFIG_NOT_LOADED", {
				operation: "addApi",
				validationError: true
			});
		}

		const { apiPath: normalizedPath, parts } = this.normalizeApiPath(apiPath);
		const resolvedFolderPath = await this.resolveFolderPath(folderPath);

		// Determine collision handling - check options first, then config.collision.addApi
		const collisionMode = restOptions.collisionMode || this.config.collision.addApi || "merge";
		const allowOverwrite = !!(
			restOptions.forceOverwrite ||
			restOptions.allowOverwrite ||
			collisionMode === "replace" ||
			collisionMode === "merge"
		);
		const mutateExisting = !!(restOptions.mutateExisting || collisionMode === "merge");

		const moduleId = restOptions.moduleId ? String(restOptions.moduleId) : this.buildDefaultModuleId(normalizedPath, resolvedFolderPath);
		if ((restOptions.forceOverwrite || restOptions.allowOverwrite) && !moduleId) {
			throw new this.SlothletError("INVALID_CONFIG_FORCE_OVERWRITE_REQUIRES_MODULE_ID", {
				apiPath: normalizedPath,
				validationError: true
			});
		}

		const newApi = await this.slothlet.builders.builder.buildAPI({
			dir: resolvedFolderPath,
			mode: this.config.mode,
			// Use apiPathPrefix to ensure wrappers have correct full API paths including namespace
			// This is critical for metadata.moduleID to match the actual access path
			apiPathPrefix: normalizedPath,
			collisionContext: "addApi",
			moduleId: moduleId,
			userMetadata: metadata,
			// CRITICAL: Pass collision mode so lifecycle handlers can register ownership correctly
			collisionMode: collisionMode
		});

		this.slothlet.debug("api", {
			message: "addApiComponent buildAPI return structure",
			topLevelKeys: Object.keys(newApi),
			dottedKeys: Object.keys(newApi).filter((k) => k.includes(".")),
			wrappers: Object.keys(newApi)
				.filter((k) => newApi[k]?.__wrapper)
				.map((k) => ({
					key: k,
					apiPath: newApi[k].__wrapper.apiPath,
					implKeys: Object.keys(newApi[k].__wrapper._impl || {}),
					childCacheSize: newApi[k].__wrapper._childCache?.size,
					childCacheKeys: Array.from(newApi[k].__wrapper._childCache?.keys() || [])
				})),
			nonWrappers: Object.keys(newApi)
				.filter((k) => !newApi[k]?.__wrapper)
				.map((k) => ({ key: k, type: typeof newApi[k] }))
		});

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
		this.slothlet.debug("api", {
			message: "addApiComponent finalKey",
			finalKey,
			newApiKeys
		});

		// Only extract finalKey if we're NOT using apiPathPrefix (prefix means content is already structured)
		if (newApi[finalKey] !== undefined && !normalizedPath.includes(".")) {
			this.slothlet.debug("api", {
				message: "addApiComponent extracting key",
				finalKey,
				isWrapper: this.isWrapperProxy(newApi[finalKey])
			});
			apiToMerge = newApi[finalKey];
			if (this.config.debug?.api) {
				this.slothlet.debug("api", {
					message: "addApiComponent extracted key",
					finalKey,
					extractedKeys: Object.keys(apiToMerge)
				});
			}
		} else {
			this.slothlet.debug("api", {
				message: "addApiComponent using full newApi",
				reason: "apiPathPrefix mode or no finalKey match"
			});
		}

		if (this.config.debug?.api) {
			this.slothlet.debug("api", {
				message: "addApiComponent apiToMerge keys",
				keys: Object.keys(apiToMerge)
			});
		}

		await this.setValueAtPath(this.slothlet.api, parts, apiToMerge, {
			mutateExisting,
			allowOverwrite,
			collisionMode,
			moduleId // Pass moduleId for lifecycle events
		});

		const boundApiSet = await this.setValueAtPath(this.slothlet.boundApi, parts, apiToMerge, {
			mutateExisting,
			allowOverwrite,
			collisionMode
		});

		// Only register user metadata if the API was actually set (not skipped due to collision)
		// Metadata will be looked up via apiPath stored in system metadata on each wrapper
		// CRITICAL: Use root segment only (first part) for metadata key to ensure proper merging
		// e.g., "testMerge.config" → "testMerge", "nested.deep.path" → "nested"
		if (boundApiSet && metadata && Object.keys(metadata).length > 0 && this.slothlet.handlers.metadata) {
			const rootSegment = normalizedPath.split(".")[0];
			this.slothlet.handlers.metadata.registerUserMetadata(rootSegment, metadata);
		}

		if (this.slothlet.handlers.ownership && moduleId) {
			this.registerOwnership(this.slothlet.handlers.ownership, moduleId, normalizedPath, apiToMerge);
		}

		if (this.slothlet.handlers.ownership) {
			if (restOptions.recordHistory !== false) {
				this.state.addHistory.push({
					apiPath: normalizedPath,
					folderPath: resolvedFolderPath,
					metadata,
					options: { ...restOptions, metadata, moduleId },
					moduleId
				});
			}

			if (moduleId) {
				this.state.removedModuleIds.delete(moduleId);
			}
		}
	}

	/**
	 * Remove API modules at runtime.
	 * @param {string} pathOrModuleId - API path (with dots) or module ID (with underscore) to remove.
	 * @returns {Promise<void>}
	 * @throws {SlothletError} When inputs are invalid.
	 * @package
	 *
	 * @description
	 * Removes an API subtree by apiPath or removes all paths owned by a moduleId.
	 * Automatically detects whether the parameter is a moduleId (contains underscore) or apiPath.
	 *
	 * @example
	 * await manager.removeApiComponent("plugins.tools"); // Remove by API path
	 *
	 * @example
	 * await manager.removeApiComponent("plugins_abc123"); // Remove by module ID
	 */
	async removeApiComponent(pathOrModuleId) {
		if (typeof pathOrModuleId !== "string" || !pathOrModuleId) {
			throw new this.SlothletError("INVALID_ARGUMENT", {
				argument: "pathOrModuleId",
				expected: "non-empty string",
				received: typeof pathOrModuleId,
				validationError: true
			});
		}

		// Detect if this is a moduleId or apiPath
		// API paths contain dots (e.g., "plugins.tools"), moduleIds don't
		const isModuleId = !pathOrModuleId.includes(".");
		const apiPath = isModuleId ? null : pathOrModuleId;
		// Extract moduleId from full moduleID format "moduleId:path" if present
		let moduleId = isModuleId ? pathOrModuleId.split(":")[0] : null;

		// If it's a moduleId, find the actual registered moduleId (with suffix)
		// This allows api.remove("removableInternal") to remove "removableInternal_abc123"
		if (moduleId && this.slothlet.handlers.ownership) {
			const registeredModules = Array.from(this.slothlet.handlers.ownership.moduleToPath.keys());
			const matchingModule = registeredModules.find((m) => m === moduleId || m.startsWith(`${moduleId}_`));
			if (matchingModule) {
				moduleId = matchingModule;
			}
		}
		if (!this.slothlet || !this.slothlet.isLoaded) {
			throw new this.SlothletError("INVALID_CONFIG_NOT_LOADED", {
				operation: "removeApi",
				validationError: true
			});
		}

		if (apiPath && moduleId) {
			const normalizedPath = this.normalizeApiPath(apiPath).apiPath;
			const moduleIdKey = String(moduleId);
			const history = this.slothlet.handlers.ownership?.getPathHistory?.(normalizedPath) || [];
			const ownershipResult = this.removeOwnershipEntry(this.slothlet.handlers.ownership, normalizedPath, moduleIdKey);
			const pathParts = this.normalizeApiPath(apiPath).parts;
			if (ownershipResult.action === "delete") {
				this.deletePath(this.slothlet.api, pathParts);
				this.deletePath(this.slothlet.boundApi, pathParts);
				// Clean up user metadata (use root segment only)
				if (this.slothlet.handlers.metadata) {
					const rootSegment = normalizedPath.split(".")[0];
					this.slothlet.handlers.metadata.removeUserMetadataByApiPath(rootSegment);
				}
				return;
			}
			if (ownershipResult.action === "restore") {
				const restoredValue = this.slothlet.handlers.ownership?.getCurrentValue?.(normalizedPath);
				if (restoredValue !== undefined) {
					await this.setValueAtPath(this.slothlet.api, pathParts, restoredValue, {
						mutateExisting: true,
						allowOverwrite: true,
						collisionMode: "replace" // CRITICAL: Must use replace mode for rollback
					});
					await this.setValueAtPath(this.slothlet.boundApi, pathParts, restoredValue, {
						mutateExisting: true,
						allowOverwrite: true,
						collisionMode: "replace" // CRITICAL: Must use replace mode for rollback
					});
					return;
				}
				await this.restoreApiPath(normalizedPath, ownershipResult.restoreModuleId);
				return;
			}
			if (ownershipResult.action === "none" && history.length === 0) {
				this.deletePath(this.slothlet.api, pathParts);
				this.deletePath(this.slothlet.boundApi, pathParts);
			}
			return;
		}

		if (moduleId) {
			const moduleIdKey = String(moduleId);
			const result = this.slothlet.handlers.ownership?.unregister?.(moduleIdKey) || { removed: [], rolledBack: [] };

			// Collect all paths that were owned by this module
			const allPaths = [...result.removed, ...result.rolledBack.map((r) => r.apiPath)];

			// Deduplicate paths (ownership may track duplicates due to nested structures)
			const uniquePaths = [...new Set(allPaths)];

			// Filter paths: separate those with no owners (delete) vs those with owners (rollback)
			const pathsToDelete = [];
			const pathsToRollback = [];

			for (const path of uniquePaths) {
				const currentOwner = this.slothlet.handlers.ownership?.getCurrentOwner?.(path);

				// Check if path has children by looking for paths starting with this path + "."
				const hasChildren = uniquePaths.some((p) => p !== path && p.startsWith(path + "."));

				// Only rollback if there's an owner AND it's not the module being removed
				if (currentOwner && currentOwner.moduleId !== moduleIdKey) {
					// Has different owner → rollback to current owner
					pathsToRollback.push({ apiPath: path, restoredTo: currentOwner.moduleId });
				} else if (!hasChildren) {
					// No owner (or self-ownership) and no children → safe to delete
					pathsToDelete.push(path);
				}
				// If has children but no owner, skip - children will handle their own cleanup
			}

			// Sort paths to delete by depth (deep to shallow)
			// This ensures we delete children before parent containers
			pathsToDelete.sort((a, b) => {
				const depthA = (a.match(/\./g) || []).length;
				const depthB = (b.match(/\./g) || []).length;
				return depthB - depthA; // Reverse sort for deep-to-shallow
			});

			// Delete paths with no owners
			for (const removedPath of pathsToDelete) {
				const { parts } = this.normalizeApiPath(removedPath);
				this.deletePath(this.slothlet.api, parts);
				this.deletePath(this.slothlet.boundApi, parts);
				// Clean up user metadata for removed path (use root segment only)
				if (this.slothlet.handlers.metadata) {
					const rootSegment = removedPath.split(".")[0];
					this.slothlet.handlers.metadata.removeUserMetadataByApiPath(rootSegment);
				}
			}

			// Rollback paths that still have owners
			for (const rollback of pathsToRollback) {
				// Get the previous _impl from ownership and set it
				const { parts } = this.normalizeApiPath(rollback.apiPath);
				const previousImpl = this.slothlet.handlers.ownership?.getCurrentValue?.(rollback.apiPath);

				if (previousImpl !== undefined) {
					// Get the existing wrapper and update its _impl
					const existingWrapper = this.getValueAtPath(this.slothlet.api, parts);
					if (existingWrapper?.__setImpl) {
						// Pass the restored moduleId for correct ownership tracking
						existingWrapper.__setImpl(previousImpl, rollback.restoredTo);
					}
					// Also update boundApi
					const existingBoundWrapper = this.getValueAtPath(this.slothlet.boundApi, parts);
					if (existingBoundWrapper?.__setImpl) {
						existingBoundWrapper.__setImpl(previousImpl, rollback.restoredTo);
					}
				}
			}

			this.state.removedModuleIds.add(moduleIdKey);
			this.state.addHistory = this.state.addHistory.filter((entry) => String(entry.moduleId) !== moduleIdKey);
			return;
		}

		if (!apiPath) {
			throw new this.SlothletError("INVALID_CONFIG_API_PATH_INVALID", {
				apiPath,
				reason: "apiPath is required for removeApi operation",
				validationError: true
			});
		}

		const { apiPath: normalizedPath, parts } = this.normalizeApiPath(apiPath);
		const ownershipResult = this.removeOwnershipEntry(this.slothlet.handlers.ownership, normalizedPath, null);
		if (ownershipResult.action === "none") {
			this.deletePath(this.slothlet.api, parts);
			this.deletePath(this.slothlet.boundApi, parts);
			// Clean up user metadata
			if (this.slothlet.handlers.metadata) {
				this.slothlet.handlers.metadata.removeUserMetadataByApiPath(normalizedPath);
			}
			return;
		}
		if (ownershipResult.action === "delete") {
			this.deletePath(this.slothlet.api, parts);
			this.deletePath(this.slothlet.boundApi, parts);
			// Clean up user metadata
			if (this.slothlet.handlers.metadata) {
				this.slothlet.handlers.metadata.removeUserMetadataByApiPath(normalizedPath);
			}
			return;
		}
		if (ownershipResult.action === "restore") {
			const restoredValue = this.slothlet.handlers.ownership?.getCurrentValue?.(normalizedPath);
			if (restoredValue !== undefined) {
				await this.setValueAtPath(this.slothlet.api, parts, restoredValue, {
					mutateExisting: true,
					allowOverwrite: true,
					collisionMode: "replace" // CRITICAL: Must use replace mode for rollback
				});
				await this.setValueAtPath(this.slothlet.boundApi, parts, restoredValue, {
					mutateExisting: true,
					allowOverwrite: true,
					collisionMode: "replace" // CRITICAL: Must use replace mode for rollback
				});
				return;
			}
			await this.restoreApiPath(normalizedPath, ownershipResult.restoreModuleId);
		}
	}

	/**
	 * Reload API modules from addApi history.
	 * @param {object} params - Reload parameters.
	 * @param {?string} params.apiPath - API path to reload.
	 * @param {?string} params.moduleId - ModuleId to reload.
	 * @returns {Promise<void>}
	 * @package
	 *
	 * @description
	 * Replays recorded addApi calls using mutateExisting to preserve references.
	 *
	 * @example
	 * await manager.reloadApiComponent({ apiPath: "plugins" });
	 */
	async reloadApiComponent(params) {
		const { apiPath, moduleId } = params || {};
		if (!this.slothlet || !this.slothlet.isLoaded) {
			throw new this.SlothletError("INVALID_CONFIG_NOT_LOADED", {
				operation: "reloadApi",
				validationError: true
			});
		}

		let entries = this.state.addHistory;
		if (apiPath) {
			const normalizedPath = this.normalizeApiPath(apiPath).apiPath;
			entries = entries.filter((entry) => entry.apiPath === normalizedPath);
		} else if (moduleId) {
			entries = entries.filter((entry) => entry.moduleId === moduleId);
		}

		if (entries.length === 0 && apiPath) {
			await this.restoreApiPath(this.normalizeApiPath(apiPath).apiPath, "base");
			return;
		}

		for (const entry of entries) {
			if (entry.moduleId && this.state.removedModuleIds.has(entry.moduleId)) {
				continue;
			}
			await this.addApiComponent({
				apiPath: entry.apiPath,
				folderPath: entry.folderPath,
				options: {
					...entry.options,
					metadata: entry.metadata,
					mutateExisting: true,
					forceOverwrite: true,
					recordHistory: false
				}
			});
		}
	}
}
