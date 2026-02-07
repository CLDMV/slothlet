/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /src/lib/handlers/api-manager.mjs
 *	@Date: 2026-01-24 07:14:02 -08:00 (1737726842)
 *	@Author: Nate Hyson <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Hyson <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-02-06 07:00:28 -08:00 (1770390028)
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
			removedModuleIds: new Set(),
			initialConfig: slothlet?.config || null,
			operationHistory: [] // Chronological log of all add/remove operations
		};
		/**
		 * API caches - Complete buildAPI results per moduleID
		 * @type {Map<string, CacheEntry>}
		 * @private
		 *
		 * @description
		 * Stores complete API trees for each moduleID to enable hot reload without
		 * rebuilding the entire instance. Each cache entry contains the full buildAPI
		 * result and all parameters needed for rebuild.
		 *
		 * Structure: moduleID → {
		 *   endpoint: string,         // API path endpoint (e.g., ".", "plugins")
		 *   moduleID: string,          // Module identifier
		 *   api: Object,               // Complete buildAPI result tree
		 *   folderPath: string,        // Source folder path
		 *   mode: string,              // lazy/eager
		 *   sanitizeOptions: Object,   // Sanitization config
		 *   collisionMode: string,     // Collision handling mode
		 *   config: Object,            // Config snapshot at add time
		 *   timestamp: number          // Cache creation time
		 * }
		 */
		this.apiCaches = new Map();
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
				containerWrapper.__setImpl({}, moduleID);
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
		if (nextWrapper._materializeFunc) {
			existingWrapper._materializeFunc = nextWrapper._materializeFunc;
		}

		// THE ACTUAL FIX: Transfer _childCache entries directly
		// nextProxy.__impl is empty because buildAPI already moved everything to _childCache
		// We need to transfer the child wrappers from nextWrapper to existingWrapper
		// Transfer children from _proxyTarget properties
		const existingChildKeys = Object.keys(existingWrapper._proxyTarget).filter((k) => k !== "__wrapper");
		const nextChildKeys = Object.keys(nextWrapper._proxyTarget).filter((k) => k !== "__wrapper");

		if (config?.debug?.api) {
			this.slothlet.debug("api", {
				message: "syncWrapper before merge",
				existingCacheSize: existingChildKeys.length,
				nextCacheSize: nextChildKeys.length
			});
			this.slothlet.debug("api", {
				message: "syncWrapper next wrapper impl keys",
				implKeys: Object.keys(nextWrapper._impl || {})
			});
			this.slothlet.debug("api", {
				message: "syncWrapper next wrapper childCache keys",
				childCacheKeys: nextChildKeys
			});
		}

		// Merge child wrappers from next to existing based on collision mode
		// IMPORTANT: _childCache should contain PROXIES (from createProxy()), not raw wrappers
		if (collisionMode === "replace") {
			// CRITICAL: Use __setImpl to trigger lifecycle events for ownership tracking
			// This ensures impl:changed fires with the correct moduleID
			if (existingWrapper.__setImpl && nextWrapper._impl !== undefined) {
				// Pass moduleID for correct ownership tracking in lifecycle events
				existingWrapper.__setImpl(nextWrapper._impl, moduleID);
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

			// Clear existing children by deleting properties
			for (const key of existingChildKeys) {
				delete existingWrapper._proxyTarget[key];
			}
			existingWrapper._adoptImplChildren();

			// Also copy any child wrappers that nextWrapper already has
			// (this handles cases where nextWrapper was built with pre-existing children)
			for (const key of nextChildKeys) {
				const childValue = nextWrapper._proxyTarget[key];
				Object.defineProperty(existingWrapper._proxyTarget, key, {
					value: childValue,
					writable: false,
					enumerable: true,
					configurable: true
				});
			}
		} else if (collisionMode === "merge") {
			// Keep existing, only add new keys
			for (const key of nextChildKeys) {
				if (!(key in existingWrapper._proxyTarget)) {
					const childValue = nextWrapper._proxyTarget[key];
					Object.defineProperty(existingWrapper._proxyTarget, key, {
						value: childValue,
						writable: false,
						enumerable: true,
						configurable: true
					});
				}
			}
		} else if (collisionMode === "merge-replace") {
			// Add new keys and replace existing
			for (const key of nextChildKeys) {
				const childValue = nextWrapper._proxyTarget[key];
				// Delete existing first if present
				if (key in existingWrapper._proxyTarget) {
					delete existingWrapper._proxyTarget[key];
				}
				Object.defineProperty(existingWrapper._proxyTarget, key, {
					value: childValue,
					writable: false,
					enumerable: true,
					configurable: true
				});
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

		// Emit lifecycle event for removal BEFORE deletion
		if (removedImpl && this.slothlet.handlers?.lifecycle) {
			const metadata = this.slothlet.handlers.metadata?.getMetadata?.(removedImpl);
			this.slothlet.handlers.lifecycle.emit("impl:removed", {
				apiPath,
				impl: removedImpl,
				source: "removal",
				moduleID: metadata?.moduleID,
				filePath: metadata?.filePath,
				sourceFolder: metadata?.sourceFolder
			});
		}

		// CRITICAL: Delete from wrapper's childCache AND _impl if current is a proxy
		// Properties are stored in childCache and _impl, not on the proxy itself
		if (current.__wrapper) {
			const wrapper = current.__wrapper;
			// Delete from _proxyTarget (cached proxy instances)
			if (finalKey in wrapper._proxyTarget) {
				delete wrapper._proxyTarget[finalKey];
			}
			// Delete from _impl (the actual implementation object)
			if (wrapper._impl && typeof wrapper._impl === "object") {
				delete wrapper._impl[finalKey];
			}
		}

		// Also delete the property from the object/proxy itself
		delete current[finalKey];

		// AFTER deletion, clean up wrapper state for removed proxy
		if (removedImpl && typeof removedImpl === "object") {
			// If this is a proxy with a wrapper, clean it up
			if (removedImpl.__wrapper) {
				const wrapper = removedImpl.__wrapper;
				// Set impl to null to prevent stale access
				if (wrapper._impl !== undefined) {
					wrapper._impl = null;
				}
				// Clear children from _proxyTarget to release references
				const childKeys = Object.keys(wrapper._proxyTarget).filter((k) => k !== "__wrapper");
				for (const key of childKeys) {
					delete wrapper._proxyTarget[key];
				}
				// Mark as un-materialized so it won't try to access null impl
				if (wrapper._state) {
					wrapper._state.materialized = false;
					wrapper._state.inFlight = false;
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
			if (value && typeof value === "object" && Object.keys(value).length === 0) {
				delete parent[key];
			}
		}

		return true;
	}

	/**
	 * Register ownership for a subtree using a single moduleID.
	 * @param {object} ownership - Ownership manager.
	 * @param {string} moduleID - Module identifier.
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
	registerOwnership(ownership, moduleID, apiPath, value) {
		if (!ownership || !moduleID) {
			return;
		}

		const visited = new WeakSet();
		const maxDepth = 10; // Prevent excessive recursion

		// Get collision mode from config (defaults to "merge")
		const collisionMode = this.config.collision?.api || "merge";

		const registerRecursive = (currentValue, pathParts, depth = 0) => {
			// Depth limit check
			if (depth > maxDepth) {
				return;
			}

			const pathKey = pathParts.join(".");
			ownership.register({
				moduleID,
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
				const skipProps = new Set(["__wrapper", "__metadata", "__materialize", "__type", "_impl"]);

				for (const [key, child] of Object.entries(currentValue)) {
					if (!skipProps.has(key)) {
						registerRecursive(child, [...pathParts, key], depth + 1);
					}
				}
			}
		};

		// Handle empty string properly - split would give [""], we want []
		const initialParts = apiPath === "" ? [] : apiPath.split(".");
		registerRecursive(value, initialParts);
	}

	/**
	 * Remove a module ownership entry for a path.
	 * @param {object} ownership - Ownership manager.
	 * @param {string} apiPath - API path to modify.
	 * @param {?string} moduleID - Specific moduleID to remove (or current owner if null).
	 * @returns {{ action: "delete"|"none"|"restore", removedModuleId: string|null, restoreModuleId: string|null }}
	 * @private
	 *
	 * @description
	 * Updates ownership maps for a single path without removing other paths owned by the module.
	 *
	 * @example
	 * const result = this.removeOwnershipEntry(ownership, "plugins.tools", null);
	 */
	removeOwnershipEntry(ownership, apiPath, moduleID) {
		if (!ownership || typeof ownership.removePath !== "function") {
			return { action: "none", removedModuleId: null, restoreModuleId: null };
		}

		return ownership.removePath(apiPath, moduleID ?? null);
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
				this.deletePath(this.slothlet.api, parts);
				this.deletePath(this.slothlet.boundApi, parts);
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
			userMetadata: metadata,
			// CRITICAL: Pass collision mode so lifecycle handlers can register ownership correctly
			collisionMode: collisionMode
		});

		// Store API cache for hot reload
		this.apiCaches.set(moduleID, {
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
					childCacheSize: Object.keys(newApi[k].__wrapper._proxyTarget).filter((k) => k !== "__wrapper").length,
					childCacheKeys: Object.keys(newApi[k].__wrapper._proxyTarget).filter((k) => k !== "__wrapper")
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
				const containerWrapper = new UnifiedWrapper(this.slothlet, {
					apiPath: normalizedPath,
					mode: this.config.mode,
					moduleID: moduleID,
					filePath: resolvedFolderPath,
					sourceFolder: resolvedFolderPath
				});
				// Set the apiToMerge object as the impl
				containerWrapper.__setImpl(apiToMerge, moduleID);
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
					if (wrapper._materializationPromise) {
						pendingMaterializations.push(wrapper._materializationPromise);
					}

					// Check child cache (_proxyTarget) for nested wrappers that might be materializing
					if (wrapper._proxyTarget && typeof wrapper._proxyTarget === "object") {
						for (const key of Object.keys(wrapper._proxyTarget)) {
							if (key !== "__wrapper") {
								collectPendingMaterializations(wrapper._proxyTarget[key], depth + 1);
							}
						}
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

		if (this.slothlet.handlers.ownership && moduleID) {
			this.registerOwnership(this.slothlet.handlers.ownership, moduleID, normalizedPath, apiToMerge);
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

			if (moduleID) {
				this.state.removedModuleIds.delete(moduleID);
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
		if (moduleID && this.slothlet.handlers.ownership) {
			const registeredModules = Array.from(this.slothlet.handlers.ownership.moduleToPath.keys());
			const matchingModule = registeredModules.find((m) => m === moduleID || m.startsWith(`${moduleID}_`));
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
			const ownershipResult = this.removeOwnershipEntry(this.slothlet.handlers.ownership, normalizedPath, moduleIDKey);
			const pathParts = this.normalizeApiPath(apiPath).parts;
			if (ownershipResult.action === "delete") {
				this.deletePath(this.slothlet.api, pathParts);
				this.deletePath(this.slothlet.boundApi, pathParts);
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
				this.deletePath(this.slothlet.api, pathParts);
				this.deletePath(this.slothlet.boundApi, pathParts);
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
				this.deletePath(this.slothlet.api, parts);
				this.deletePath(this.slothlet.boundApi, parts);
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
					if (existingWrapper?.__setImpl) {
						// Pass the restored moduleID for correct ownership tracking
						existingWrapper.__setImpl(previousImpl, rollback.restoredTo);
					}
					// Also update boundApi
					const existingBoundWrapper = this.getValueAtPath(this.slothlet.boundApi, parts);
					if (existingBoundWrapper?.__setImpl) {
						existingBoundWrapper.__setImpl(previousImpl, rollback.restoredTo);
					}
				}
			}

			this.state.removedModuleIds.add(moduleIDKey);
			this.state.addHistory = this.state.addHistory.filter((entry) => String(entry.moduleID) !== moduleIDKey);

			// Track in operation history for reload replay - record each removed apiPath
			if (recordHistory) {
				for (const removedPath of pathsToDelete) {
					this.state.operationHistory.push({
						type: "remove",
						apiPath: removedPath
					});
				}
				for (const rollback of pathsToRollback) {
					this.state.operationHistory.push({
						type: "remove",
						apiPath: rollback.apiPath
					});
				}
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
		const ownershipResult = this.removeOwnershipEntry(this.slothlet.handlers.ownership, normalizedPath, null);

		// Check if path actually exists before attempting deletion
		const pathExists = this.getValueAtPath(this.slothlet.api, parts) !== undefined;

		if (ownershipResult.action === "none") {
			if (pathExists) {
				this.deletePath(this.slothlet.api, parts);
				this.deletePath(this.slothlet.boundApi, parts);
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
			this.deletePath(this.slothlet.api, parts);
			this.deletePath(this.slothlet.boundApi, parts);
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
	 * Reload API modules from api.slothlet.api.add history.
	 * @param {object} params - Reload parameters.
	 * @param {?string} params.apiPath - API path to reload.
	 * @param {?string} params.moduleID - ModuleId to reload.
	 * @returns {Promise<void>}
	 * @package
	 *
	 * @description
	 * Replays recorded api.slothlet.api.add calls using mutateExisting to preserve references.
	 *
	 * @example
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

		let entries = this.state.addHistory;
		if (apiPath) {
			const normalizedPath = this.normalizeApiPath(apiPath).apiPath;
			entries = entries.filter((entry) => entry.apiPath === normalizedPath);
		} else if (moduleID) {
			entries = entries.filter((entry) => entry.moduleID === moduleID);
		}

		if (entries.length === 0 && apiPath) {
			await this.restoreApiPath(this.normalizeApiPath(apiPath).apiPath, "base");
			return;
		}

		for (const entry of entries) {
			if (entry.moduleID && this.state.removedModuleIds.has(entry.moduleID)) {
				continue;
			}
			await this.addApiComponent({
				apiPath: entry.apiPath,
				folderPath: entry.folderPath,
				options: {
					...entry.options,
					moduleID: entry.moduleID, // Ensure moduleID is passed
					mutateExisting: true,
					forceOverwrite: true,
					recordHistory: false
				}
			});
		}
	}
}
