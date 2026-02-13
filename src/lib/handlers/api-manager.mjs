/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /src/lib/handlers/api-manager.mjs
 *	@Date: 2026-01-24 07:14:02 -08:00 (1737726842)
 *	@Author: Nate Hyson <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Hyson <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-02-09 22:31:44 -08:00 (1770705104)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Hot reload handlers for adding, removing, and reloading API components at
 * runtime using class-based architecture.
 * @module @cldmv/slothlet/handlers/api-manager
 * @package
 *
 * @description
 * Provides runtime handlers that extend a loaded API with new modules, remove modules by path
 * or moduleID, and reapply additions to support hot reload workflows. This module manages
 * per-instance state as class properties and applies updates without requiring a full instance rebuild.
 *
 * @example
 * // ESM
 * import { ApiManager } from "@cldmv/slothlet/handlers/api-manager";
 * const manager = new ApiManager(instance);
 * await manager.addApiComponent({
 * 	apiPath: "plugins",
 * 	folderPath: "./plugins",
 * 	options: { moduleID: "plugins-core", metadata: { version: "1.0.0" } }
 * });
 *
 * @example
 * // CJS
 * const { ApiManager } = require("@cldmv/slothlet/handlers/api-manager");
 * const manager = new ApiManager(instance);
 * await manager.addApiComponent({
 * 	apiPath: "plugins",
 * 	folderPath: "./plugins",
 * 	options: { moduleID: "plugins-core", metadata: { version: "1.0.0" } }
 * });
 */
import fs from "node:fs/promises";
import path from "node:path";
import { ComponentBase } from "@cldmv/slothlet/factories/component-base";
import { UnifiedWrapper } from "@cldmv/slothlet/handlers/unified-wrapper";

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
			initialConfig: slothlet?.config || null,
			operationHistory: [] // Chronological log of all add/remove operations
		};
	}

	/**
	 * Normalize and validate an API path.
	 * @param {string|string[]} apiPath - Dot-delimited API path, array of path segments, or empty/null for root.
	 * @returns {{ apiPath: string, parts: string[] }} Normalized path data.
	 * @throws {SlothletError} When apiPath is invalid.
	 * @private
	 *
	 * @description
	 * Ensures the API path is valid. Accepts:
	 * - String: "some.path" → parts: ["some", "path"]
	 * - Array: ["some", "path"] → parts: ["some", "path"]
	 * - Empty string, null, or undefined → root level (parts: [])
	 * Non-empty paths must contain no empty segments.
	 *
	 * @example
	 * const { apiPath, parts } = this.normalizeApiPath("plugins.tools");
	 * const { apiPath, parts } = this.normalizeApiPath(["plugins", "tools"]);
	 * const { apiPath, parts } = this.normalizeApiPath(""); // Root level: parts = []
	 */
	normalizeApiPath(apiPath) {
		// Allow empty string, null, or undefined for root-level operations
		if (apiPath === "" || apiPath === null || apiPath === undefined) {
			return { apiPath: "", parts: [] };
		}

		// Handle array input - convert to dot-separated string
		if (Array.isArray(apiPath)) {
			// Validate array elements
			if (apiPath.length === 0) {
				return { apiPath: "", parts: [] };
			}

			for (let i = 0; i < apiPath.length; i++) {
				if (typeof apiPath[i] !== "string") {
					throw new this.SlothletError("INVALID_CONFIG_API_PATH_INVALID", {
						apiPath,
						segment: apiPath[i],
						index: i,
						reason: "array elements must be strings",
						validationError: true
					});
				}
				if (apiPath[i].trim() === "") {
					throw new this.SlothletError("INVALID_CONFIG_API_PATH_INVALID", {
						apiPath,
						segment: apiPath[i],
						index: i,
						reason: "array contains empty string segments",
						validationError: true
					});
				}
			}

			// Check for reserved names
			if (apiPath[0] === "slothlet" || (apiPath.length === 1 && (apiPath[0] === "shutdown" || apiPath[0] === "destroy"))) {
				throw new this.SlothletError("INVALID_CONFIG_API_PATH_INVALID", {
					apiPath,
					reason: "conflicts with reserved names (slothlet, shutdown, destroy)",
					index: undefined,
					segment: undefined,
					validationError: true
				});
			}

			return { apiPath: apiPath.join("."), parts: apiPath };
		}

		if (typeof apiPath !== "string") {
			throw new this.SlothletError("INVALID_CONFIG_API_PATH_INVALID", {
				apiPath,
				reason: "must be a string, array of strings, empty string (root), or null/undefined (root)",
				index: undefined,
				segment: undefined,
				validationError: true
			});
		}

		const normalized = apiPath.trim();

		// Empty string after trim means root
		if (normalized === "") {
			return { apiPath: "", parts: [] };
		}

		const parts = normalized.split(".");
		if (parts.length === 0 || parts.some((part) => part.trim() === "")) {
			throw new this.SlothletError("INVALID_CONFIG_API_PATH_INVALID", {
				apiPath: normalized,
				reason: "contains empty path segments",
				index: undefined,
				segment: undefined,
				validationError: true
			});
		}

		if (parts[0] === "slothlet" || normalized === "shutdown" || normalized === "destroy") {
			throw new this.SlothletError("INVALID_CONFIG_API_PATH_INVALID", {
				apiPath: normalized,
				reason: "conflicts with reserved names (slothlet, shutdown, destroy)",
				index: undefined,
				segment: undefined,
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
	 * Build a default moduleID when none is provided.
	 * @param {string} apiPath - API path for this module.
	 * @param {string} resolvedFolderPath - Absolute folder path.
	 * @returns {string} Stable module identifier.
	 * @private
	 *
	 * @description
	 * Generates a stable moduleID using the apiPath and resolved folder path.
	 *
	 * @example
	 * const moduleID = this.buildDefaultModuleId("plugins", "/abs/path/plugins");
	 */
	buildDefaultModuleId(apiPath, resolvedFolderPath) {
		const randomSuffix = Math.random().toString(36).substring(2, 8);
		const prefix = apiPath || "auto";
		return `${prefix}_${randomSuffix}`;
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
	ensureParentPath(root, parts, options = {}) {
		const { moduleID, sourceFolder } = options;
		let current = root;
		for (let i = 0; i < parts.length - 1; i += 1) {
			const part = parts[i];
			const next = current[part];
			if (next === undefined) {
				// Create a UnifiedWrapper for the container instead of plain object
				const containerPath = parts.slice(0, i + 1).join(".");
				const containerWrapper = new UnifiedWrapper(this.slothlet, {
					mode: this.config.mode,
					apiPath: containerPath,
					moduleID: moduleID,
					sourceFolder: sourceFolder
				});
				// Set impl to empty object so it acts as a namespace container
				containerWrapper.___setImpl({}, moduleID);
				current[part] = containerWrapper.createProxy();
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
				index: undefined,
				segment: undefined,
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
			(value.__wrapper || value.___setImpl || value.___getState)
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
	async syncWrapper(existingProxy, nextProxy, config, collisionMode = "replace", moduleID = null) {
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
		// In merge mode, preserve existing materializer to avoid replacing existing module behavior
		if (nextWrapper.____slothletInternal.materializeFunc && collisionMode !== "merge") {
			existingWrapper.____slothletInternal.materializeFunc = nextWrapper.____slothletInternal.materializeFunc;
		}

		// THE ACTUAL FIX: Transfer _childCache entries directly
		// nextProxy.__impl is empty because buildAPI already moved everything to _childCache
		// We need to transfer the child wrappers from nextWrapper to existingWrapper
		// Transfer children from wrapper properties
		const existingChildKeys = Object.keys(existingWrapper).filter((k) => !k.startsWith("_") && !k.startsWith("__"));
		const nextChildKeys = Object.keys(nextWrapper).filter((k) => !k.startsWith("_") && !k.startsWith("__"));

		if (config?.debug?.api) {
			this.slothlet.debug("api", {
				message: "syncWrapper before merge",
				existingCacheSize: existingChildKeys.length,
				nextCacheSize: nextChildKeys.length
			});
			this.slothlet.debug("api", {
				message: "syncWrapper next wrapper impl keys",
				implKeys: Object.keys(nextWrapper.____slothletInternal.impl || {})
			});
			this.slothlet.debug("api", {
				message: "syncWrapper next wrapper childCache keys",
				childCacheKeys: nextChildKeys
			});
		}

		// Merge child wrappers from next to existing based on collision mode
		// IMPORTANT: _childCache should contain PROXIES (from createProxy()), not raw wrappers
		if (collisionMode === "replace") {
			// CRITICAL: Use ___setImpl to trigger lifecycle events for ownership tracking
			// This ensures impl:changed fires with the correct moduleID
			if (existingWrapper.___setImpl && nextWrapper.____slothletInternal.impl !== undefined) {
				// Pass moduleID for correct ownership tracking in lifecycle events
				existingWrapper.___setImpl(nextWrapper.____slothletInternal.impl, moduleID);
			} else if (nextWrapper.____slothletInternal.impl === undefined) {
				// For lazy mode or unmaterialized wrappers, clear the existing impl
				// so that materialization will load the correct module
				existingWrapper.____slothletInternal.impl = null;
			} else {
				// Fallback for non-unified wrappers
				if (nextWrapper.____slothletInternal.impl !== undefined) {
					existingWrapper.____slothletInternal.impl = nextWrapper.____slothletInternal.impl;
					// Update callable status
					if (typeof nextWrapper.____slothletInternal.impl === "function" || (nextWrapper.____slothletInternal.impl && typeof nextWrapper.____slothletInternal.impl.default === "function")) {
						existingWrapper.isCallable = true;
					}
				}
			}

			// Clear existing children by deleting properties
			for (const key of existingChildKeys) {
				delete existingWrapper[key];
			}
			existingWrapper.___adoptImplChildren();

			// Also copy any child wrappers that nextWrapper already has
			// (this handles cases where nextWrapper was built with pre-existing children)
			for (const key of nextChildKeys) {
				const childValue = nextWrapper[key];
				Object.defineProperty(existingWrapper, key, {
					value: childValue,
					writable: false,
					enumerable: true,
					configurable: true
				});
			}
		} else if (collisionMode === "merge") {
			// Keep existing, only add new keys
			// CRITICAL: Use hasOwnProperty instead of 'in' to avoid matching ComponentBase
			// prototype getters (e.g., 'config', 'debug') which would prevent child adoption
			for (const key of nextChildKeys) {
				const isInternal = typeof key === "string" && (key.startsWith("_") || key.startsWith("__"));
				if (!isInternal && !Object.prototype.hasOwnProperty.call(existingWrapper, key)) {
					const childValue = nextWrapper[key];
					Object.defineProperty(existingWrapper, key, {
						value: childValue,
						writable: false,
						enumerable: true,
						configurable: true
					});
				} else if (!isInternal) {
					// Both existing and next have this key - recursively merge if both are wrappers
					// Only recurse if the next child has children to merge (skip leaf wrappers)
					const existingChild = existingWrapper[key];
					const nextChild = nextWrapper[key];
					if (this.isWrapperProxy(existingChild) && this.isWrapperProxy(nextChild)) {
						const syncWrapper_nextChildWrapper = nextChild.__wrapper || nextChild;
						const syncWrapper_hasGrandChildren = Object.keys(syncWrapper_nextChildWrapper).some(
							(k) => !k.startsWith("_") && !k.startsWith("__")
						);
						if (syncWrapper_hasGrandChildren) {
							await this.syncWrapper(existingChild, nextChild, config, collisionMode, moduleID);
						}
					}
				}
			}
		} else if (collisionMode === "merge-replace") {
			// Add new keys and replace existing
			for (const key of nextChildKeys) {
				const childValue = nextWrapper[key];
				const isInternal = typeof key === "string" && (key.startsWith("_") || key.startsWith("__"));
				// CRITICAL: Use hasOwnProperty to avoid matching ComponentBase prototype getters
				if (!isInternal && Object.prototype.hasOwnProperty.call(existingWrapper, key)) {
					// Both exist - recursively sync if both are wrappers (preserves wrapper identity)
					const existingChild = existingWrapper[key];
					if (this.isWrapperProxy(existingChild) && this.isWrapperProxy(childValue)) {
						await this.syncWrapper(existingChild, childValue, config, collisionMode, moduleID);
					} else {
						// Non-wrapper: delete and replace
						delete existingWrapper[key];
						Object.defineProperty(existingWrapper, key, {
							value: childValue,
							writable: false,
							enumerable: true,
							configurable: true
						});
					}
				} else if (!isInternal) {
					// New key - add it
					Object.defineProperty(existingWrapper, key, {
						value: childValue,
						writable: false,
						enumerable: true,
						configurable: true
					});
				}
			}
		}

		// Mark as materialized only if _impl is actually materialized (not a function)
		if (existingWrapper.____slothletInternal.state) {
			// In lazy mode, _impl being a function means it's not materialized yet
			const isActuallyMaterialized = existingWrapper.____slothletInternal.impl && typeof existingWrapper.____slothletInternal.impl !== "function";
			existingWrapper.____slothletInternal.state.materialized = isActuallyMaterialized;
			existingWrapper.____slothletInternal.state.inFlight = false;
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
			await this.syncWrapper(existingValue, nextValue, config, options.collisionMode, options.moduleID);
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
					collisionMode: options.collisionMode,
					moduleID: options.moduleID
				});
				return;
			}

			// Fallback: if nextValue has no properties, try ___setImpl
			if (existingValue.___setImpl) {
				if (config?.debug?.api) {
					this.slothlet.debug("api", {
						message: "mutateApiValue - using ___setImpl fallback"
					});
				}
				existingValue.___setImpl(nextValue?.__impl ?? nextValue);
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
				collisionMode: options.collisionMode,
				moduleID: options.moduleID
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
		const parent = this.ensureParentPath(root, parts, {
			moduleID: options.moduleID,
			sourceFolder: options.sourceFolder
		});
		const finalKey = parts[parts.length - 1];
		const existing = parent ? parent[finalKey] : undefined;
		const collisionMode = options.collisionMode || "merge";
		const moduleID = options.moduleID; // Extract moduleID for lifecycle events

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
					index: undefined,
					segment: undefined,
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
						{ removeMissing: false, allowOverwrite: true, collisionMode: "replace", moduleID },
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
	 * @returns {Promise<boolean>} True when a value was deleted.
	 * @private
	 *
	 * @description
	 * Removes the property at the provided path and cleans up any empty parent objects.
	 *
	 * @example
	 * const deleted = await await this.deletePath(api, ["plugins", "tools"]);
	 */
	async deletePath(root, parts) {
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

		// Emit lifecycle event for removal BEFORE deletion
		if (removedImpl && this.slothlet.handlers?.lifecycle) {
			const metadata = this.slothlet.handlers.metadata?.getMetadata?.(removedImpl);
			await this.slothlet.handlers.lifecycle.emit("impl:removed", {
				apiPath,
				impl: removedImpl,
				source: "removal",
				moduleID: metadata?.moduleID,
				filePath: metadata?.filePath,
				sourceFolder: metadata?.sourceFolder
			});
		}

		// CRITICAL: Delete from wrapper's child properties AND _impl if current is a proxy
		// Properties are stored in wrapper and _impl, not on the proxy itself
		if (current.__wrapper) {
			const wrapper = current.__wrapper;
			// Delete from wrapper (child properties)
			const isInternal = typeof finalKey === "string" && (finalKey.startsWith("_") || finalKey.startsWith("__"));
			if (!isInternal && finalKey in wrapper) {
				delete wrapper[finalKey];
			}
			// Delete from _impl (the actual implementation object)
			if (wrapper.____slothletInternal.impl && typeof wrapper.____slothletInternal.impl === "object") {
				delete wrapper.____slothletInternal.impl[finalKey];
			}
		}

		// Also delete the property from the object/proxy itself
		delete current[finalKey];

		// AFTER deletion, clean up wrapper state for removed proxy
		if (removedImpl && (typeof removedImpl === "object" || typeof removedImpl === "function")) {
			// If this is a proxy with a wrapper, clean it up
			if (removedImpl.__wrapper) {
				const wrapper = removedImpl.__wrapper;
				// Set impl to null to prevent stale access
				if (wrapper.____slothletInternal.impl !== undefined) {
					wrapper.____slothletInternal.impl = null;
				}
				// Clear children from wrapper to release references
				const childKeys = Object.keys(wrapper).filter((k) => !k.startsWith("_") && !k.startsWith("__"));
				for (const key of childKeys) {
					delete wrapper[key];
				}
				// Mark as un-materialized so it won't try to access null impl
				if (wrapper.____slothletInternal.state) {
					wrapper.____slothletInternal.state.materialized = false;
					wrapper.____slothletInternal.state.inFlight = false;
				}
			}
		}

		// Clean up user metadata for removed impl using root segment
		if (this.slothlet.handlers?.metadata) {
			const rootSegment = apiPath.split(".")[0];
			this.slothlet.handlers.metadata.removeUserMetadataByApiPath(rootSegment);
		}

		for (let i = stack.length - 1; i >= 0; i -= 1) {
			const { parent, key } = stack[i];
			const value = parent[key];
			if (value && (typeof value === "object" || typeof value === "function") && Object.keys(value).length === 0) {
				delete parent[key];
			}
		}


return true;
}
	/**
	 * Restore a path from api.slothlet.api.add history or core load.
	 * @param {string} apiPath - API path to restore.
	 * @param {?string} moduleID - ModuleId to restore.
	 * @returns {Promise<void>}
	 * @private
	 *
	 * @description
	 * Attempts to reapply a previous api.slothlet.api.add entry or rebuild the core API for the path.
	 *
	 * @example
	 * await this.restoreApiPath("plugins", "plugins-core");
	 */
	async restoreApiPath(apiPath, moduleID) {
		const normalizedModuleId = moduleID || null;
		const historyEntry = this.state.addHistory
			.slice()
			.reverse()
			.find((entry) => entry.apiPath === apiPath && (normalizedModuleId ? entry.moduleID === normalizedModuleId : true));

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
				moduleID: "base" // Use "base" as moduleID for temporary API
			});

			const { parts } = this.normalizeApiPath(apiPath);
			let baseValue = this.getValueAtPath(baseApi, parts);
			if (baseValue === undefined) {
				await this.deletePath(this.slothlet.api, parts);
				await this.deletePath(this.slothlet.boundApi, parts);
				return;
			}

			// Extract raw implementation from temporary wrapper IF it's materialized
			// The temporary buildAPI creates wrappers which we need to unwrap
			// For eager mode: __impl is the actual implementation (object/function) - extract it
			// For lazy mode: if __impl is a function, it's unmaterialized - extract it anyway for reload
			if (baseValue && baseValue.__impl !== undefined) {
				baseValue = baseValue.__impl;
			}

			await this.setValueAtPath(this.slothlet.api, parts, baseValue, {
				mutateExisting: true,
				allowOverwrite: true,
				collisionMode: "replace", // CRITICAL: Must use replace mode for restoration
				moduleID: normalizedModuleId
			});
			await this.setValueAtPath(this.slothlet.boundApi, parts, baseValue, {
				mutateExisting: true,
				allowOverwrite: true,
				collisionMode: "replace", // CRITICAL: Must use replace mode for restoration
				moduleID: normalizedModuleId
			});
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
	 * 	options: { moduleID: "plugins-core", metadata: { version: "1.0.0" } }
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

		// Determine collision handling
		// forceOverwrite flag forces replace mode (overrides config)
		// Otherwise use explicit collisionMode option or fall back to config default
		let collisionMode;
		if (restOptions.forceOverwrite) {
			collisionMode = "replace";
		} else {
			collisionMode = restOptions.collisionMode || this.config.api?.collision?.api || "error";
		}

		const mutateExisting = !!(restOptions.mutateExisting || collisionMode === "merge");

		const moduleID = restOptions.moduleID ? String(restOptions.moduleID) : this.buildDefaultModuleId(normalizedPath, resolvedFolderPath);
		if (restOptions.forceOverwrite && !moduleID) {
			throw new this.SlothletError("INVALID_CONFIG_FORCE_OVERWRITE_REQUIRES_MODULE_ID", {
				apiPath: normalizedPath,
				validationError: true
			});
		}

		const newApi = await this.slothlet.builders.builder.buildAPI({
			dir: resolvedFolderPath,
			mode: this.config.mode,
			// Use apiPathPrefix so wrappers have correct full API paths
			// User specified the path, folder loads normally under that path
			// Empty string means root level (no prefix)
			apiPathPrefix: normalizedPath,
			collisionContext: "addApi",
			moduleID: moduleID,
			// CRITICAL: Pass collision mode so lifecycle handlers can register ownership correctly
			collisionMode: collisionMode
		});

		// Store API in cache (PRIMARY STORAGE)
		if (this.slothlet.handlers.apiCacheManager) {
			this.slothlet.handlers.apiCacheManager.set(moduleID, {
				endpoint: normalizedPath,
				moduleID: moduleID,
				api: newApi,
				folderPath: resolvedFolderPath,
				mode: this.config.mode,
				sanitizeOptions: this.config.sanitize || {},
				collisionMode: collisionMode,
				config: { ...this.config },
				timestamp: Date.now()
			});
		}

		this.slothlet.debug("api", {
			message: "addApiComponent buildAPI return structure",
			topLevelKeys: Object.keys(newApi),
			dottedKeys: Object.keys(newApi).filter((k) => k.includes(".")),
			wrappers: Object.keys(newApi)
				.filter((k) => newApi[k]?.__wrapper)
				.map((k) => ({
					key: k,
					apiPath: newApi[k].__wrapper.apiPath,
					implKeys: Object.keys(newApi[k].__wrapper.____slothletInternal.impl || {}),
					childCacheSize: Object.keys(newApi[k].__wrapper).filter((k) => !k.startsWith("_") && !k.startsWith("__")).length,
					childCacheKeys: Object.keys(newApi[k].__wrapper).filter((k) => !k.startsWith("_") && !k.startsWith("__"))
				})),
			nonWrappers: Object.keys(newApi)
				.filter((k) => !newApi[k]?.__wrapper)
				.map((k) => ({ key: k, type: typeof newApi[k] }))
		});

		// Use the full newApi structure - user specified the path, folder loads under it
		// Example: api.add("math", folder_with_math.mjs) creates api.math.math.add
		// Example: api.add("", folder) or api.add(null, folder) loads directly to root
		// This is expected - user said "load under math", folder creates "math" namespace
		let apiToMerge = newApi;

		if (this.config.debug?.api) {
			this.slothlet.debug("api", {
				message: "addApiComponent apiToMerge keys",
				keys: Object.keys(apiToMerge),
				isRootLevel: parts.length === 0
			});
		}

		// For root-level additions (empty path), merge keys directly into API
		// For nested paths, wrap in container
		// Track if any API assignments succeeded (for metadata registration)
		let anyAssignmentSucceeded = false;

		if (parts.length === 0) {
			// Root level - merge each key from newApi directly into api
			for (const key of Object.keys(newApi)) {
				const result1 = await this.setValueAtPath(this.slothlet.api, [key], newApi[key], {
					mutateExisting,
					collisionMode,
					moduleID,
					sourceFolder: resolvedFolderPath
				});

				const result2 = await this.setValueAtPath(this.slothlet.boundApi, [key], newApi[key], {
					mutateExisting,
					collisionMode,
					moduleID,
					sourceFolder: resolvedFolderPath
				});

				// If at least one succeeded, mark as successful
				if (result1 || result2) {
					anyAssignmentSucceeded = true;
				}
			}
		} else {
			// Nested path - wrap apiToMerge in a UnifiedWrapper for the container
			// This ensures api.lookup.__metadata exists and works properly
			// The wrapper acts as a namespace container for the loaded API modules
			if (!apiToMerge.__wrapper) {
				// CRITICAL: If buildAPI returned a function (root contributor pattern),
				// extract properties into a plain object for the container wrapper.
				// The container is a namespace, not a callable — root contributor behavior
				// only applies at the root level, not when loaded under a nested path.
				let implForContainer = apiToMerge;
				if (typeof apiToMerge === "function") {
					implForContainer = {};
					for (const key of Object.keys(apiToMerge)) {
						implForContainer[key] = apiToMerge[key];
					}
				}
				const containerWrapper = new UnifiedWrapper(this.slothlet, {
					apiPath: normalizedPath,
					mode: this.config.mode,
					isCallable: false, // Container is a namespace, not callable
					moduleID: moduleID,
					filePath: resolvedFolderPath,
					sourceFolder: resolvedFolderPath
				});
				// Set the apiToMerge object as the impl
				containerWrapper.___setImpl(implForContainer, moduleID);
				// Replace apiToMerge with the wrapped proxy
				apiToMerge = containerWrapper.createProxy();
			}

			const result1 = await this.setValueAtPath(this.slothlet.api, parts, apiToMerge, {
				mutateExisting,
				collisionMode,
				moduleID, // Pass moduleID for lifecycle events
				sourceFolder: resolvedFolderPath // Pass sourceFolder for wrapper creation
			});

			const result2 = await this.setValueAtPath(this.slothlet.boundApi, parts, apiToMerge, {
				mutateExisting,
				collisionMode,
				moduleID, // Pass moduleID for lifecycle events (boundApi container needs it too)
				sourceFolder: resolvedFolderPath // Pass sourceFolder for wrapper creation
			});

			// If at least one succeeded, mark as successful
			if (result1 || result2) {
				anyAssignmentSucceeded = true;
			}
		}

		// CRITICAL: Await any fire-and-forget materializations before proceeding
		// During collision handling, lazy folder wrappers trigger materialization in the background
		// We must wait for these to complete before returning, otherwise:
		// 1. Metadata may not be fully registered for nested children
		// 2. Immediate remove() calls may not clean up all metadata
		// 3. Tests may see inconsistent state
		if (anyAssignmentSucceeded) {
			const pendingMaterializations = [];
			const seenWrappers = new Set();

			// Helper to recursively find wrappers with pending materialization
			const collectPendingMaterializations = (obj, depth = 0) => {
				if (!obj || typeof obj !== "object" || depth > 10) return;

				if (obj.__wrapper) {
					const wrapper = obj.__wrapper;
					// Skip if we've already processed this wrapper (avoid infinite recursion)
					if (seenWrappers.has(wrapper)) return;
					seenWrappers.add(wrapper);

					// Check if materialization is in-flight
					if (wrapper.____materializationPromise) {
						pendingMaterializations.push(wrapper.____materializationPromise);
					}

					// Check wrapper child properties for nested wrappers that might be materializing
					const childKeys = Object.keys(wrapper).filter((k) => !k.startsWith("_") && !k.startsWith("__"));
					for (const key of childKeys) {
						collectPendingMaterializations(wrapper[key], depth + 1);
					}
				}

				// Recurse into child properties
				for (const key of Object.keys(obj)) {
					if (key !== "__wrapper") {
						collectPendingMaterializations(obj[key], depth + 1);
					}
				}
			};

			// Collect from the actual API path where we just added
			// This ensures we catch any fire-and-forget materializations that were triggered
			if (parts.length === 0) {
				// Root level - check each key we just added
				for (const key of Object.keys(newApi)) {
					if (this.slothlet.api[key]) {
						collectPendingMaterializations(this.slothlet.api[key]);
					}
				}
			} else {
				// Nested path - check the container we just modified
				let current = this.slothlet.api;
				for (const part of parts) {
					if (current && current[part]) {
						current = current[part];
					} else {
						break;
					}
				}
				if (current) {
					collectPendingMaterializations(current);
				}
			}

			// Wait for all pending materializations to complete
			if (pendingMaterializations.length > 0) {
				if (this.config.debug?.api) {
					this.slothlet.debug("api", {
						message: `Awaiting ${pendingMaterializations.length} pending materialization(s) before completing add`,
						apiPath: normalizedPath
					});
				}
				await Promise.all(pendingMaterializations);
			}
		}

		// Only register user metadata if the API was actually set (not skipped due to collision)
		// Metadata will be looked up via apiPath stored in system metadata on each wrapper
		// CRITICAL: Use root segment only (first part) for metadata key to ensure proper merging
		// e.g., "testMerge.config" → "testMerge", "nested.deep.path" → "nested"
		// For root level (empty path), register metadata on each top-level key
		if (anyAssignmentSucceeded && metadata && Object.keys(metadata).length > 0 && this.slothlet.handlers.metadata) {
			if (parts.length === 0) {
				// Root level - register metadata on each key from newApi
				for (const key of Object.keys(newApi)) {
					this.slothlet.handlers.metadata.registerUserMetadata(key, metadata);
				}
			} else {
				const rootSegment = normalizedPath.split(".")[0];
				this.slothlet.handlers.metadata.registerUserMetadata(rootSegment, metadata);
			}
		}

		// Register ownership for added API
		if (this.slothlet.handlers.ownership && moduleID) {
			this.slothlet.handlers.ownership.registerSubtree(apiToMerge, moduleID, normalizedPath);
		}

		if (this.slothlet.handlers.ownership) {
			if (restOptions.recordHistory !== false) {
				this.state.addHistory.push({
					apiPath: normalizedPath,
					folderPath: resolvedFolderPath,
					options: { ...restOptions, metadata, moduleID },
					moduleID
				});

				// Track in operation history for reload replay
				this.state.operationHistory.push({
					type: "add",
					apiPath: normalizedPath,
					folderPath: resolvedFolderPath,
					options: { ...restOptions, metadata, moduleID },
					moduleID
				});
			}
		}

		return moduleID;
	}

	/**
	 * Remove API modules at runtime.
	 * @param {string} pathOrModuleId - API path (with dots) or module ID (with underscore) to remove.
	 * @returns {Promise<void>}
	 * @throws {SlothletError} When inputs are invalid.
	 * @package
	 *
	 * @description
	 * Removes an API subtree by apiPath or removes all paths owned by a moduleID.
	 * Automatically detects whether the parameter is a moduleID (contains underscore) or apiPath.
	 *
	 * @example
	 * await manager.removeApiComponent("plugins.tools"); // Remove by API path
	 *
	 * @example
	 * await manager.removeApiComponent("plugins_abc123"); // Remove by module ID
	 */
	async removeApiComponent(pathOrModuleId, options = {}) {
		const recordHistory = options.recordHistory !== false;
		if (typeof pathOrModuleId !== "string" || !pathOrModuleId) {
			throw new this.SlothletError("INVALID_ARGUMENT", {
				argument: "pathOrModuleId",
				expected: "non-empty string",
				received: typeof pathOrModuleId,
				validationError: true
			});
		}

		// Detect if this is a moduleID or apiPath
		// API paths contain dots (e.g., "plugins.tools"), moduleIDs don't
		const isModuleId = !pathOrModuleId.includes(".");
		const apiPath = isModuleId ? null : pathOrModuleId;
		// Extract moduleID from full moduleID format "moduleID:path" if present
		let moduleID = isModuleId ? pathOrModuleId.split(":")[0] : null;

		// If it's a moduleID, find the actual registered moduleID (with suffix)
		// This allows api.remove("removableInternal") to remove "removableInternal_abc123"
		// Use findLast to prefer the most recently registered module when multiple match,
		// as stale entries from prior add/remove cycles may linger due to async lazy materialization.
		if (moduleID && this.slothlet.handlers.ownership) {
			const registeredModules = Array.from(this.slothlet.handlers.ownership.moduleToPath.keys());
			const matchingModule = registeredModules.findLast((m) => m === moduleID || m.startsWith(`${moduleID}_`));
			if (matchingModule) {
				moduleID = matchingModule;
			}
		}
		if (!this.slothlet || !this.slothlet.isLoaded) {
			throw new this.SlothletError("INVALID_CONFIG_NOT_LOADED", {
				operation: "removeApi",
				validationError: true
			});
		}

		if (apiPath && moduleID) {
			const normalizedPath = this.normalizeApiPath(apiPath).apiPath;
			const moduleIDKey = String(moduleID);
			const history = this.slothlet.handlers.ownership?.getPathHistory?.(normalizedPath) || [];
			const ownershipResult = this.slothlet.handlers.ownership?.removePath?.(normalizedPath, moduleIDKey) || {
				action: "none",
				removedModuleId: null,
				restoreModuleId: null
			};
			const pathParts = this.normalizeApiPath(apiPath).parts;
			if (ownershipResult.action === "delete") {
				await this.deletePath(this.slothlet.api, pathParts);
				await this.deletePath(this.slothlet.boundApi, pathParts);
				// Clean up user metadata (use root segment only)
				if (this.slothlet.handlers.metadata) {
					const rootSegment = normalizedPath.split(".")[0];
					this.slothlet.handlers.metadata.removeUserMetadataByApiPath(rootSegment);
				}
				// Track in operation history for reload replay
				this.state.operationHistory.push({
					type: "remove",
					apiPath: normalizedPath
				});
				return true;
			}
			if (ownershipResult.action === "restore") {
				const restoredValue = this.slothlet.handlers.ownership?.getCurrentValue?.(normalizedPath);
				const restoredModuleId = this.slothlet.handlers.ownership?.getCurrentOwner?.(normalizedPath)?.moduleID;
				if (restoredValue !== undefined && restoredModuleId) {
					await this.setValueAtPath(this.slothlet.api, pathParts, restoredValue, {
						mutateExisting: true,
						allowOverwrite: true,
						collisionMode: "replace", // CRITICAL: Must use replace mode for rollback
						moduleID: restoredModuleId // Pass the restored moduleID for ownership tracking
					});
					await this.setValueAtPath(this.slothlet.boundApi, pathParts, restoredValue, {
						mutateExisting: true,
						allowOverwrite: true,
						collisionMode: "replace", // CRITICAL: Must use replace mode for rollback
						moduleID: restoredModuleId // Pass the restored moduleID for ownership tracking
					});
					// Track in operation history for reload replay
					this.state.operationHistory.push({
						type: "remove",
						apiPath: normalizedPath
					});
					return true;
				}
				await this.restoreApiPath(normalizedPath, ownershipResult.restoreModuleId);
				// Track in operation history for reload replay
				this.state.operationHistory.push({
					type: "remove",
					apiPath: normalizedPath
				});
				return true;
			}
			if (ownershipResult.action === "none" && history.length === 0) {
				await this.deletePath(this.slothlet.api, pathParts);
				await this.deletePath(this.slothlet.boundApi, pathParts);
				return true;
			}
			return false;
		}

		if (moduleID) {
			const moduleIDKey = String(moduleID);
			const result = this.slothlet.handlers.ownership?.unregister?.(moduleIDKey) || { removed: [], rolledBack: [] };

			// Collect all paths that were owned by this module
			const allPaths = [...result.removed, ...result.rolledBack.map((r) => r.apiPath)];

			// Deduplicate paths (ownership may track duplicates due to nested structures)
			const uniquePaths = [...new Set(allPaths)];

			// Filter paths: separate those with no owners (delete) vs those with owners (rollback)
			const pathsToDelete = [];
			const pathsToRollback = [];

			for (const path of uniquePaths) {
				const currentOwner = this.slothlet.handlers.ownership?.getCurrentOwner?.(path);

				// Check if path has children that will NOT be deleted
				// (i.e., children that have owners other than the module being removed)
				const hasChildrenWithOtherOwners = uniquePaths.some((p) => {
					if (p === path || !p.startsWith(path + ".")) return false;
					const childOwner = this.slothlet.handlers.ownership?.getCurrentOwner?.(p);
					return childOwner && childOwner.moduleID !== moduleIDKey;
				});

				// Only rollback if there's an owner AND it's not the module being removed
				if (currentOwner && currentOwner.moduleID !== moduleIDKey) {
					// Has different owner → rollback to current owner
					pathsToRollback.push({ apiPath: path, restoredTo: currentOwner.moduleID });
				} else if (!hasChildrenWithOtherOwners) {
					// No owner (or self-ownership) and no children with other owners → safe to delete
					pathsToDelete.push(path);
				}
				// If has children with other owners but no owner itself, skip - children will handle their own cleanup
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
				await this.deletePath(this.slothlet.api, parts);
				await this.deletePath(this.slothlet.boundApi, parts);
				// Clean up user metadata for removed path (use root segment only)
				if (this.slothlet.handlers.metadata) {
					const rootSegment = removedPath.split(".")[0];
					this.slothlet.handlers.metadata.removeUserMetadataByApiPath(rootSegment);
				}
			}

			// After deleting all leaf paths, clean up empty parent containers
			// DEFENSIVE: This is belt-and-suspenders cleanup for edge cases where root segment
			// might not be in pathsToDelete but should still be removed (e.g., ownership edge cases)
			// In normal flow, deletePath above already handles root deletion
			if (pathsToDelete.length > 0) {
				const rootSegment = pathsToDelete[0].split(".")[0];

				// Delete root segment from both API references
				// Note: boundApi is a proxy forwarding to this.api, but deletion needs to happen on both
				// to ensure proxy traps and direct access both reflect the removal
				if (rootSegment in this.slothlet.api) {
					delete this.slothlet.api[rootSegment];
				}
				if (rootSegment in this.slothlet.boundApi) {
					delete this.slothlet.boundApi[rootSegment];
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
					if (existingWrapper?.___setImpl) {
						// Pass the restored moduleID for correct ownership tracking
						existingWrapper.___setImpl(previousImpl, rollback.restoredTo);
					}
					// Also update boundApi
					const existingBoundWrapper = this.getValueAtPath(this.slothlet.boundApi, parts);
					if (existingBoundWrapper?.___setImpl) {
						existingBoundWrapper.___setImpl(previousImpl, rollback.restoredTo);
					}
				}
			}

			this.state.addHistory = this.state.addHistory.filter((entry) => String(entry.moduleID) !== moduleIDKey);

			// Delete cache entry for this moduleID (complete module removal)
			if (this.slothlet.handlers.apiCacheManager) {
				const deleted = this.slothlet.handlers.apiCacheManager.delete(moduleIDKey);
				if (deleted) {
					this.slothlet.debug("cache", {
						message: "Cache deleted for removed module",
						moduleID: moduleIDKey
					});
				}
			}

			// Track in operation history for reload replay
			// Record a single root-level remove (not individual leaf paths)
			// During replay, deletePath on the root removes the entire subtree
			if (recordHistory && pathsToDelete.length > 0) {
				const rootSegment = pathsToDelete[0].split(".")[0];
				this.state.operationHistory.push({
					type: "remove",
					apiPath: rootSegment
				});
			}
			// Return true if we actually removed something
			return pathsToDelete.length > 0 || pathsToRollback.length > 0;
		}

		if (!apiPath) {
			throw new this.SlothletError("INVALID_CONFIG_API_PATH_INVALID", {
				apiPath,
				reason: "apiPath is required for removeApi operation",
				index: undefined,
				segment: undefined,
				validationError: true
			});
		}

		const { apiPath: normalizedPath, parts } = this.normalizeApiPath(apiPath);
		const ownershipResult = this.slothlet.handlers.ownership?.removePath?.(normalizedPath, null) || {
			action: "none",
			removedModuleId: null,
			restoreModuleId: null
		};

		// Check if path actually exists before attempting deletion
		const pathExists = this.getValueAtPath(this.slothlet.api, parts) !== undefined;

		if (ownershipResult.action === "none") {
			if (pathExists) {
				await this.deletePath(this.slothlet.api, parts);
				await this.deletePath(this.slothlet.boundApi, parts);
				// Clean up user metadata
				if (this.slothlet.handlers.metadata) {
					this.slothlet.handlers.metadata.removeUserMetadataByApiPath(normalizedPath);
				}
				// Track in operation history for reload replay
				if (recordHistory) {
					this.state.operationHistory.push({
						type: "remove",
						apiPath: normalizedPath
					});
				}
				return true;
			}
			// Path doesn't exist - nothing to remove
			return false;
		}
		if (ownershipResult.action === "delete") {
			await this.deletePath(this.slothlet.api, parts);
			await this.deletePath(this.slothlet.boundApi, parts);
			// Clean up user metadata
			if (this.slothlet.handlers.metadata) {
				this.slothlet.handlers.metadata.removeUserMetadataByApiPath(normalizedPath);
			}
			// Track in operation history for reload replay
			if (recordHistory) {
				this.state.operationHistory.push({
					type: "remove",
					apiPath: normalizedPath
				});
			}
			return true;
		}
		if (ownershipResult.action === "restore") {
			const restoredValue = this.slothlet.handlers.ownership?.getCurrentValue?.(normalizedPath);
			const restoredModuleId = this.slothlet.handlers.ownership?.getCurrentOwner?.(normalizedPath)?.moduleID;
			if (restoredValue !== undefined && restoredModuleId) {
				await this.setValueAtPath(this.slothlet.api, parts, restoredValue, {
					mutateExisting: true,
					allowOverwrite: true,
					collisionMode: "replace", // CRITICAL: Must use replace mode for rollback
					moduleID: restoredModuleId // Pass the restored moduleID for ownership tracking
				});
				await this.setValueAtPath(this.slothlet.boundApi, parts, restoredValue, {
					mutateExisting: true,
					allowOverwrite: true,
					collisionMode: "replace", // CRITICAL: Must use replace mode for rollback
					moduleID: restoredModuleId // Pass the restored moduleID for ownership tracking
				});
				// Track in operation history for reload replay
				if (recordHistory) {
					this.state.operationHistory.push({
						type: "remove",
						apiPath: normalizedPath
					});
				}
				return true;
			}
			await this.restoreApiPath(normalizedPath, ownershipResult.restoreModuleId);
			// Track in operation history for reload replay
			if (recordHistory) {
				this.state.operationHistory.push({
					type: "remove",
					apiPath: normalizedPath
				});
			}
			return true;
		}
		return false;
	}

	/**
	 * Reload API modules using cache system.
	 * @param {object} params - Reload parameters.
	 * @param {?string} params.apiPath - API path to reload.
	 * @param {?string} params.moduleID - ModuleId to reload.
	 * @returns {Promise<void>}
	 * @package
	 *
	 * @description
	 * Reloads modules from disk using cached parameters. For moduleID reload, rebuilds
	 * entire cache and restores all paths. For apiPath reload, rebuilds all contributing
	 * moduleID caches and merges implementations.
	 *
	 * @example
	 * await manager.reloadApiComponent({ moduleID: "plugins_abc123" });
	 * await manager.reloadApiComponent({ apiPath: "plugins" });
	 */
	async reloadApiComponent(params) {
		const { apiPath, moduleID } = params || {};
		if (!this.slothlet || !this.slothlet.isLoaded) {
			throw new this.SlothletError("INVALID_CONFIG_NOT_LOADED", {
				operation: "reloadApi",
				validationError: true
			});
		}

		// ModuleID-based reload: rebuild single cache and restore all paths
		if (moduleID) {
			await this._reloadByModuleID(moduleID);
			return;
		}

		// ApiPath-based reload: rebuild all contributing caches
		if (apiPath) {
			await this._reloadByApiPath(apiPath);
			return;
		}

		throw new this.SlothletError("INVALID_ARGUMENT", {
			argument: "params",
			expected: "{ moduleID } or { apiPath }",
			received: params,
			validationError: true
		});
	}

	/**
	 * Reload by moduleID - rebuild cache and restore all paths
	 * @param {string} moduleID - Module identifier
	 * @param {Object} [options] - Reload options
	 * @param {boolean} [options.forceReplace=true] - Force replace mode on existing wrappers.
	 *   When true, temporarily overrides collision mode to "replace" so the fresh impl
	 *   fully replaces the old one. When false, the wrapper's original collision mode is
	 *   preserved, allowing merge behavior for multi-cache rebuilds.
	 * @returns {Promise<void>}
	 * @private
	 */
	async _reloadByModuleID(moduleID, { forceReplace = true } = {}) {
		const cacheManager = this.slothlet.handlers.apiCacheManager;
		if (!cacheManager) {
			throw new this.SlothletError("CACHE_MANAGER_NOT_AVAILABLE", {
				operation: "reload",
				validationError: true
			});
		}

		// Check if cache exists
		if (!cacheManager.has(moduleID)) {
			throw new this.SlothletError("CACHE_NOT_FOUND", {
				moduleID,
				operation: "reload",
				validationError: true
			});
		}

		// Get existing cache entry for metadata
		const oldEntry = cacheManager.get(moduleID);

		this.slothlet.debug("reload", {
			message: "Reloading module by ID",
			moduleID,
			endpoint: oldEntry.endpoint,
			folderPath: oldEntry.folderPath
		});

		// Rebuild API from disk
		const freshApi = await cacheManager.rebuildCache(moduleID);

		// Update cache with fresh API
		cacheManager.set(moduleID, {
			...oldEntry,
			api: freshApi,
			timestamp: Date.now()
		});

		// DEBUG: Log freshApi keys before restore
		this.slothlet.debug("reload", {
			message: "Fresh API keys before restore",
			moduleID,
			endpoint: oldEntry.endpoint,
			freshApiKeys: Object.keys(freshApi || {})
		});

		// Traverse fresh API and update/create wrappers
		await this._restoreApiTree(freshApi, oldEntry.endpoint, moduleID, oldEntry.collisionMode, forceReplace);

		// DEBUG: Check if freshApi was mutated
		this.slothlet.debug("reload", {
			message: "Fresh API keys after restore",
			moduleID,
			endpoint: oldEntry.endpoint,
			freshApiKeys: Object.keys(freshApi || {})
		});

		this.slothlet.debug("reload", {
			message: "Module reload complete",
			moduleID
		});
	}

	/**
	 * Reload by API path — find affected caches, rebuild them, update impls.
	 *
	 * Accepts "." for base module. For other paths, the resolution order is:
	 * 1. Exact cache endpoint match
	 * 2. Child caches (endpoints under the path)
	 * 3. Ownership history (modules that registered the exact path)
	 * 4. Parent cache (most specific cache whose scope covers the path)
	 *
	 * @param {string} apiPath - API path or "." for base module
	 * @returns {Promise<void>}
	 * @private
	 */
	async _reloadByApiPath(apiPath) {
		this.slothlet.debug("reload", {
			message: "Reloading by API path",
			apiPath
		});

		// Find all caches that need to be rebuilt for this path
		const moduleIDsToReload = this._findAffectedCaches(apiPath);

		if (moduleIDsToReload.length === 0) {
			this.slothlet.debug("reload", {
				message: "No caches found for path, attempting base restore",
				apiPath
			});
			// Fallback: try restoring from existing data for non-base paths
			if (apiPath !== "." && apiPath !== "") {
				await this.restoreApiPath(apiPath, "base");
			}
			return;
		}

		// Sort: base module first, then by add-history order (chronological)
		// This ensures the first contributor lays a clean slate (replace mode)
		// and subsequent contributors merge onto it with their original collision mode.
		const cacheManager = this.slothlet.handlers.apiCacheManager;
		moduleIDsToReload.sort((a, b) => {
			const entryA = cacheManager.get(a);
			const entryB = cacheManager.get(b);

			// Base module (endpoint ".") always first
			if (entryA?.endpoint === "." && entryB?.endpoint !== ".") return -1;
			if (entryB?.endpoint === "." && entryA?.endpoint !== ".") return 1;

			// Then by addHistory order (chronological)
			const indexA = this.state.addHistory.findIndex((h) => h.moduleID === a);
			const indexB = this.state.addHistory.findIndex((h) => h.moduleID === b);
			return indexA - indexB;
		});

		// Group modules by endpoint so each endpoint gets its own clean slate.
		// Within each endpoint group: first module gets forceReplace=true (clean slate),
		// subsequent modules use their original collision mode (e.g., merge) to layer on top.
		// This ensures child caches at different endpoints each start fresh.
		const endpointOrder = new Map();
		for (const moduleID of moduleIDsToReload) {
			const entry = cacheManager.get(moduleID);
			const ep = entry?.endpoint ?? ".";
			if (!endpointOrder.has(ep)) endpointOrder.set(ep, []);
			endpointOrder.get(ep).push(moduleID);
		}

		for (const [, moduleIDs] of endpointOrder) {
			for (let i = 0; i < moduleIDs.length; i++) {
				await this._reloadByModuleID(moduleIDs[i], { forceReplace: i === 0 });
			}
		}

		this.slothlet.debug("reload", {
			message: "API path reload complete",
			apiPath,
			reloadedModules: moduleIDsToReload.length,
			loadOrder: moduleIDsToReload
		});
	}

	/**
	 * Find all cache entries that need to be rebuilt for a given API path.
	 *
	 * Resolution order:
	 * 1. "." or "" or null → base module cache(s) (endpoint ".")
	 * 2. Exact endpoint match → that specific cache
	 * 3. Child caches → caches whose endpoint is under the given path
	 * 4. Ownership history → modules that registered the exact path
	 * 5. Parent cache → most specific cache whose scope covers the path
	 *
	 * @param {string} apiPath - The API path to find caches for
	 * @returns {string[]} Array of moduleIDs to reload
	 * @private
	 */
	_findAffectedCaches(apiPath) {
		const cacheManager = this.slothlet.handlers.apiCacheManager;
		if (!cacheManager) return [];

		const allModuleIDs = cacheManager.getAllModuleIDs();

		// Base module reload: ".", "", or nullish
		if (apiPath === "." || apiPath === "" || apiPath == null) {
			const baseModules = [];
			for (const moduleID of allModuleIDs) {
				const entry = cacheManager.get(moduleID);
				if (entry && entry.endpoint === ".") {
					baseModules.push(moduleID);
				}
			}
			return baseModules;
		}

		// 1. Exact endpoint match
		const exactMatches = [];
		for (const moduleID of allModuleIDs) {
			const entry = cacheManager.get(moduleID);
			if (entry && entry.endpoint === apiPath) {
				exactMatches.push(moduleID);
			}
		}
		if (exactMatches.length > 0) return exactMatches;

		// 2. Child caches (caches mounted under this path)
		const children = [];
		const pathPrefix = apiPath + ".";
		for (const moduleID of allModuleIDs) {
			const entry = cacheManager.get(moduleID);
			if (entry?.endpoint?.startsWith(pathPrefix)) {
				children.push(moduleID);
			}
		}
		if (children.length > 0) return children;

		// 3. Ownership history (modules that registered this exact path)
		const ownership = this.slothlet.handlers.ownership;
		const history = ownership?.getPathHistory?.(apiPath);
		if (history && history.length > 0) {
			const owned = [];
			for (const { moduleID } of history) {
				if (cacheManager.has(moduleID)) {
					owned.push(moduleID);
				}
			}
			if (owned.length > 0) return owned;
		}

		// 4. Parent cache — most specific cache whose scope covers this path
		//    e.g., reload("math") finds the base module because math lives under ".";
		//    reload("custom.math") finds the "custom" cache because custom.math lives under "custom"
		let bestMatch = null;
		let bestLength = -1;
		for (const moduleID of allModuleIDs) {
			const entry = cacheManager.get(moduleID);
			if (!entry?.endpoint) continue;

			const ep = entry.endpoint;
			// Base module (endpoint ".") covers everything
			// Or the path starts with the cache endpoint prefix
			if (ep === "." || apiPath.startsWith(ep + ".")) {
				if (ep.length > bestLength) {
					bestLength = ep.length;
					bestMatch = moduleID;
				}
			}
		}
		if (bestMatch) return [bestMatch];

		return [];
	}

	/**
	 * Collect user-set custom properties from a proxy/wrapper that are NOT in the fresh API.
	 * Custom properties are those set by the user at runtime (e.g., api.custom.testFlag = true)
	 * that should survive a selective reload.
	 * @param {Object} existingProxy - The existing proxy/wrapper to collect from
	 * @param {Object} freshApi - The fresh API from rebuild (keys to exclude)
	 * @returns {Object} Map of custom property names to their values
	 * @private
	 */
	_collectCustomProperties(existingProxy, freshApi) {
		const customProps = {};
		// Accept both object and function wrappers (eager vs lazy mode)
		if (!existingProxy || (typeof existingProxy !== "object" && typeof existingProxy !== "function")) {
			return customProps;
		}

		const wrapper = existingProxy.__wrapper;
		if (!wrapper) {
			return customProps;
		}

		// Get keys from fresh API to know which are "API" keys vs "custom" keys
		const freshKeys = new Set(freshApi ? Object.keys(freshApi) : []);

		// Get all enumerable own properties on the wrapper that are user-accessible
		const ownKeys = Object.keys(wrapper).filter((k) => {
			// Skip internal properties
			if (k.startsWith("_") || k.startsWith("__")) return false;
			// Skip known built-in properties
			if (k === "slothlet" || k === "shutdown" || k === "destroy") return false;
			return true;
		});

		for (const key of ownKeys) {
			try {
				// Read value from wrapper
				const val = wrapper[key];

				// Skip all wrapper-type values (API-built, not user-set custom props)
				// This includes both valid and invalidated wrappers
				if (val && typeof val === "object" && val.__wrapper) {
					continue;
				}
				if (typeof val === "function" && val.__wrapper) {
					continue;
				}

				// At this point, val is NOT a wrapper — it's either a user-set custom property
				// or a user-overridden API key with a plain value
				if (!freshKeys.has(key)) {
					// Key is NOT in fresh API — purely custom property
					customProps[key] = val;
				} else {
					// Key IS in fresh API but value is plain (no __wrapper)
					// User explicitly overwrote it with a plain value — preserve it.
					customProps[key] = val;
				}
			} catch {
				// Skip properties that throw on access
			}
		}

		return customProps;
	}

	/**
	 * Restore previously collected custom properties onto a proxy/wrapper after reload.
	 * @param {Object} proxy - The proxy to restore properties onto
	 * @param {Object} customProps - Map of property names to values from _collectCustomProperties
	 * @private
	 */
	_restoreCustomProperties(proxy, customProps) {
		if (!proxy || !customProps || typeof customProps !== "object") {
			return;
		}

		for (const [key, value] of Object.entries(customProps)) {
			try {
				proxy[key] = value;
			} catch {
				// Skip properties that can't be set
			}
		}
	}

	/**
	 * Restore API from fresh rebuild by updating existing wrapper.
	 * For non-root endpoints, updates the wrapper's implementation without replacing structure.
	 * For root endpoints, merges keys directly as addApiComponent does.
	 * @param {object} freshApi - Fresh API from rebuild
	 * @param {string} endpoint - Original endpoint path
	 * @param {string} moduleID - Module identifier
	 * @param {string} collisionMode - Collision handling mode
	 * @param {boolean} [forceReplace=true] - When true, temporarily overrides wrapper collision
	 *   mode to "replace" so fresh impl fully replaces old. When false, preserves original
	 *   collision mode for proper merge behavior in multi-cache rebuilds.
	 * @returns {Promise<void>}
	 * @private
	 */
	async _restoreApiTree(freshApi, endpoint, moduleID, collisionMode, forceReplace = true) {
		if (!freshApi || (typeof freshApi !== "object" && typeof freshApi !== "function")) {
			return;
		}

		// Parse endpoint into parts array
		const parts = endpoint === "." ? [] : endpoint.split(".");

		if (parts.length === 0) {
			// Root level - update each existing wrapper's implementation directly
			// Using ___setImpl preserves the wrapper proxy reference and custom properties
			// (setValueAtPath/syncWrapper can replace the proxy reference, losing custom props)
			for (const key of Object.keys(freshApi)) {
				// Skip internal keys from the fresh API proxy's ownKeys trap
				if (typeof key === "string" && (key.startsWith("_") || key.startsWith("__"))) continue;
				// Skip built-in slothlet namespace
				if (key === "slothlet" || key === "shutdown" || key === "destroy") continue;

				const existingAtKey = this.slothlet.api[key];
				const freshValue = freshApi[key];

				if (existingAtKey && typeof existingAtKey.___setImpl === "function") {
					// Existing wrapper found — collect custom props before any modification
					const customProps = this._collectCustomProperties(existingAtKey, freshValue);

					// Check if the fresh value is an un-materialized lazy wrapper
					// (subdirectory from buildLazyAPI that hasn't been accessed yet)
					const freshWrapper = freshValue?.__wrapper;
					const isLazyFresh =
						freshWrapper &&
						freshWrapper.____slothletInternal.mode === "lazy" &&
						!freshWrapper.____slothletInternal.state.materialized &&
						typeof freshWrapper.____slothletInternal.materializeFunc === "function";

					// DEBUG: Trace lazy detection for every root key
					this.slothlet.debug("reload", {
						message: "RESTORE-ROOT-KEY-INSPECT",
						key,
						hasFreshWrapper: !!freshWrapper,
						freshMode: freshWrapper?.____slothletInternal.mode,
						freshMaterialized: freshWrapper?.____slothletInternal.state?.materialized,
						hasMaterializeFunc: typeof freshWrapper?.____slothletInternal.materializeFunc === "function",
						isLazyFresh,
						existingMaterialized: existingAtKey?.___getState?.()?.materialized
					});

					if (isLazyFresh) {
						// LAZY RESET PATH: Fresh value is a lazy shell — reset existing wrapper
						// to un-materialized state with the fresh materializeFunc.
						// This frees memory from any previously-materialized children and
						// ensures the next access triggers materialization from updated source.
						existingAtKey.___resetLazy(freshWrapper.____slothletInternal.materializeFunc);

						// Restore custom properties after lazy reset
						this._restoreCustomProperties(existingAtKey, customProps);

						this.slothlet.debug("reload", {
							message: "Root key reset to lazy via ___resetLazy",
							key,
							restoredCustomProps: Object.keys(customProps)
						});
					} else {
						// EAGER PATH: Fresh value is concrete (eager mode, or root-level file
						// which is always eager even in lazy mode) — extract impl and update.

						// Extract full impl from fresh value (which is a wrapper proxy from buildAPI).
						// CRITICAL: freshWrapper.____slothletInternal.impl may be depleted — the constructor's
						// ___adoptImplChildren() moved children (like host, port for config) out of
						// _impl and onto the wrapper as own properties, deleting them from _impl.
						// Use _extractFullImpl to reconstruct the complete impl from wrapper tree.
						let implForReload;
						if (freshValue && typeof freshValue.___getState === "function") {
							implForReload = freshWrapper ? UnifiedWrapper._extractFullImpl(freshWrapper) : freshValue;
						} else {
							implForReload = freshValue;
						}

						// Extract properties from function to avoid making container callable
						if (typeof implForReload === "function") {
							const extracted = {};
							for (const k of Object.keys(implForReload)) {
								extracted[k] = implForReload[k];
							}
							implForReload = extracted;
						}

						// Conditionally force replace mode for reload
						// When forceReplace=true (single-module or first in multi-cache), override to "replace"
						// When forceReplace=false (subsequent modules in multi-cache), keep original collision mode
						const wrapper = existingAtKey.__wrapper;
						const originalCollisionMode = wrapper ? wrapper.____slothletInternal.state.collisionMode : null;
						if (forceReplace && wrapper) {
							wrapper.____slothletInternal.state.collisionMode = "replace";
						}

						existingAtKey.___setImpl(implForReload, moduleID);

						// Restore collision mode
						if (wrapper && originalCollisionMode !== null) {
							wrapper.____slothletInternal.state.collisionMode = originalCollisionMode;
						}

						// Restore custom properties
						this._restoreCustomProperties(existingAtKey, customProps);

						this.slothlet.debug("reload", {
							message: "Root key updated via ___setImpl",
							key,
							restoredCustomProps: Object.keys(customProps)
						});
					}
				} else if (existingAtKey === undefined) {
					// New key from reload — use setValueAtPath to create it
					const cacheManager = this.slothlet.handlers.apiCacheManager;
					const cacheEntry = cacheManager.get(moduleID);
					const resolvedFolderPath = cacheEntry?.folderPath || "";

					await this.setValueAtPath(this.slothlet.api, [key], freshValue, {
						mutateExisting: true,
						collisionMode,
						moduleID,
						sourceFolder: resolvedFolderPath
					});

					if (this.slothlet.boundApi) {
						await this.setValueAtPath(this.slothlet.boundApi, [key], freshValue, {
							mutateExisting: true,
							collisionMode,
							moduleID,
							sourceFolder: resolvedFolderPath
						});
					}
				}
				// else: existing non-wrapper value — skip (shouldn't happen in normal flow)
			}
		} else {
			// Nested path - get existing wrapper and update its implementation
			// This preserves the wrapper structure while updating the contained API
			const existing = this.getValueAtPath(this.slothlet.api, parts);

			this.slothlet.debug("reload", {
				message: "RESTORE: nested path",
				endpoint,
				moduleID,
				partsPath: parts.join("."),
				existingFound: !!existing,
				hasSetImpl: existing ? typeof existing.___setImpl === "function" : false,
				freshApiKeys: Object.keys(freshApi || {})
			});

			if (existing && typeof existing.___setImpl === "function") {
				// Collect custom properties from existing wrapper before reload
				const customProps = this._collectCustomProperties(existing, freshApi);

				// Conditionally force "replace" mode for reload
				// forceReplace=true (single-module or first in multi-cache): clear old keys
				// forceReplace=false (subsequent in multi-cache): preserve collision mode for merge
				const wrapper = existing.__wrapper;
				const originalCollisionMode = wrapper ? wrapper.____slothletInternal.state.collisionMode : null;

				if (forceReplace && wrapper) {
					wrapper.____slothletInternal.state.collisionMode = "replace";
					this.slothlet.debug("reload", {
						message: "RESTORE: forcing replace mode",
						endpoint,
						originalCollisionMode,
						wrapperApiPath: wrapper.____slothletInternal.apiPath
					});
				}

				// Existing wrapper found - update implementation directly
				// This is the key: we update the WRAPPER's implementation, not replace the path
				// CRITICAL: After eager rebuild, wrapper proxies have depleted _impl (children
				// adopted to own properties). Reconstruct the complete impl from the wrapper tree
				// so ___setImpl → ___adoptImplChildren receives the full key set.
				let implForReload;
				if (freshApi && typeof freshApi.___getState === "function") {
					const freshWrapper = freshApi.__wrapper;
					implForReload = freshWrapper ? UnifiedWrapper._extractFullImpl(freshWrapper) : freshApi;
				} else if (typeof freshApi === "function") {
					implForReload = {};
					for (const key of Object.keys(freshApi)) {
						implForReload[key] = freshApi[key];
					}
				} else {
					implForReload = freshApi;
				}

				// Recursively extract full impls from any child wrapper proxies with depleted _impl.
				// This handles the common case where freshApi is a function (no ___getState) but
				// its enumerable properties are wrapper proxies from eager rebuild.
				// IMPORTANT: Only extract from MATERIALIZED wrappers (eager mode). Unmaterialized
				// lazy wrappers should be preserved as-is so ___adoptImplChildren can call
				// ___resetLazy with the fresh materializeFunc.
				if (implForReload && typeof implForReload === "object") {
					for (const key of Object.keys(implForReload)) {
						const val = implForReload[key];
						if (val && typeof val.___getState === "function" && val.__wrapper) {
							const childWrapper = val.__wrapper;
							if (childWrapper.____slothletInternal.state.materialized) {
								implForReload[key] = UnifiedWrapper._extractFullImpl(childWrapper);
							}
						}
					}
				}

				existing.___setImpl(implForReload, moduleID);

				// Restore original collision mode
				if (wrapper && originalCollisionMode !== null) {
					wrapper.____slothletInternal.state.collisionMode = originalCollisionMode;
				}

				// Restore custom properties after reload
				this._restoreCustomProperties(existing, customProps);

				this.slothlet.debug("reload", {
					message: "Updated existing wrapper implementation",
					endpoint,
					moduleID,
					forcedReplaceMode: true,
					restoredCustomProps: Object.keys(customProps)
				});
			} else {
				// No wrapper exists - should not happen in reload, but handle gracefully
				// This fallback recreates the path as addApiComponent would
				const cacheManager = this.slothlet.handlers.apiCacheManager;
				const cacheEntry = cacheManager.get(moduleID);
				const resolvedFolderPath = cacheEntry?.folderPath || "";

				// Wrap fresh API — extract properties if buildAPI returned a function
				let implForContainer = freshApi;
				if (typeof freshApi === "function") {
					implForContainer = {};
					for (const key of Object.keys(freshApi)) {
						implForContainer[key] = freshApi[key];
					}
				}
				const containerWrapper = new UnifiedWrapper(this.slothlet, {
					apiPath: endpoint,
					mode: this.config.mode,
					moduleID: moduleID,
					filePath: resolvedFolderPath,
					sourceFolder: resolvedFolderPath
				});
				containerWrapper.___setImpl(implForContainer, moduleID);
				const apiToSet = containerWrapper.createProxy();

				// Set at endpoint path
				await this.setValueAtPath(this.slothlet.api, parts, apiToSet, {
					mutateExisting: true,
					collisionMode,
					moduleID,
					sourceFolder: resolvedFolderPath
				});

				if (this.slothlet.boundApi) {
					await this.setValueAtPath(this.slothlet.boundApi, parts, apiToSet, {
						mutateExisting: true,
						collisionMode,
						moduleID,
						sourceFolder: resolvedFolderPath
					});
				}

				this.slothlet.debug("reload", {
					message: "Created new wrapper (unexpected in reload)",
					endpoint,
					moduleID
				});
			}
		}
	}
}
