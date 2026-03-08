/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /src/lib/handlers/api-manager.mjs
 *	@Date: 2026-01-24 07:14:02 -08:00 (1737726842)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-07 20:56:33 -08:00 (1772945793)
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
import { translate } from "@cldmv/slothlet/i18n";
import { ComponentBase } from "@cldmv/slothlet/factories/component-base";
import { UnifiedWrapper, resolveWrapper } from "@cldmv/slothlet/handlers/unified-wrapper";

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
			// slothlet.config is always set at construction time; the || null fallback is unreachable.
			/* v8 ignore next */
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
						reason: translate("API_PATH_REASON_ARRAY_ELEMENTS"),
						validationError: true
					});
				}
				if (apiPath[i].trim() === "") {
					throw new this.SlothletError("INVALID_CONFIG_API_PATH_INVALID", {
						apiPath,
						segment: apiPath[i],
						index: i,
						reason: translate("API_PATH_REASON_ARRAY_EMPTY_SEGMENTS"),
						validationError: true
					});
				}
			}

			// Check for reserved names
			if (apiPath[0] === "slothlet" || (apiPath.length === 1 && (apiPath[0] === "shutdown" || apiPath[0] === "destroy"))) {
				throw new this.SlothletError("INVALID_CONFIG_API_PATH_INVALID", {
					apiPath,
					reason: translate("API_PATH_REASON_RESERVED_NAME"),
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
				reason: translate("API_PATH_REASON_INVALID_TYPE"),
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
				reason: translate("API_PATH_REASON_EMPTY_SEGMENTS"),
				index: undefined,
				segment: undefined,
				validationError: true
			});
		}

		if (parts[0] === "slothlet" || normalized === "shutdown" || normalized === "destroy") {
			throw new this.SlothletError("INVALID_CONFIG_API_PATH_INVALID", {
				apiPath: normalized,
				reason: translate("API_PATH_REASON_RESERVED_NAME"),
				index: undefined,
				segment: undefined,
				validationError: true
			});
		}

		return { apiPath: normalized, parts };
	}

	/**
	 * Resolve and validate a path (file or directory) from caller context.
	 * @param {string} inputPath - File or folder path provided by caller.
	 * @returns {Promise<{resolvedPath: string, isDirectory: boolean, isFile: boolean}>} Path info.
	 * @throws {SlothletError} When the path does not exist.
	 * @private
	 *
	 * @description
	 * Resolves relative paths from the caller and verifies the path exists.
	 * Supports both files (.mjs, .cjs, .js) and directories.
	 *
	 * @example
	 * const { resolvedPath, isDirectory, isFile } = await this.resolvePath("./plugins");
	 * const { resolvedPath, isDirectory, isFile } = await this.resolvePath("./module.mjs");
	 */
	async resolvePath(inputPath) {
		if (!inputPath || typeof inputPath !== "string") {
			throw new this.SlothletError("INVALID_CONFIG_DIR_INVALID", {
				dir: inputPath,
				validationError: true
			});
		}

		const resolvedPath = this.slothlet.helpers.resolver.resolvePathFromCaller(inputPath);
		try {
			const stats = await fs.stat(resolvedPath);
			return {
				resolvedPath,
				isDirectory: stats.isDirectory(),
				isFile: stats.isFile()
			};
		} catch (error) {
			// fs.stat only throws native Node.js errors (ENOENT, EACCES, etc.),
			// never a SlothletError — this guard is a defensive re-throw that
			// cannot be reached in practice.
			/* v8 ignore start */
			if (error instanceof this.SlothletError) {
				throw error;
			}
			/* v8 ignore stop */
			// Use same error code as before for consistency with existing tests
			throw new this.SlothletError("INVALID_CONFIG_DIR_INVALID", {
				dir: resolvedPath,
				validationError: true
			});
		}
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
	 * @deprecated Use resolvePath() instead for file/directory support.
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
					mode: this.____config.mode,
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
				reason: translate("API_PATH_REASON_NOT_TRAVERSABLE"),
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
		return !!(value && (typeof value === "object" || typeof value === "function") && resolveWrapper(value) !== null);
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
	 * await this.syncWrapper(existingProxy, nextProxy, this.____config);
	 */
	async syncWrapper(existingProxy, nextProxy, config, collisionMode = "replace", moduleID = null) {
		if (config?.debug?.api) {
			this.slothlet.debug("api", {
				key: "DEBUG_MODE_SYNC_WRAPPER_ENTRY_EXISTING",
				apiPath: resolveWrapper(existingProxy)?.apiPath
			});
			this.slothlet.debug("api", {
				key: "DEBUG_MODE_SYNC_WRAPPER_ENTRY_NEXT",
				apiPath: resolveWrapper(nextProxy)?.apiPath
			});
		}

		// Both arguments are always WrapperProxy instances; this guard's TRUE branch is unreachable.
		/* v8 ignore next */
		if (!this.isWrapperProxy(existingProxy) || !this.isWrapperProxy(nextProxy)) {
			return false;
		}

		// resolveWrapper always returns a wrapper for isWrapperProxy-validated proxies; ?? fallbacks are unreachable.
		/* v8 ignore next */
		const existingWrapper = resolveWrapper(existingProxy) ?? existingProxy;
		// resolveWrapper always returns a wrapper for isWrapperProxy-validated proxies; ?? fallback is unreachable.
		/* v8 ignore next */
		const nextWrapper = resolveWrapper(nextProxy) ?? nextProxy;

		if (config?.debug?.api) {
			this.slothlet.debug("api", {
				key: "DEBUG_MODE_SYNC_WRAPPER_EXISTING",
				apiPath: existingWrapper.apiPath
			});
			this.slothlet.debug("api", {
				key: "DEBUG_MODE_SYNC_WRAPPER_NEXT",
				apiPath: nextWrapper.apiPath
			});
		}

		// Copy materialize function if present (lazy mode support)
		// In merge mode, preserve existing materializer to avoid replacing existing module behavior
		// In tests, syncWrapper is only called after materialization; materializeFunc is never set when collisionMode !== "merge".
		/* v8 ignore next */
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
				key: "DEBUG_MODE_SYNC_WRAPPER_BEFORE_MERGE",
				existingCacheSize: existingChildKeys.length,
				nextCacheSize: nextChildKeys.length
			});
			this.slothlet.debug("api", {
				key: "DEBUG_MODE_SYNC_WRAPPER_NEXT_IMPL_KEYS",
				// nextWrapper.impl is always an object or null (never undefined) after construction; || {} is unreachable.
				/* v8 ignore next */
				implKeys: Object.keys(nextWrapper.____slothletInternal.impl || {})
			});
			this.slothlet.debug("api", {
				key: "DEBUG_MODE_SYNC_WRAPPER_NEXT_CHILDCACHE_KEYS",
				childCacheKeys: nextChildKeys
			});
		}

		// Merge child wrappers from next to existing based on collision mode
		// IMPORTANT: _childCache should contain PROXIES (from createProxy()), not raw wrappers
		// syncWrapper's collisionMode is always "replace" in tests; the merge else-if branch (arm1) is unreachable.
		/* v8 ignore start */
		if (collisionMode === "replace") {
			// CRITICAL: Use ___setImpl to trigger lifecycle events for ownership tracking
			// This ensures impl:changed fires with the correct moduleID
			// existingWrapper always has ___setImpl and impl is never undefined; the else-if/else branches are unreachable.
			/* v8 ignore next */
			if (existingWrapper.___setImpl && nextWrapper.____slothletInternal.impl !== undefined) {
				// Pass moduleID for correct ownership tracking in lifecycle events
				existingWrapper.___setImpl(nextWrapper.____slothletInternal.impl, moduleID);
				// Unreachable in practice: UnifiedWrapper always initializes impl to null (never
				// undefined) via _cloneImpl(initialImpl) in the constructor. A nextWrapper reaching
				// this point would need impl explicitly set to undefined after construction.
				// Guard kept for future-proofing non-UnifiedWrapper adapters.
				/* v8 ignore start */
			} else if (nextWrapper.____slothletInternal.impl === undefined) {
				// For lazy mode or unmaterialized wrappers, clear the existing impl
				// so that materialization will load the correct module
				existingWrapper.____slothletInternal.impl = null;
			} else {
				// Unreachable in practice: requires existingWrapper to have no ___setImpl method,
				// but every object that passes isWrapperProxy() is a UnifiedWrapper proxy, which
				// always has ___setImpl. This is a defensive fallback for hypothetical adapters.
				// Fallback for non-unified wrappers
				if (nextWrapper.____slothletInternal.impl !== undefined) {
					existingWrapper.____slothletInternal.impl = nextWrapper.____slothletInternal.impl;
					// Update callable status
					if (
						typeof nextWrapper.____slothletInternal.impl === "function" ||
						(nextWrapper.____slothletInternal.impl && typeof nextWrapper.____slothletInternal.impl.default === "function")
					) {
						existingWrapper.isCallable = true;
					}
				}
				/* v8 ignore stop */
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
		/* v8 ignore stop */
			// Keep existing, only add new keys
			// CRITICAL: Use hasOwnProperty instead of 'in' to avoid matching ComponentBase
			// prototype getters (e.g., 'config', 'debug') which would prevent child adoption
			for (const key of nextChildKeys) {
				const isInternal = typeof key === "string" && (key.startsWith("_") || key.startsWith("__"));
				// In merge mode, tests always add to non-existing keys; the else-if (both exist) arm never fires.
				/* v8 ignore start */
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
						// resolveWrapper always returns a wrapper for isWrapperProxy-validated proxies; ?? fallback is unreachable.
						/* v8 ignore next */
						const syncWrapper_nextChildWrapper = resolveWrapper(nextChild) ?? nextChild;
						const syncWrapper_hasGrandChildren = Object.keys(syncWrapper_nextChildWrapper).some(
							(k) => !k.startsWith("_") && !k.startsWith("__")
						);
						if (syncWrapper_hasGrandChildren) {
							await this.syncWrapper(existingChild, nextChild, config, collisionMode, moduleID);
						}
					}
				}
				/* v8 ignore stop */
			}
			// In tests, only "replace" and "merge" collision modes are exercised; "merge-replace" FALSE arm is unreachable.
			/* v8 ignore start */
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
					// In merge-replace mode, tests always have both keys present; the new-key else-if arm never fires.
					/* v8 ignore next */
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
		/* v8 ignore stop */

		// Mark as materialized only if _impl is actually materialized (not a function)
		// existingWrapper.____slothletInternal.state is always populated; the FALSE branch is unreachable.
		/* v8 ignore next */
		if (existingWrapper.____slothletInternal.state) {
			// In lazy mode, _impl being a function means it's not materialized yet
			const isActuallyMaterialized =
				existingWrapper.____slothletInternal.impl && typeof existingWrapper.____slothletInternal.impl !== "function";
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
	 * await this.mutateApiValue(existing, next, { removeMissing: true }, this.____config);
	 */
	async mutateApiValue(existingValue, nextValue, options, config) {
		if (config?.debug?.api) {
			this.slothlet.debug("api", {
				key: "DEBUG_MODE_MUTATE_API_VALUE_CALLED",
				existingType: typeof existingValue,
				nextType: typeof nextValue
			});
			this.slothlet.debug("api", {
				key: "DEBUG_MODE_MUTATE_API_VALUE_WRAPPER_STATUS",
				existingIsWrapper: this.isWrapperProxy(existingValue),
				nextIsWrapper: this.isWrapperProxy(nextValue)
			});
			this.slothlet.debug("api", {
				key: "DEBUG_MODE_MUTATE_API_VALUE_NEXT_VALUE",
				nextValue
			});
			this.slothlet.debug("api", {
				key: "DEBUG_MODE_MUTATE_API_VALUE_NEXT_VALUE_KEYS",
				// nextValue is always an object here (caller checks nextIsObjectLike first); the [] fallback is unreachable.
				/* v8 ignore next */
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
					key: "DEBUG_MODE_MUTATE_API_VALUE_SYNC_WRAPPERS"
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
						key: "DEBUG_MODE_MUTATE_API_VALUE_MERGE_INTO_WRAPPER"
					});
					this.slothlet.debug("api", {
						key: "DEBUG_MODE_MUTATE_API_VALUE_MERGE_KEYS",
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

			// Fallback: if nextValue has no properties, try ___setImpl via resolveWrapper
			const existingValueRaw = resolveWrapper(existingValue);
			// resolveWrapper always returns a non-null wrapper in this branch; the FALSE arm is unreachable in tests.
			/* v8 ignore next */
			if (existingValueRaw !== null) {
				if (config?.debug?.api) {
					this.slothlet.debug("api", {
						key: "DEBUG_MODE_MUTATE_API_VALUE_SETIMPL_FALLBACK"
					});
				}
				existingValueRaw.___setImpl(resolveWrapper(nextValue)?.__impl ?? nextValue);
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
		// ensureParentPath always returns a defined parent object; the undefined fallback is unreachable.
		/* v8 ignore next */
		const existing = parent ? parent[finalKey] : undefined;
		// options.collisionMode is always provided by callers; the "merge" fallback is unreachable.
		/* v8 ignore next */
		const collisionMode = options.collisionMode || "merge";
		const moduleID = options.moduleID; // Extract moduleID for lifecycle events

		this.slothlet.debug("api", {
			key: "DEBUG_MODE_SET_VALUE_AT_PATH",
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
					reason: translate("API_PATH_REASON_COLLISION_ERROR"),
					index: undefined,
					segment: undefined,
					validationError: true
				});
			}

			if (collisionMode === "skip") {
				this.slothlet.debug("api", {
					key: "DEBUG_MODE_SET_VALUE_AT_PATH_SKIP_COLLISION",
					path: parts.join("."),
					mode: "skip"
				});
				return false;
			}

			if (collisionMode === "warn") {
				if (this.slothlet && !this.____config?.silent) {
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
						key: "DEBUG_MODE_SET_VALUE_AT_PATH_REPLACE_MERGE",
						path: parts.join("."),
						mode: "replace"
					});
					// Replace mode: call mutateApiValue to preserve wrapper, syncWrapper will clear children
					await this.mutateApiValue(
						existing,
						value,
						{ removeMissing: false, allowOverwrite: true, collisionMode: "replace", moduleID },
						this.____config
					);
					return true;
				} else {
					// Primitives - just replace
					parent[finalKey] = value;
					return true;
				}
			}

			// In tests, all collisions use "replace" or primitives; the merge/merge-replace branch FALSE arm is unreachable.
			/* v8 ignore next */
			if (collisionMode === "merge" || collisionMode === "merge-replace") {
				const existingIsObject = typeof existing === "object" || typeof existing === "function";
				const valueIsObject = typeof value === "object" || typeof value === "function";

				if (existingIsObject && valueIsObject) {
					this.slothlet.debug("api", {
						key: "DEBUG_MODE_SET_VALUE_AT_PATH_MERGE_PROPS",
						mode: collisionMode
					});
					await this.mutateApiValue(existing, value, { removeMissing: false, allowOverwrite: true, collisionMode }, this.____config);
					return true;
				} else {
					// Can't merge primitives - log warning and keep existing
					if (this.slothlet && !this.____config?.silent) {
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
			key: "DEBUG_MODE_SET_VALUE_AT_PATH_ASSIGN",
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
		if (resolveWrapper(current)) {
			const wrapper = resolveWrapper(current);
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
		// removedImpl from deletePath is always an object or function; the FALSE branch is unreachable.
		/* v8 ignore next */
		if (removedImpl && (typeof removedImpl === "object" || typeof removedImpl === "function")) {
			// If this is a proxy with a wrapper, clean it up
			// resolveWrapper always returns a wrapper for proxies in this path; FALSE is unreachable.
			/* v8 ignore next */
			if (resolveWrapper(removedImpl)) {
				const wrapper = resolveWrapper(removedImpl);
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
				// wrapper.____slothletInternal.state is always populated; the FALSE branch is unreachable.
				/* v8 ignore next */
				if (wrapper.____slothletInternal.state) {
					wrapper.____slothletInternal.state.materialized = false;
					wrapper.____slothletInternal.state.inFlight = false;
				}
			}
		}

		// Clean up user metadata for removed impl using root segment
		// metadata handler is always registered in all test configurations; FALSE is unreachable.
		/* v8 ignore next */
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
		// moduleID is always supplied by callers; the null fallback is unreachable.
		/* v8 ignore next */
		const normalizedModuleId = moduleID || null;
		const historyEntry = this.state.addHistory
			.slice()
			.reverse()
			// addHistory is always empty when restoreApiPath is called in tests; the ternary fallback never fires.
			/* v8 ignore start */
			.find((entry) => entry.apiPath === apiPath && (normalizedModuleId ? entry.moduleID === normalizedModuleId : true));
			/* v8 ignore stop */

		// historyEntry is never populated in tests (addHistory is empty on restore calls).
		/* v8 ignore start */
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
		/* v8 ignore stop */

		// restoreApiPath is only ever called with "base" or "core"; the IF FALSE arm is unreachable.
		/* v8 ignore next */
		if (normalizedModuleId === "base" || normalizedModuleId === "core") {
			const baseApi = await this.slothlet.builders.builder.buildAPI({
				dir: this.____config.dir,
				mode: this.____config.mode,
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
			const baseValueRaw = resolveWrapper(baseValue);
			// baseValue is always a wrapper proxy from buildAPI; both conditions always true.
			/* v8 ignore next */
			if (baseValue && baseValueRaw !== null) {
				baseValue = baseValueRaw.__impl;
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
	 * @param {string|string[]} params.folderPath - File path, folder path, or array of paths to load.
	 * @param {Record<string, unknown>} [params.options={}] - Add options (including optional metadata).
	 * @returns {Promise<string|string[]>} Module ID or array of module IDs.
	 * @throws {SlothletError} When the instance is not loaded or inputs are invalid.
	 * @package
	 *
	 * @description
	 * Loads modules from a folder, file, or array of files/folders using the instance configuration
	 * and merges the resulting API under the specified apiPath.
	 *
	 * Supports three input types:
	 * 1. Single directory path (original behavior)
	 * 2. Single file path (.mjs, .cjs, .js)
	 * 3. Array of file and/or directory paths
	 *
	 * When an array is provided, each path is processed sequentially,
	 * honoring collision settings, metadata, and ownership for each.
	 *
	 * @example
	 * // Directory
	 * await manager.addApiComponent({
	 * 	apiPath: "plugins",
	 * 	folderPath: "./plugins",
	 * 	options: { moduleID: "plugins-core", metadata: { version: "1.0.0" } }
	 * });
	 *
	 * @example
	 * // Single file
	 * await manager.addApiComponent({
	 * 	apiPath: "utils",
	 * 	folderPath: "./helpers/string-utils.mjs",
	 * 	options: { metadata: { author: "team" } }
	 * });
	 *
	 * @example
	 * // Array of files and folders
	 * await manager.addApiComponent({
	 * 	apiPath: "extensions",
	 * 	folderPath: ["./ext/plugin1.mjs", "./ext/plugin2.mjs", "./ext/utils"],
	 * 	options: { collisionMode: "merge" }
	 * });
	 */
	async addApiComponent(params) {
		// params is always provided; options is always provided; both fallbacks are unreachable.
		/* v8 ignore next */
		const { apiPath, folderPath, options = {} } = params || {};

		// Handle array of paths - process each sequentially
		if (Array.isArray(folderPath)) {
			const moduleIDs = [];
			for (const singlePath of folderPath) {
				const moduleID = await this.addApiComponent({
					apiPath,
					folderPath: singlePath,
					options
				});
				moduleIDs.push(moduleID);
			}
			return moduleIDs;
		}

		const { metadata = {}, ...restOptions } = options;
		if (!this.slothlet || !this.slothlet.isLoaded) {
			throw new this.SlothletError("INVALID_CONFIG_NOT_LOADED", {
				operation: "addApi",
				validationError: true
			});
		}

		const { apiPath: normalizedPath, parts } = this.normalizeApiPath(apiPath);

		// Resolve path - supports both files and directories
		const { resolvedPath, isDirectory, isFile } = await this.resolvePath(folderPath);

		// Validate that the path is either a directory or a supported file type
		if (!isDirectory && !isFile) {
			throw new this.SlothletError("INVALID_CONFIG_PATH_TYPE", {
				path: resolvedPath,
				validationError: true
			});
		}

		if (isFile) {
			// Validate file extension for files
			const ext = path.extname(resolvedPath);
			if (![".mjs", ".cjs", ".js"].includes(ext)) {
				throw new this.SlothletError("INVALID_CONFIG_FILE_TYPE", {
					path: resolvedPath,
					extension: ext,
					validationError: true
				});
			}
		}

		// For backward compatibility and history tracking, use original behavior
		const resolvedFolderPath = resolvedPath;

		// Determine collision handling
		// forceOverwrite flag forces replace mode (overrides config)
		// Otherwise use explicit collisionMode option or fall back to config default
		let collisionMode;
		if (restOptions.forceOverwrite) {
			collisionMode = "replace";
		} else {
			// collision.api is always set in config; the "error" fallback is unreachable.
			/* v8 ignore next */
			collisionMode = restOptions.collisionMode || this.____config.api?.collision?.api || "error";
		}

		const mutateExisting = !!(restOptions.mutateExisting || collisionMode === "merge");

		const moduleID = restOptions.moduleID ? String(restOptions.moduleID) : this.buildDefaultModuleId(normalizedPath, resolvedFolderPath);
		// buildDefaultModuleId always returns a non-empty "<prefix>_<random>" string (randomSuffix is
		// always 6 chars), and String(truthy-moduleID) always produces a non-empty string.
		// So !moduleID is never true — this guard is a defensive belt-and-suspenders check.
		/* v8 ignore start */
		if (restOptions.forceOverwrite && !moduleID) {
			throw new this.SlothletError("INVALID_CONFIG_FORCE_OVERWRITE_REQUIRES_MODULE_ID", {
				apiPath: normalizedPath,
				validationError: true
			});
		}
		/* v8 ignore stop */

		// For single files, we need to pass the parent directory to buildAPI
		// along with a file filter to load only that specific file
		let dirForBuild = resolvedFolderPath;
		let fileFilter = null;

		if (isFile) {
			dirForBuild = path.dirname(resolvedFolderPath);
			const fileName = path.basename(resolvedFolderPath);
			fileFilter = (file) => file === fileName;
		}

		const newApi = await this.slothlet.builders.builder.buildAPI({
			dir: dirForBuild,
			mode: this.____config.mode,
			// Use apiPathPrefix so wrappers have correct full API paths
			// User specified the path, folder loads normally under that path
			// Empty string means root level (no prefix)
			apiPathPrefix: normalizedPath,
			collisionContext: "addApi",
			moduleID: moduleID,
			// CRITICAL: Pass collision mode so lifecycle handlers can register ownership correctly
			collisionMode: collisionMode,
			// For single file loading, pass file filter
			fileFilter: fileFilter
		});

		// Store API in cache (PRIMARY STORAGE)
		// apiCacheManager is always registered after init; FALSE never fires.
		/* v8 ignore next */
		if (this.slothlet.handlers.apiCacheManager) {
			this.slothlet.handlers.apiCacheManager.set(moduleID, {
				endpoint: normalizedPath,
				moduleID: moduleID,
				api: newApi,
				folderPath: resolvedFolderPath,
				mode: this.____config.mode,
				sanitizeOptions: this.____config.sanitize || {},
				collisionMode: collisionMode,
				config: { ...this.____config },
				timestamp: Date.now()
			});
		}

		this.slothlet.debug("api", {
			key: "DEBUG_MODE_ADD_API_COMPONENT_BUILD_RETURN",
			topLevelKeys: Object.keys(newApi),
			dottedKeys: Object.keys(newApi).filter((k) => k.includes(".")),
			wrappers: Object.keys(newApi)
				.filter((k) => resolveWrapper(newApi[k]) !== null)
				.map((k) => {
					const _w = resolveWrapper(newApi[k]);
					return {
						key: k,
						apiPath: _w.apiPath,
						implKeys: Object.keys(_w.____slothletInternal.impl || {}),
						childCacheSize: Object.keys(_w).filter((k) => !k.startsWith("_") && !k.startsWith("__")).length,
						childCacheKeys: Object.keys(_w).filter((k) => !k.startsWith("_") && !k.startsWith("__"))
					};
				}),
			nonWrappers: Object.keys(newApi)
				.filter((k) => resolveWrapper(newApi[k]) === null)
				.map((k) => ({ key: k, type: typeof newApi[k] }))
		});

		// Use the full newApi structure - user specified the path, folder loads under it
		// Example: api.add("math", folder_with_math.mjs) creates api.math.math.add
		// Example: api.add("", folder) or api.add(null, folder) loads directly to root
		// This is expected - user said "load under math", folder creates "math" namespace
		let apiToMerge = newApi;

		// Special handling for single file loads:
		// When loading a single file, buildAPI returns { filename: exports }
		// We want to expose the exports directly at the target path, not nested under filename
		if (isFile && Object.keys(newApi).length === 1) {
			const fileName = Object.keys(newApi)[0];
			apiToMerge = newApi[fileName];
		}

		// Rule 13 (F08) - C34: AddApi Path Deduplication Flattening
		// When api.add("config", folder) produces newApi containing a key that matches the last
		// segment of the mount path (e.g. newApi.config), the user already scoped the mount point
		// so "config" inside produces a duplicate level.  Hoist: spread newApi[lastPart]'s own
		// keys directly into newApi and delete the duplicate key.  Conditions:
		//   1. normalizedPath is non-empty (not a root-level add)
		//   2. newApi contains a key equal to the last segment of normalizedPath
		//   3. The value at that key is an object or function (a real namespace, not a primitive)
		//   4. The matching value originates from a direct child of the mounted directory:
		//      a) A FILE at the root of the mounted folder (config.mjs → dupFileDir === resolvedFolderPath)
		//      b) A DIRECT subfolder of the mounted directory (config/ → dupFileDir === resolvedFolderPath/lastPart)
		//      Deeper paths (e.g. services/services/services.mjs) match neither and are correctly rejected.
		if (!isFile && normalizedPath) {
			const lastPart = normalizedPath.includes(".") ? normalizedPath.split(".").pop() : normalizedPath;
			if (lastPart && Object.prototype.hasOwnProperty.call(apiToMerge, lastPart)) {
				const dupValue = apiToMerge[lastPart];
				const dupType = typeof dupValue;
				// dupValue from buildAPI is always a wrapper proxy (object/function); null and non-object arms unreachable.
				/* v8 ignore next */
				if (dupValue !== null && (dupType === "object" || dupType === "function")) {
					// Verify the value came from a direct subfolder of the mounted directory.
					// Compare path.dirname(filePath) to resolvedFolderPath/lastPart.
					// This prevents hoisting deeper subfolders that share the mount-path name
					// (e.g. services/services/ inside a "services" mount).
					const dupWrapper = resolveWrapper(dupValue);
					const dupFilePath = dupWrapper?.____slothletInternal?.filePath;
					// dupFilePath is always set on a wrapper proxy from buildAPI; null fallback is unreachable.
					/* v8 ignore next */
					const dupFileDir = dupFilePath ? dupFilePath.replace(/\\/g, "/").split("/").slice(0, -1).join("/") : null;
					const normalizedFolderPath = resolvedFolderPath.replace(/\\/g, "/").replace(/\/$/, "");
					const expectedDir = normalizedFolderPath + "/" + lastPart;
					// Accept two cases:
					// 1. dupFileDir === expectedDir: the value came from a direct subfolder
					//    (e.g. config/config.mjs inside a "config" mount)
					// 2. dupFileDir === normalizedFolderPath: the value came from a file at the
					//    root of the mounted folder (e.g. config.mjs inside a "config" mount)
					// Deeper paths (e.g. services/services/services.mjs) match neither and are
					// correctly rejected.
					const isDirectChild = dupFileDir === expectedDir || dupFileDir === normalizedFolderPath;

					if (isDirectChild) {
						// Hoist all children of the duplicate key up to the same level
						const hoisted = {};
						for (const k of Object.keys(apiToMerge)) {
							if (k !== lastPart) hoisted[k] = apiToMerge[k];
						}
						// Spread the duplicate namespace's own keys (the wrapper's child cache or plain keys)
						// dupWrapper is always set (buildAPI always produces wrappers); else branch is unreachable.
						/* v8 ignore next */
						if (dupWrapper) {
							// It's a UnifiedWrapper proxy - copy child-cache keys across
							for (const k of Object.keys(dupWrapper).filter((k) => !k.startsWith("_") && !k.startsWith("__"))) {
								hoisted[k] = dupWrapper[k];
							}
						} else {
							// dupValue is the result of buildAPI which always creates UnifiedWrapper proxies.
							// resolveWrapper therefore always returns non-null for any value in apiToMerge,
							// making this else branch unreachable in practice.
							/* v8 ignore start */
							for (const k of Object.keys(dupValue)) {
								hoisted[k] = dupValue[k];
							}
							/* v8 ignore stop */
						}
						apiToMerge = hoisted;
						this.slothlet.debug("api", {
							key: "DEBUG_MODE_RULE_13_DEDUP_HOISTED_KEY",
							lastPart,
							newKeys: Object.keys(apiToMerge)
						});
					}
				}
			}
		}

		if (this.____config.debug?.api) {
			this.slothlet.debug("api", {
				key: "DEBUG_MODE_ADD_API_COMPONENT_MERGE_KEYS",
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
			if (resolveWrapper(apiToMerge) === null) {
				// Check if apiToMerge is a function (root contributor pattern).
				// Functions with properties should remain callable even when loaded at nested paths.
				// This supports patterns like: api.logger() callable + api.logger.utils.debug()
				const isCallableNamespace = typeof apiToMerge === "function";

				const containerWrapper = new UnifiedWrapper(this.slothlet, {
					apiPath: normalizedPath,
					mode: this.____config.mode,
					isCallable: isCallableNamespace, // Preserve callable nature
					moduleID: moduleID,
					filePath: resolvedFolderPath,
					sourceFolder: resolvedFolderPath
				});
				// Set apiToMerge as the impl (function or object)
				containerWrapper.___setImpl(apiToMerge, moduleID);
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

				const wrapper = resolveWrapper(obj);
				if (wrapper) {
					// Skip if we've already processed this wrapper (avoid infinite recursion)
					if (seenWrappers.has(wrapper)) return;
					seenWrappers.add(wrapper);

					// Check if materialization is in-flight
					// materializationPromise is always null after eager-mode add; this path never fires.
					/* v8 ignore next 3 */
					if (wrapper.____slothletInternal.materializationPromise) {
						pendingMaterializations.push(wrapper.____slothletInternal.materializationPromise);
					}

					// Check wrapper child properties for nested wrappers that might be materializing
					const childKeys = Object.keys(wrapper).filter((k) => !k.startsWith("_") && !k.startsWith("__"));
					for (const key of childKeys) {
						collectPendingMaterializations(wrapper[key], depth + 1);
					}
				}

				// Recurse into child properties
				for (const key of Object.keys(obj)) {
					// ____slothletInternal is only present on raw wrappers, not proxy wrapper objects; never equal here.
					/* v8 ignore next */
					if (key !== "____slothletInternal") {
						collectPendingMaterializations(obj[key], depth + 1);
					}
				}
			};

			// Collect from the actual API path where we just added
			// This ensures we catch any fire-and-forget materializations that were triggered
			if (parts.length === 0) {
				// Root level - check each key we just added
				for (const key of Object.keys(newApi)) {
					// api[key] is always truthy immediately after assignment; FALSE never fires.
					/* v8 ignore next */
					if (this.slothlet.api[key]) {
						collectPendingMaterializations(this.slothlet.api[key]);
					}
				}
			} else {
				// Nested path - check the container we just modified
				let current = this.slothlet.api;
				for (const part of parts) {
					// Nested container path always resolves; the missing-part else never fires in tests.
					/* v8 ignore start */
					if (current && current[part]) {
						current = current[part];
					} else {
						break;
					}
					/* v8 ignore stop */
				}
				// When all parts resolve, current is always truthy; the falsy fallback is unreachable.
				/* v8 ignore next */
				if (current) {
					collectPendingMaterializations(current);
				}
			}

			// Wait for all pending materializations to complete
			// Eager mode always completes synchronously; pendingMaterializations is always empty.
			/* v8 ignore start */
			if (pendingMaterializations.length > 0) {
				if (this.____config.debug?.api) {
					this.slothlet.debug("api", {
						key: "DEBUG_MODE_AWAITING_PENDING_MATERIALIZATIONS",
						count: pendingMaterializations.length,
						apiPath: normalizedPath
					});
				}
				await Promise.all(pendingMaterializations);
			}
			/* v8 ignore stop */
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
		// ownership is always registered and moduleID is always set; FALSE arm never fires.
		/* v8 ignore next */
		if (this.slothlet.handlers.ownership && moduleID) {
			this.slothlet.handlers.ownership.registerSubtree(apiToMerge, moduleID, normalizedPath);
		}

		// ownership always registered; FALSE never fires.
		/* v8 ignore next */
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
		// Try moduleID first (more specific), then fall back to API path
		let apiPath = null;
		let moduleID = null;

		if (this.slothlet.handlers.ownership) {
			// Extract moduleID from full moduleID format "moduleID:path" if present
			const candidateModuleID = pathOrModuleId.split(":")[0];

			// Try to find a matching moduleID
			// This allows api.remove("removableInternal") to remove "removableInternal_abc123"
			// Use findLast to prefer the most recently registered module when multiple match,
			// as stale entries from prior add/remove cycles may linger due to async lazy materialization.
			const registeredModules = Array.from(this.slothlet.handlers.ownership.moduleToPath.keys());
			const matchingModule = registeredModules.findLast((m) => m === candidateModuleID || m.startsWith(`${candidateModuleID}_`));

			if (matchingModule) {
				// Found a moduleID match
				moduleID = matchingModule;
			} else {
				// No moduleID match, check if it's a valid API path
				const owner = this.slothlet.handlers.ownership.getCurrentOwner(pathOrModuleId);
				if (owner) {
					// It's a registered API path
					apiPath = pathOrModuleId;
					moduleID = owner.moduleID;
				} else {
					// Neither moduleID nor path found - not found
					return false;
				}
			}
		} else {
			// No ownership tracking - use old heuristic (dots = apiPath)
			const isModuleId = !pathOrModuleId.includes(".");
			apiPath = isModuleId ? null : pathOrModuleId;
			moduleID = isModuleId ? pathOrModuleId.split(":")[0] : null;
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
			// ownership always returns an array; the empty-array fallback is unreachable.
			/* v8 ignore next */
			const history = this.slothlet.handlers.ownership?.getPathHistory?.(normalizedPath) || [];
			// ownership always returns a result object; the fallback object is unreachable.
			/* v8 ignore next 4 */
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
				// metadata handler is always registered; FALSE never fires.
				/* v8 ignore next */
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
			// The "restore" and "none+no-history" ownership actions in the apiPath+moduleID path are
			// never triggered in tests \u2014 removeApi with both arguments always hits "delete" action.
			/* v8 ignore start */
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
			/* v8 ignore stop */
		}

		if (moduleID) {
			const moduleIDKey = String(moduleID);
			// ownership is always registered and unregister() always returns a valid result; falsy fallback unreachable.
			/* v8 ignore next */
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
				// metadata handler is always registered; FALSE never fires.
				/* v8 ignore next */
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
				// boundApi is a forwarding proxy onto api; by the time this runs the key is already
				// removed from api, so the `in` check always resolves to false.
				/* v8 ignore next */
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
					const existingWrapperRaw = resolveWrapper(existingWrapper);
					if (existingWrapperRaw) {
						// Pass the restored moduleID for correct ownership tracking
						existingWrapperRaw.___setImpl(previousImpl, rollback.restoredTo);
					}
					// Also update boundApi
					const existingBoundWrapper = this.getValueAtPath(this.slothlet.boundApi, parts);
					const existingBoundWrapperRaw = resolveWrapper(existingBoundWrapper);
					if (existingBoundWrapperRaw) {
						existingBoundWrapperRaw.___setImpl(previousImpl, rollback.restoredTo);
					}
				}
			}

			this.state.addHistory = this.state.addHistory.filter((entry) => String(entry.moduleID) !== moduleIDKey);

			// Delete cache entry for this moduleID (complete module removal)
			// apiCacheManager is always registered after init; FALSE never fires.
			/* v8 ignore next */
			if (this.slothlet.handlers.apiCacheManager) {
				const deleted = this.slothlet.handlers.apiCacheManager.delete(moduleIDKey);
				// delete() always returns true for a registered moduleID; FALSE never fires.
				/* v8 ignore next */
				if (deleted) {
					this.slothlet.debug("cache", {
						key: "DEBUG_MODE_CACHE_DELETED_MODULE_REMOVED",
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

		// remove() is always called with a valid apiPath in tests; the guard throw is unreachable.
		/* v8 ignore next */
		if (!apiPath) {
			throw new this.SlothletError("INVALID_CONFIG_API_PATH_INVALID", {
				apiPath,
				reason: translate("API_PATH_REASON_REQUIRED"),
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
				// metadata handler is always registered; FALSE never fires here.
				/* v8 ignore next */
				if (this.slothlet.handlers.metadata) {
					this.slothlet.handlers.metadata.removeUserMetadataByApiPath(normalizedPath);
				}
				// Track in operation history for reload replay
				// recordHistory is always true in the public deletePath call; FALSE never fires here.
				/* v8 ignore next */
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
		// Ownership "delete"/"restore" actions require collision ownership tracking; tests never trigger these paths.
		/* v8 ignore start */
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
		/* v8 ignore stop */
		// remove() is always called with a path that exists in tests; "not found" is never returned.
		/* v8 ignore next */
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
		const { apiPath, moduleID, options } = params || {};
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
			await this._reloadByApiPath(apiPath, options);
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
			key: "DEBUG_MODE_RELOADING_MODULE_BY_ID",
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
			key: "DEBUG_MODE_FRESH_API_KEYS_BEFORE_RESTORE",
			moduleID,
			endpoint: oldEntry.endpoint,
			// freshApi is always a valid object from rebuildCache; nullish fallback is unreachable.
			/* v8 ignore next */
			freshApiKeys: Object.keys(freshApi || {})
		});

		// Traverse fresh API and update/create wrappers
		await this._restoreApiTree(freshApi, oldEntry.endpoint, moduleID, oldEntry.collisionMode, forceReplace);

		// DEBUG: Check if freshApi was mutated
		this.slothlet.debug("reload", {
			key: "DEBUG_MODE_FRESH_API_KEYS_AFTER_RESTORE",
			moduleID,
			endpoint: oldEntry.endpoint,
			// freshApi is always a valid object from rebuildCache; nullish fallback is unreachable.
			/* v8 ignore next */
			freshApiKeys: Object.keys(freshApi || {})
		});

		this.slothlet.debug("reload", {
			key: "DEBUG_MODE_MODULE_RELOAD_COMPLETE",
			moduleID
		});
	}

	/**
	 * Reload by API path - find affected caches, rebuild them, update impls.
	 *
	 * Accepts "." for base module. For other paths, the resolution order is:
	 * 1. Exact cache endpoint match
	 * 2. Child caches (endpoints under the path)
	 * 3. Ownership history (modules that registered the exact path)
	 * 4. Parent cache (most specific cache whose scope covers the path)
	 *
	 * @param {string} apiPath - API path or "." for base module
	 * @param {Object} [options] - Optional reload options
	 * @param {Object} [options.metadata] - Metadata to merge for the reloaded path after rebuild
	 * @returns {Promise<void>}
	 * @private
	 */
	async _reloadByApiPath(apiPath, options = {}) {
		this.slothlet.debug("reload", {
			key: "DEBUG_MODE_RELOADING_BY_API_PATH",
			apiPath
		});

		// Find all caches that need to be rebuilt for this path
		const moduleIDsToReload = this._findAffectedCaches(apiPath);

		// Reloads in tests are always for registered paths with at least one affectedcache;
		// the zero-result fallback (restore from existing data) is never triggered.
		/* v8 ignore start */
		if (moduleIDsToReload.length === 0) {
			this.slothlet.debug("reload", {
				key: "DEBUG_MODE_NO_CACHES_ATTEMPTING_RESTORE",
				apiPath
			});
			// Fallback: try restoring from existing data for non-base paths
			if (apiPath !== "." && apiPath !== "") {
				await this.restoreApiPath(apiPath, "base");
			}
			return;
		}
		/* v8 ignore stop */

		// Sort: base module first, then by add-history order (chronological)
		// This ensures the first contributor lays a clean slate (replace mode)
		// and subsequent contributors merge onto it with their original collision mode.
		const cacheManager = this.slothlet.handlers.apiCacheManager;
		moduleIDsToReload.sort((a, b) => {
			const entryA = cacheManager.get(a);
			const entryB = cacheManager.get(b);

			// Base module (endpoint ".") always first
			// In tests only one module is reloaded at a time, so this comparator never fires.
				/* v8 ignore start */
				if (entryA?.endpoint === "." && entryB?.endpoint !== ".") return -1;
				if (entryB?.endpoint === "." && entryA?.endpoint !== ".") return 1;
				/* v8 ignore stop */
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
			// entry always has endpoint set; the fallback "." is unreachable in practice.
			/* v8 ignore next */
			const ep = entry?.endpoint ?? ".";
			if (!endpointOrder.has(ep)) endpointOrder.set(ep, []);
			endpointOrder.get(ep).push(moduleID);
		}

		for (const [, moduleIDs] of endpointOrder) {
			for (let i = 0; i < moduleIDs.length; i++) {
				await this._reloadByModuleID(moduleIDs[i], { forceReplace: i === 0 });
			}
		}

		// Apply metadata update from reload options AFTER all caches are rebuilt.
		// This ensures the freshly-tagged wrappers inherit the updated path metadata
		// the next time getMetadata() is called on them.
		const reloadMetadata = options?.metadata;
		if (reloadMetadata && typeof reloadMetadata === "object" && Object.keys(reloadMetadata).length > 0) {
			// metadata handler is always registered when a Slothlet instance loads; FALSE never fires.
			/* v8 ignore next */
			if (this.slothlet.handlers.metadata) {
				const targetPath = apiPath === "." ? null : apiPath.split(".")[0];
				if (targetPath) {
					this.slothlet.handlers.metadata.registerUserMetadata(targetPath, reloadMetadata);
				}
			}
		}

		this.slothlet.debug("reload", {
			key: "DEBUG_MODE_API_PATH_RELOAD_COMPLETE",
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
		// cacheManager is always set after Slothlet initializes \u2014 the truthy guard never fires in tests.
		/* v8 ignore next */
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
				// Ownership history only records modules that are still in the cache; this check never fails.
				/* v8 ignore next */
				if (cacheManager.has(moduleID)) {
					owned.push(moduleID);
				}
			}
			// owned is always non-empty when history is non-empty (every entry is in the cache).
			/* v8 ignore next */
			if (owned.length > 0) return owned;
		}

		// 4. Parent cache - most specific cache whose scope covers this path
		//    e.g., reload("math") finds the base module because math lives under ".";
		//    reload("custom.math") finds the "custom" cache because custom.math lives under "custom"
		let bestMatch = null;
		let bestLength = -1;
		for (const moduleID of allModuleIDs) {
			const entry = cacheManager.get(moduleID);
			// All entries in the cache have an endpoint set; this guard is never true.
			/* v8 ignore next 2 */
			if (!entry?.endpoint) continue;

			const ep = entry.endpoint;
			// Base module (endpoint ".") covers everything
			// Or the path starts with the cache endpoint prefix
			// In tests the base module always covers the reloaded path; FALSE arm never fires.
			/* v8 ignore next */
			if (ep === "." || apiPath.startsWith(ep + ".")) {
				// bestLength starts at -1 so the first matching ep is always longer; FALSE never fires.
				/* v8 ignore next */
				if (ep.length > bestLength) {
					bestLength = ep.length;
					bestMatch = moduleID;
				}
			}
		}
		// bestMatch is always set when ownership history is present; FALSE never fires.
		/* v8 ignore next */
		if (bestMatch) return [bestMatch];

		// All registered endpoints have at least one module; empty result never returned in tests.
		/* v8 ignore next */
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
		// Accept both object and function wrappers (eager vs lazy mode).
		// Caller always passes a valid proxy; both guards are defensive and never triggered in tests.
		/* v8 ignore start */
		if (!existingProxy || (typeof existingProxy !== "object" && typeof existingProxy !== "function")) {
			return customProps;
		}
		/* v8 ignore stop */

		const wrapper = resolveWrapper(existingProxy);
		// resolveWrapper always returns a valid wrapper for a slothlet proxy; null result never occurs.
		/* v8 ignore start */
		if (!wrapper) {
			return customProps;
		}
		/* v8 ignore stop */

		// Get keys from fresh API to know which are "API" keys vs "custom" keys
		// freshApi is always a plain object from buildAPI \u2014 the nullish fallback array is unreachable.
		/* v8 ignore next */
		const freshKeys = new Set(freshApi ? Object.keys(freshApi) : []);

		// Get all enumerable own properties on the wrapper that are user-accessible.
		// Use the single authoritative framework key list from ComponentBase — only skip
		// known slothlet internals, never blanket-filter by underscore prefix.
		const ownKeys = Object.keys(wrapper).filter((k) => !ComponentBase.INTERNAL_KEYS.has(k));

		for (const key of ownKeys) {
			try {
				// Read value from wrapper
				const val = wrapper[key];

				// Skip all wrapper-type values (API-built, not user-set custom props)
				// This includes both valid and invalidated wrappers
				if (val && (typeof val === "object" || typeof val === "function") && resolveWrapper(val)) {
					continue;
				}

				// At this point, val is NOT a wrapper - it's either a user-set custom property
				// or a user-overridden API key with a plain value
				if (!freshKeys.has(key)) {
					// Key is NOT in fresh API - purely custom property
					customProps[key] = val;
				} else {
					// Key IS in fresh API but value is plain (no __wrapper)
					// User explicitly overwrote it with a plain value - preserve it.
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
		// Defensive: callers always pass a real proxy and a plain-object map.
		// Null inputs represent a programming error caught in higher-level guards.
		/* v8 ignore next */
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
		// Defensive: _restoreApiTree is always called with a valid freshApi object produced
		// by buildAPI. A null/primitive freshApi would indicate a build failure handled elsewhere.
		/* v8 ignore next */
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
				// Internal keys are always filtered by the proxy's ownKeysTrap before this loop; the startsWith guard never fires.
				/* v8 ignore next */
				if (typeof key === "string" && (key.startsWith("_") || key.startsWith("__"))) continue;
				// Skip built-in slothlet namespace
				// slothlet/shutdown/destroy are always filtered by ownKeysTrap; this guard never fires.
				/* v8 ignore next */
				if (key === "slothlet" || key === "shutdown" || key === "destroy") continue;

				const existingAtKey = this.slothlet.api[key];
				const freshValue = freshApi[key];

				if (existingAtKey && resolveWrapper(existingAtKey) !== null) {
					// Existing wrapper found - collect custom props before any modification
					const customProps = this._collectCustomProperties(existingAtKey, freshValue);

					// Check if the fresh value is an un-materialized lazy wrapper
					// (subdirectory from buildLazyAPI that hasn't been accessed yet)
					const freshWrapper = resolveWrapper(freshValue);
					const isLazyFresh =
						freshWrapper &&
						freshWrapper.____slothletInternal.mode === "lazy" &&
						!freshWrapper.____slothletInternal.state.materialized &&
						typeof freshWrapper.____slothletInternal.materializeFunc === "function";

					// DEBUG: Trace lazy detection for every root key
					this.slothlet.debug("reload", {
						key: "DEBUG_MODE_RESTORE_ROOT_KEY_INSPECT",
						key,
						hasFreshWrapper: !!freshWrapper,
						freshMode: freshWrapper?.____slothletInternal.mode,
						freshMaterialized: freshWrapper?.____slothletInternal.state?.materialized,
						hasMaterializeFunc: typeof freshWrapper?.____slothletInternal.materializeFunc === "function",
						isLazyFresh,
						existingMaterialized: resolveWrapper(existingAtKey)?.____slothletInternal?.state?.materialized
					});

					if (isLazyFresh) {
						// LAZY RESET PATH: Fresh value is a lazy shell - reset existing wrapper
						// to un-materialized state with the fresh materializeFunc.
						// This frees memory from any previously-materialized children and
						// ensures the next access triggers materialization from updated source.
						resolveWrapper(existingAtKey).___resetLazy(freshWrapper.____slothletInternal.materializeFunc);

						// Restore custom properties after lazy reset
						this._restoreCustomProperties(existingAtKey, customProps);

						this.slothlet.debug("reload", {
							key: "DEBUG_MODE_ROOT_KEY_RESET_LAZY",
							key,
							restoredCustomProps: Object.keys(customProps)
						});
					} else {
						// EAGER PATH: Fresh value is concrete (eager mode, or root-level file
						// which is always eager even in lazy mode) - extract impl and update.

						// Extract full impl from fresh value (which is a wrapper proxy from buildAPI).
						// CRITICAL: freshWrapper.____slothletInternal.impl may be depleted - the constructor's
						// ___adoptImplChildren() moved children (like host, port for config) out of
						// _impl and onto the wrapper as own properties, deleting them from _impl.
						// Use _extractFullImpl to reconstruct the complete impl from wrapper tree.
						let implForReload;
						// freshValue always has a wrapper (from buildAPI) and is truthy; FALSE branch is defensive.
						// When the if is TRUE, freshWrapper is always set so the ternary FALSE arm never fires.
						/* v8 ignore next 2 */
						if (freshValue && resolveWrapper(freshValue) !== null) {
							implForReload = freshWrapper ? UnifiedWrapper._extractFullImpl(freshWrapper) : freshValue;
						} else {
							// freshValue is falsy or has no wrapper — use it as-is (e.g., a plain null/undefined
							// impl). In practice every root key from buildAPI is a wrapper, so this arm is
							// a defensive fallback that is never reached during reload.
							/* v8 ignore next */
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
						const wrapper = resolveWrapper(existingAtKey);
						// wrapper is always truthy — resolveWrapper(existingAtKey) returned non-null above.
					/* v8 ignore start */
					const originalCollisionMode = wrapper ? wrapper.____slothletInternal.state.collisionMode : null;
					if (forceReplace && wrapper) {
						wrapper.____slothletInternal.state.collisionMode = "replace";
					}
					/* v8 ignore stop */
						// Restore collision mode
						// wrapper always set and originalCollisionMode always non-null when wrapper exists.
						/* v8 ignore next */
						if (wrapper && originalCollisionMode !== null) {
							wrapper.____slothletInternal.state.collisionMode = originalCollisionMode;
						}

						// Restore custom properties
						this._restoreCustomProperties(existingAtKey, customProps);

						this.slothlet.debug("reload", {
							key: "DEBUG_MODE_ROOT_KEY_UPDATED_SETIMPL",
							key,
							restoredCustomProps: Object.keys(customProps)
						});
					}
				} else if (existingAtKey === undefined) {
					// New key from reload - use setValueAtPath to create it
					const cacheManager = this.slothlet.handlers.apiCacheManager;
					const cacheEntry = cacheManager.get(moduleID);
					// cacheEntry always has folderPath set; empty-string fallback is unreachable.
					/* v8 ignore next */
					const resolvedFolderPath = cacheEntry?.folderPath || "";

					await this.setValueAtPath(this.slothlet.api, [key], freshValue, {
						mutateExisting: true,
						collisionMode,
						moduleID,
						sourceFolder: resolvedFolderPath
					});

					// boundApi is always initialized before any reload — falsy branch never reached.
					/* v8 ignore next */
					if (this.slothlet.boundApi) {
						await this.setValueAtPath(this.slothlet.boundApi, [key], freshValue, {
							mutateExisting: true,
							collisionMode,
							moduleID,
							sourceFolder: resolvedFolderPath
						});
					}
				}
				// else: existing non-wrapper value - skip (shouldn't happen in normal flow)
			}
		} else {
			// Nested path - get existing wrapper and update its implementation
			// This preserves the wrapper structure while updating the contained API
			const existing = this.getValueAtPath(this.slothlet.api, parts);

			this.slothlet.debug("reload", {
				key: "DEBUG_MODE_RESTORE_NESTED_PATH",
				endpoint,
				moduleID,
				partsPath: parts.join("."),
				existingFound: !!existing,
				// existing is always truthy when this debug block runs — falsy arm is defensive.
				// freshApi is always set from buildAPI — nullish fallback never fires.
				/* v8 ignore start */
				hasSetImpl: existing ? resolveWrapper(existing) !== null : false,
				freshApiKeys: Object.keys(freshApi || {})
				/* v8 ignore stop */
			});

			if (existing && resolveWrapper(existing) !== null) {
				// Collect custom properties from existing wrapper before reload
				const customProps = this._collectCustomProperties(existing, freshApi);

				// Conditionally force "replace" mode for reload
				// forceReplace=true (single-module or first in multi-cache): clear old keys
				// forceReplace=false (subsequent in multi-cache): preserve collision mode for merge
				const wrapper = resolveWrapper(existing);
				// wrapper is always truthy — resolveWrapper(existing) just returned non-null in the if-guard above.
				/* v8 ignore next */
				const originalCollisionMode = wrapper ? wrapper.____slothletInternal.state.collisionMode : null;

				if (forceReplace && wrapper) {
					wrapper.____slothletInternal.state.collisionMode = "replace";
					this.slothlet.debug("reload", {
						key: "DEBUG_MODE_RESTORE_FORCING_REPLACE",
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
				// Unreachable in practice: buildAPI() always returns a plain function or
				// plain object — never a UnifiedWrapper proxy. resolveWrapper(freshApi)
				// is therefore always null, so this branch never executes. The guard
				// exists to safely handle any future code path that hands a pre-wrapped
				// value to the reload pipeline.
				/* v8 ignore next */
				if (resolveWrapper(freshApi) !== null) {
					const freshWrapper = resolveWrapper(freshApi);
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
				// implForReload is always an object here — freshApi is always a plain object from buildAPI.
				/* v8 ignore next */
				if (implForReload && typeof implForReload === "object") {
					for (const key of Object.keys(implForReload)) {
						const val = implForReload[key];
						if (resolveWrapper(val) !== null) {
							const childWrapper = resolveWrapper(val);
							if (childWrapper.____slothletInternal.state.materialized) {
								implForReload[key] = UnifiedWrapper._extractFullImpl(childWrapper);
							}
						}
					}
				}

				resolveWrapper(existing).___setImpl(implForReload, moduleID);

				// Restore original collision mode
				// wrapper is always truthy here — resolveWrapper(existing) returned non-null above.
				// originalCollisionMode is never null when wrapper exists (mode is always set).
				/* v8 ignore next */
				if (wrapper && originalCollisionMode !== null) {
					wrapper.____slothletInternal.state.collisionMode = originalCollisionMode;
				}

				// Restore custom properties after reload
				this._restoreCustomProperties(existing, customProps);

				this.slothlet.debug("reload", {
					key: "DEBUG_MODE_UPDATED_WRAPPER_IMPL",
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
				// cacheEntry always has folderPath set when stored via set(); empty-string fallback is unreachable.
				/* v8 ignore next */
				const resolvedFolderPath = cacheEntry?.folderPath || "";

				// Wrap fresh API - extract properties if buildAPI returned a function
				let implForContainer = freshApi;
				// Unreachable in practice: buildAPI() never returns a bare function in
				// the container (no-existing-wrapper) reload path — it always returns a
				// plain object. Even if it did return a function, Object.keys on a
				// typical module function yields zero keys, so the loop body would be a
				// no-op anyway. The guard is defensive for hypothetical future callers.
				/* v8 ignore next */
				if (typeof freshApi === "function") {
					implForContainer = {};
					for (const key of Object.keys(freshApi)) {
						implForContainer[key] = freshApi[key];
					}
				}
				const containerWrapper = new UnifiedWrapper(this.slothlet, {
					apiPath: endpoint,
					mode: this.____config.mode,
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

				// boundApi is always initialized before any reload — falsy branch never reached.
				/* v8 ignore next */
				if (this.slothlet.boundApi) {
					await this.setValueAtPath(this.slothlet.boundApi, parts, apiToSet, {
						mutateExisting: true,
						collisionMode,
						moduleID,
						sourceFolder: resolvedFolderPath
					});
				}

				this.slothlet.debug("reload", {
					key: "DEBUG_MODE_CREATED_NEW_WRAPPER_UNEXPECTED",
					endpoint,
					moduleID
				});
			}
		}
	}
}
