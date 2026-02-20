/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /src/lib/handlers/metadata.mjs
 *	@Date: 2026-01-20 20:25:54 -08:00 (1737432354)
 *	@Author: Nate Hyson <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Hyson <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-02-07 15:30:59 -08:00 (1770507059)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Metadata API handler for accessing function metadata
 * @module @cldmv/slothlet/handlers/metadata
 * @package
 */

import { ComponentBase } from "@cldmv/slothlet/factories/component-base";
import { resolveWrapper } from "@cldmv/slothlet/handlers/unified-wrapper";

/**
 * Metadata handler for introspection of function metadata
 * @class Metadata
 * @extends ComponentBase
 * @package
 */
export class Metadata extends ComponentBase {
	static slothletProperty = "metadata";

	// Secure WeakMap storage for immutable system metadata
	#secureMetadata = new WeakMap(); // target → system metadata (IMMUTABLE)

	// Centralized user metadata storage - keyed by moduleID
	#userMetadataStore = new Map(); // moduleID → { metadata: {}, apiPaths: Set<string> }
	#globalUserMetadata = {}; // global user metadata (applies to all)

	#runtimeModule = null;
	#runtimeImportPromise = null;

	_instanceId = null;

	/**
	 * Create Metadata instance
	 * @param {Object} slothlet - Slothlet instance
	 */
	constructor(slothlet) {
		super(slothlet);
		this._instanceId = `metadata_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
	}

	/**
	 * Lazily import the runtime module on first access
	 * @private
	 * @returns {Promise<object>} Runtime module
	 */
	async #ensureRuntime() {
		if (this.#runtimeModule) {
			return this.#runtimeModule;
		}

		if (!this.#runtimeImportPromise) {
			this.#runtimeImportPromise = import("@cldmv/slothlet/runtime")
				.then((module) => {
					this.#runtimeModule = module;
					return module;
				})
				.catch((err) => {
					new this.SlothletWarning("ERROR_RUNTIME_IMPORT_FAILED", {}, err);
					this.#runtimeModule = {}; // Empty object to prevent repeated imports
					return {};
				});
		}

		return this.#runtimeImportPromise;
	}

	/**
	 * Get the current API root from runtime's self binding
	 * @private
	 * @returns {object|null} Current API root (self binding)
	 */
	#getApiRoot() {
		return this.#runtimeModule?.self || null;
	}

	/**
	 * Parse a V8 CallSite object to extract file path and line number
	 * @private
	 * @param {object} callSite - V8 CallSite object
	 * @returns {object|null} Parsed { file, line } or null
	 */
	#parseCallSite(callSite) {
		try {
			const fileName = callSite.getFileName();
			const lineNumber = callSite.getLineNumber();
			if (!fileName || !lineNumber) return null;
			return {
				file: this.slothlet.helpers.resolver.toFsPath(fileName),
				line: lineNumber
			};
		} catch {
			return null;
		}
	}

	/**
	 * Deep freeze an object and all its nested properties
	 * @private
	 * @param {any} obj - Object to freeze
	 * @returns {any} Frozen object
	 */
	#deepFreeze(obj) {
		// Base cases: null, undefined, primitives
		if (obj === null || obj === undefined) return obj;
		if (typeof obj !== "object") return obj;

		// Already frozen
		if (Object.isFrozen(obj)) return obj;

		// Freeze the object itself
		Object.freeze(obj);

		// Recursively freeze all properties
		Object.getOwnPropertyNames(obj).forEach((prop) => {
			if (obj[prop] !== null && typeof obj[prop] === "object") {
				this.#deepFreeze(obj[prop]);
			}
		});

		return obj;
	}

	/**
	 * Find function by API path (dot notation)
	 * @private
	 * @param {object} apiRoot - Root API object
	 * @param {string} path - Dot-notation path
	 * @returns {Function|null} Found function or null
	 */
	#findFunctionByPath(apiRoot, path) {
		const parts = path.split(".");
		let current = apiRoot;

		for (const part of parts) {
			if (!current || typeof current !== "object") return null;
			current = current[part];
		}

		return typeof current === "function" ? current : null;
	}

	/**
	 * Find function by file path and line number from stack trace
	 * @private
	 * @param {object} apiRoot - Root API object
	 * @param {string} targetFile - File path from stack trace
	 * @param {number} targetLine - Line number from stack trace
	 * @param {WeakSet} [visited] - Visited objects tracker
	 * @returns {Function|null} Found function or null
	 */
	#findFunctionByStack(apiRoot, targetFile, targetLine, visited = new WeakSet()) {
		if (!apiRoot || typeof apiRoot !== "object") return null;
		if (visited.has(apiRoot)) return null;
		visited.add(apiRoot);

		for (const key of Object.keys(apiRoot)) {
			const value = apiRoot[key];

			// Skip unmaterialized wrappers/proxies - accessing their properties creates waiting proxies
			// that can cause "fn is not a function" errors
			const wrapper = resolveWrapper(value);
			if (value && wrapper) {
				// Only traverse if materialized, otherwise skip to avoid creating waiting proxies
				if (wrapper.____slothletInternal.state && !wrapper.____slothletInternal.state.materialized) {
					continue;
				}
			}

			if (typeof value === "function") {
				const meta = value.__metadata;
				if (meta?.sourceFile && meta?.sourceLine) {
					const metaFile = this.slothlet.helpers.resolver.toFsPath(meta.sourceFile);
					if (metaFile === targetFile && meta.sourceLine === targetLine) {
						return value;
					}
				}
			} else if (value && typeof value === "object") {
				const found = this.#findFunctionByStack(value, targetFile, targetLine, visited);
				if (found) return found;
			}
		}

		return null;
	}

	/**
	 * Tag system metadata (SECURE, IMMUTABLE)
	 * Called internally during wrapper/function creation
	 * @param {Function|Object} target - Wrapper or function to tag
	 * @param {Object} systemData - System metadata (filePath, apiPath, moduleID, sourceFolder)
	 * @param {Object} [options] - Options
	 * @param {boolean} [options._fromLifecycle] - REQUIRED: Must be true, indicates call from lifecycle system
	 * @private
	 */
	tagSystemMetadata(target, systemData, options = {}) {
		// ENFORCEMENT: All metadata tagging MUST go through lifecycle system
		if (!options._fromLifecycle) {
			const error = new Error(
				"[slothlet] tagSystemMetadata() must be called through lifecycle system. " +
					"Use lifecycle.emit('impl:created') or lifecycle.emit('impl:changed') instead of direct call."
			);
			if (!this.____config?.silent) {
				console.error(error.message);
				console.error("Stack trace:");
				console.error(error.stack);
			}
			throw error;
		}

		if (!target) return;

		// WeakMap only accepts objects/functions as keys
		if (typeof target !== "object" && typeof target !== "function") {
			return;
		}

		// Construct full moduleID as "moduleID:apiPath/with/slashes"
		let fullModuleID = systemData.moduleID;
		if (systemData.apiPath && systemData.moduleID) {
			const apiPathSlashes = systemData.apiPath.replace(/\./g, "/");
			fullModuleID = `${systemData.moduleID}:${apiPathSlashes}`;
		}

		// Derive sourceFolder from filePath if not provided
		let sourceFolder = systemData.sourceFolder;
		if (!sourceFolder && systemData.filePath) {
			// Extract directory from filePath
			const pathModule = this.slothlet.helpers.resolver.path;
			sourceFolder = pathModule.dirname(systemData.filePath);
		}

		// Store in secure WeakMap (inaccessible externally)
		const frozenSystem = Object.freeze({
			filePath: systemData.filePath,
			sourceFolder: sourceFolder,
			apiPath: systemData.apiPath,
			moduleID: fullModuleID,
			taggedAt: Date.now()
		});

		this.#secureMetadata.set(target, frozenSystem);
	}

	/**
	 * Get system metadata only (without user metadata)
	 * @param {Function|Object} target - Wrapper or function
	 * @returns {Object|null} System metadata or null
	 * @package
	 */
	getSystemMetadata(target) {
		if (!target) return null;

		// Normalize target: if it's a proxy, get the underlying wrapper
		const actualTarget = resolveWrapper(target) ?? target;

		// Try impl first (for wrapped functions), then target itself
		const systemData = this.#secureMetadata.get(actualTarget.____slothletInternal?.impl || actualTarget);
		return systemData || null;
	}

	/**
	 * Get metadata for a target (combines system + user)
	 * For wrappers: checks current impl to ensure metadata is current
	 * @param {Function|Object} target - Wrapper or function
	 * @returns {Object} Combined metadata (deeply frozen)
	 * @public
	 */
	getMetadata(target) {
		if (!target) return {};

		// Normalize target: if it's a proxy, get the underlying wrapper
		const actualTarget = resolveWrapper(target) ?? target;

		// Get system metadata - try WRAPPER first (each wrapper has unique metadata),
		// then fall back to impl (for cases where wrapper wasn't tagged)
		const systemData = this.#secureMetadata.get(actualTarget) || this.#secureMetadata.get(actualTarget.____slothletInternal?.impl) || {};

		// Lookup user metadata by BOTH moduleID AND rootApiPath
		// - registerUserMetadata() stores by root apiPath (for api.add())
		// - setUserMetadata() stores by moduleID (for external metadata.set())
		const moduleID = systemData.moduleID || systemData.moduleID;
		const apiPath = systemData.apiPath;

		// Traverse UP the apiPath chain to collect inherited metadata
		// Example: "mixed.config.settings.getPluginConfig" checks:
		//   - "mixed.config.settings.getPluginConfig"
		//   - "mixed.config.settings"
		//   - "mixed.config"
		//   - "mixed"
		const collectMetadataFromParents = (path) => {
			if (!path) return {};

			const parts = path.split(".");
			const collected = {};

			// Start from root and work down (parent metadata merged first, child overrides)
			for (let i = 1; i <= parts.length; i++) {
				const parentPath = parts.slice(0, i).join(".");
				const parentMeta = this.#userMetadataStore.get(parentPath);
				if (parentMeta?.metadata) {
					Object.assign(collected, parentMeta.metadata);
				}
			}

			return collected;
		};

		const userMetadataByModule = moduleID ? this.#userMetadataStore.get(moduleID) : null;
		const userMetadataByPath = apiPath ? collectMetadataFromParents(apiPath) : {};

		// Merge both user metadata sources (path < moduleID priority)
		const userData = {
			...userMetadataByPath,
			...(userMetadataByModule?.metadata || {})
		};

		// Merge order: global < user (by path) < user (by moduleID) < SYSTEM (system always wins)
		const combined = {
			...this.#globalUserMetadata,
			...userData,
			...systemData // System metadata LAST = highest priority (immutable)
		};

		// If there's a nested 'metadata' key, spread it to root level and remove the nested key
		if (combined.metadata && typeof combined.metadata === "object") {
			const { metadata, ...rest } = combined;
			return this.#deepFreeze({
				...rest,
				...metadata
			});
		}

		return this.#deepFreeze(combined);
	}

	/**
	 * Set global user metadata (applies to all functions)
	 * @param {string} key - Metadata key
	 * @param {unknown} value - Metadata value
	 * @public
	 */
	setGlobalMetadata(key, value) {
		this.#globalUserMetadata[key] = value;
	}

	/**
	 * Add/update user metadata for specific function
	 * @param {Function} target - Function to tag with metadata
	 * @param {string} key - Metadata key
	 * @param {unknown} value - Metadata value
	 * @public
	 */
	setUserMetadata(target, key, value) {
		if (typeof target !== "function" && typeof target !== "object") {
			throw new this.SlothletError("INVALID_METADATA_TARGET", {
				target: typeof target,
				expected: "function or object"
			});
		}

		// Normalize target: if it's a proxy, get the underlying wrapper
		const actualTarget = resolveWrapper(target) ?? target;

		// Get system metadata to find moduleID
		const systemData = this.#secureMetadata.get(actualTarget.____slothletInternal?.impl || actualTarget) || {};
		const moduleID = systemData.moduleID || systemData.moduleID;

		if (!moduleID) {
			throw new this.SlothletError("METADATA_NO_MODULE_ID", {}, null, { validationError: true });
		}

		// Get or create user metadata entry for this moduleID
		let entry = this.#userMetadataStore.get(moduleID);
		if (!entry) {
			entry = { metadata: {}, apiPaths: new Set() };
			this.#userMetadataStore.set(moduleID, entry);
		}

		// Set the metadata key
		entry.metadata[key] = value;

		// ALSO store by apiPath so path-based lookups survive moduleID changes after reload.
		// collectMetadataFromParents() in getMetadata() traverses the path hierarchy and
		// will find this entry even when the moduleID has changed (e.g. after api.slothlet.reload()).
		const apiPath = systemData.apiPath;
		if (apiPath) {
			let pathEntry = this.#userMetadataStore.get(apiPath);
			if (!pathEntry) {
				pathEntry = { metadata: {}, apiPaths: new Set() };
				this.#userMetadataStore.set(apiPath, pathEntry);
			}
			pathEntry.metadata[key] = value;
			pathEntry.apiPaths.add(apiPath);
		}
	}

	/**
	 * Remove user metadata from specific function
	 * @param {Function} target - Function to remove metadata from
	 * @param {string|string[]|Object<string, string[]>} [key] - Optional key(s) to remove (removes all if omitted). Can be:
	 *   - string: Remove single key
	 *   - string[]: Remove multiple keys (each element must be a string)
	 *   - {key: string[]}: Remove nested keys from object values
	 * @public
	 */
	removeUserMetadata(target, key) {
		if (typeof target !== "function" && typeof target !== "object") {
			throw new this.SlothletError("INVALID_METADATA_TARGET", {
				target: typeof target,
				expected: "function or object"
			});
		}

		// Normalize target: if it's a proxy, get the underlying wrapper
		const actualTarget = resolveWrapper(target) ?? target;

		// Get system metadata to find moduleID and apiPath
		const systemData = this.#secureMetadata.get(actualTarget.____slothletInternal?.impl || actualTarget) || {};
		const moduleID = systemData.moduleID;
		const apiPath = systemData.apiPath;

		if (!moduleID) return;

		// Helper to apply removal to a single store entry
		const applyRemoval = (storeKey) => {
			const storeEntry = this.#userMetadataStore.get(storeKey);
			if (!storeEntry) return;

			if (key === undefined) {
				this.#userMetadataStore.delete(storeKey);
			} else if (Array.isArray(key)) {
				for (const k of key) {
					if (typeof k !== "string") {
						throw new this.SlothletError("INVALID_METADATA_KEY", {
							key: k,
							type: typeof k,
							expected: "string"
						});
					}
					delete storeEntry.metadata[k];
				}
			} else if (typeof key === "object" && key !== null) {
				for (const [metadataKey, nestedKeys] of Object.entries(key)) {
					if (!Array.isArray(nestedKeys)) {
						throw new this.SlothletError("INVALID_METADATA_KEY", {
							key: metadataKey,
							type: typeof nestedKeys,
							expected: "array"
						});
					}
					const metadataValue = storeEntry.metadata[metadataKey];
					if (metadataValue && typeof metadataValue === "object") {
						for (const nestedKey of nestedKeys) {
							if (typeof nestedKey !== "string") {
								throw new this.SlothletError("INVALID_METADATA_KEY", {
									key: nestedKey,
									type: typeof nestedKey,
									expected: "string"
								});
							}
							delete metadataValue[nestedKey];
						}
					}
				}
			} else if (typeof key === "string") {
				delete storeEntry.metadata[key];
			} else {
				throw new this.SlothletError("INVALID_METADATA_KEY", {
					key: key,
					type: typeof key,
					expected: "string, string[], or object"
				});
			}
		};

		// Apply removal to both the moduleID entry and the apiPath entry.
		// setUserMetadata() stores under both keys, so both must be cleaned up.
		applyRemoval(moduleID);
		if (apiPath && apiPath !== moduleID) {
			applyRemoval(apiPath);
		}
	}

	/**
	 * Register user metadata for an API path
	 *
	 * @description
	 * Stores user-provided metadata keyed by BOTH moduleID and apiPath.
	 * Each entry tracks its associated paths for cleanup purposes.
	 * Supports both 2-param (apiPath, metadata) and 3-param (moduleID, apiPath, metadata) signatures.
	 *
	 * @param {string} moduleIDOrApiPath - Module ID (3-param) or API path (2-param)
	 * @param {string|Object} apiPathOrMetadata - API path (3-param) or metadata (2-param)
	 * @param {Object} [metadata] - User metadata object (3-param only)
	 * @package
	 */
	registerUserMetadata(moduleIDOrApiPath, apiPathOrMetadata, metadata) {
		// Handle both 2-param and 3-param signatures
		let moduleID, apiPath, metadataObj;

		if (arguments.length === 2) {
			// 2-param signature: registerUserMetadata(apiPath, metadata)
			apiPath = moduleIDOrApiPath;
			metadataObj = apiPathOrMetadata;
			moduleID = null;
		} else {
			// 3-param signature: registerUserMetadata(moduleID, apiPath, metadata)
			moduleID = moduleIDOrApiPath;
			apiPath = apiPathOrMetadata;
			metadataObj = metadata || {};
		}

		if (!apiPath && !moduleID) {
			throw new this.SlothletError(
				"INVALID_ARGUMENT",
				{
					argument: "apiPath or moduleID",
					expected: "non-empty string",
					received: typeof apiPath
				},
				null,
				{ validationError: true }
			);
		}

		// Register by apiPath if provided
		if (apiPath && typeof apiPath === "string") {
			let entry = this.#userMetadataStore.get(apiPath);
			if (!entry) {
				entry = { metadata: {}, apiPaths: new Set() };
				this.#userMetadataStore.set(apiPath, entry);
			}
			// Merge new metadata with existing
			entry.metadata = { ...entry.metadata, ...metadataObj };
			// Track apiPath for cleanup
			entry.apiPaths.add(apiPath);
		}

		// Register by moduleID if provided (for getMetadata() lookups)
		if (moduleID && typeof moduleID === "string") {
			let entry = this.#userMetadataStore.get(moduleID);
			if (!entry) {
				entry = { metadata: {}, apiPaths: new Set() };
				this.#userMetadataStore.set(moduleID, entry);
			}
			// Merge new metadata with existing
			entry.metadata = { ...entry.metadata, ...metadataObj };
			// Track apiPath for cleanup
			if (apiPath) {
				entry.apiPaths.add(apiPath);
			}
		}
	}

	/**
	 * Remove all user metadata for an apiPath
	 *
	 * @description
	 * Cleanup method to remove all user metadata associated with an apiPath.
	 * Used during api.remove() or cleanup operations.
	 *
	 * @param {string} apiPath - API path to remove
	 * @package
	 */
	removeUserMetadataByApiPath(apiPath) {
		if (!apiPath) return;
		this.#userMetadataStore.delete(apiPath);
	}

	/**
	 * Set metadata for all functions reachable at an API path.
	 *
	 * @description
	 * Stores metadata keyed by `apiPath` so that every function whose system
	 * `apiPath` starts with (or equals) the given path inherits the values via
	 * `collectMetadataFromParents()` in `getMetadata()`.
	 *
	 * Accepts either a single key/value pair or a plain object to merge.
	 * Multiple calls to the same path are merged; later calls override earlier
	 * ones for conflicting keys.
	 *
	 * Priority (lowest → highest): global → setForPath → set() → system.
	 *
	 * @param {string} apiPath - Dot-notation path (e.g. `"math"`, `"math.add"`)
	 * @param {string|Object} keyOrObj - Key string (with `value`) OR metadata object to merge
	 * @param {unknown} [value] - Value when `keyOrObj` is a string key
	 * @public
	 */
	setPathMetadata(apiPath, keyOrObj, value) {
		if (typeof apiPath !== "string" || !apiPath) {
			throw new this.SlothletError(
				"INVALID_ARGUMENT",
				{ argument: "apiPath", expected: "non-empty string", received: typeof apiPath },
				null,
				{ validationError: true }
			);
		}

		const metadataObj = typeof keyOrObj === "string" ? { [keyOrObj]: value } : keyOrObj;

		if (!metadataObj || typeof metadataObj !== "object" || Array.isArray(metadataObj)) {
			throw new this.SlothletError(
				"INVALID_ARGUMENT",
				{ argument: "keyOrObj", expected: "string key or plain object", received: typeof keyOrObj },
				null,
				{ validationError: true }
			);
		}

		this.registerUserMetadata(apiPath, metadataObj);
	}

	/**
	 * Remove metadata keys (or all metadata) for an API path.
	 *
	 * @description
	 * Removes one specific key, multiple keys, or ALL user metadata stored under
	 * the given `apiPath` key in the path store.
	 * Only affects metadata set via `setForPath()` / `registerUserMetadata()` for
	 * this exact path segment — it does not walk descendant paths.
	 *
	 * @param {string} apiPath - Dot-notation path (e.g. `"math"`, `"math.add"`)
	 * @param {string|string[]} [key] - Key(s) to remove. Omit to remove all metadata for the path.
	 * @public
	 */
	removePathMetadata(apiPath, key) {
		if (!apiPath || typeof apiPath !== "string") return;

		const entry = this.#userMetadataStore.get(apiPath);
		if (!entry) return;

		if (key === undefined) {
			this.#userMetadataStore.delete(apiPath);
		} else if (Array.isArray(key)) {
			for (const k of key) {
				if (typeof k !== "string") {
					throw new this.SlothletError("INVALID_METADATA_KEY", {
						key: k,
						type: typeof k,
						expected: "string"
					});
				}
				delete entry.metadata[k];
			}
		} else if (typeof key === "string") {
			delete entry.metadata[key];
		} else {
			throw new this.SlothletError("INVALID_METADATA_KEY", {
				key,
				type: typeof key,
				expected: "string or string[]"
			});
		}
	}

	/**
	 * Export user-managed metadata state for preservation across reload.
	 *
	 * @description
	 * Captures `#globalUserMetadata` and all entries in `#userMetadataStore`
	 * so they can be restored to a fresh Metadata instance after reload.
	 * Called by `slothlet.reload()` BEFORE `load()` destroys this instance.
	 *
	 * @returns {{ globalMetadata: Object, userMetadataStore: Map }} Snapshot of user state
	 * @package
	 */
	exportUserState() {
		const storeCopy = new Map();
		for (const [key, entry] of this.#userMetadataStore) {
			storeCopy.set(key, {
				metadata: { ...entry.metadata },
				apiPaths: new Set(entry.apiPaths)
			});
		}
		return {
			globalMetadata: { ...this.#globalUserMetadata },
			userMetadataStore: storeCopy
		};
	}

	/**
	 * Restore user-managed metadata state after a fresh load.
	 *
	 * @description
	 * Merges previously exported state into the new (empty) Metadata instance.
	 * Called by `slothlet.reload()` AFTER `load()` creates the new instance and
	 * BEFORE operation-history replay so that `registerUserMetadata()` from replay
	 * can properly merge over the restored base state.
	 *
	 * Merge priority: existing (from load) > saved state.
	 * This means replay-registered api.add metadata overrides restored values
	 * for the same key, which is the desired behaviour.
	 *
	 * @param {{ globalMetadata: Object, userMetadataStore: Map }} state - Previously exported state
	 * @package
	 */
	importUserState(state) {
		if (!state) return;

		// Restore global metadata (merge, existing keys win)
		if (state.globalMetadata) {
			for (const [k, v] of Object.entries(state.globalMetadata)) {
				if (!(k in this.#globalUserMetadata)) {
					this.#globalUserMetadata[k] = v;
				}
			}
		}

		// Restore user metadata store entries (merge, existing keys win)
		if (state.userMetadataStore) {
			for (const [key, savedEntry] of state.userMetadataStore) {
				const existing = this.#userMetadataStore.get(key);
				if (!existing) {
					// No current entry — restore the saved one directly
					this.#userMetadataStore.set(key, {
						metadata: { ...savedEntry.metadata },
						apiPaths: new Set(savedEntry.apiPaths)
					});
				} else {
					// Merge: saved values fill in missing keys; existing keys (from load) win
					existing.metadata = { ...savedEntry.metadata, ...existing.metadata };
					for (const p of savedEntry.apiPaths) existing.apiPaths.add(p);
				}
			}
		}
	}

	/**
	 * Get metadata of the function that called the current function
	 * Includes security verification comparing stack trace to stored metadata
	 * @returns {Promise<object|null>} Caller's metadata object or null
	 * @public
	 */
	async caller() {
		await this.#ensureRuntime();
		const apiRoot = this.#getApiRoot();
		if (!apiRoot || typeof apiRoot !== "object") return null;

		const stack = this.slothlet.helpers.resolver.getStack(this.caller);
		if (stack.length < 1) return null;

		const parsed = this.#parseCallSite(stack[0]);
		if (!parsed) return null;

		const func = this.#findFunctionByStack(apiRoot, parsed.file, parsed.line);
		if (!func) return null;

		// Get metadata using new secure system
		const metadata = this.getMetadata(func);

		// SECURITY CHECK: Verify stack trace matches metadata
		const stackFilePath = this.slothlet.helpers.resolver.toFsPath(parsed.file);
		const metaFilePath = this.slothlet.helpers.resolver.toFsPath(metadata.filePath);

		if (stackFilePath && metaFilePath && stackFilePath !== metaFilePath) {
			// WARNING: Metadata mismatch (possible tampering or hot reload)
			new this.SlothletWarning("WARNING_METADATA_MISMATCH", {
				apiPath: metadata.apiPath,
				stackFile: stackFilePath,
				metadataFile: metaFilePath
			});

			// Return metadata with security warning
			return {
				...metadata,
				__securityWarning: "FILE_PATH_MISMATCH",
				__stackFile: stackFilePath
			};
		}

		return metadata || null;
	}

	/**
	 * Get metadata of the current function
	 * @returns {Promise<object|null>} Current function's metadata or null
	 * @public
	 */
	async self() {
		await this.#ensureRuntime();
		const apiRoot = this.#getApiRoot();
		if (!apiRoot || typeof apiRoot !== "object") return null;

		const stack = this.slothlet.helpers.resolver.getStack(this.self);
		if (stack.length < 1) return null;

		const parsed = this.#parseCallSite(stack[0]);
		if (!parsed) return null;

		const func = this.#findFunctionByStack(apiRoot, parsed.file, parsed.line);
		if (!func) return null;

		// Get metadata using new secure system
		return this.getMetadata(func) || null;
	}

	/**
	 * Get metadata of any function by API path
	 * @param {string} path - Dot-notation API path
	 * @param {object} [apiRoot] - Optional API root object
	 * @returns {Promise<object|null>} Function's metadata or null
	 * @public
	 */
	async get(path, apiRoot) {
		await this.#ensureRuntime();
		const root = apiRoot || this.#getApiRoot();
		if (!root || (typeof root !== "object" && typeof root !== "function")) {
			return null;
		}

		const func = this.#findFunctionByPath(root, path);
		if (!func) return null;

		return func.__metadata || null;
	}

	/**
	 * Recursively apply metadata to API subtree
	 * @param {object} api - API object or subtree
	 * @param {object} metadata - Metadata object to apply
	 * @param {WeakSet} [visited] - Visited objects (prevents circular refs)
	 * @returns {void}
	 * @public
	 *
	 * @description
	 * Traverses API tree and applies metadata to all functions.
	 * Used during load and api.add to tag functions with system metadata.
	 *
	 * @example
	 * metadata.applyToSubtree(api, { moduleID: "base_abc123", apiPath: "math" });
	 */
	applyToSubtree(api, metadata, visited = new WeakSet()) {
		if (!api || typeof api !== "object") return;

		// Prevent infinite recursion on circular references
		if (visited.has(api)) {
			return;
		}
		visited.add(api);

		// Apply to current level if it's a function
		if (typeof api === "function") {
			this.tagSystemMetadata(api, metadata, { _fromSubtreeApply: true });
		}

		// Recurse through all properties
		for (const [key, value] of Object.entries(api)) {
			// Skip internal properties
			const skipProps = ["__metadata", "__type", "_materialize", "_impl", "____slothletInternal"];
			if (skipProps.includes(key)) {
				continue;
			}

			if (typeof value === "function") {
				// Apply metadata to function
				const pathMetadata = { ...metadata };
				if (metadata.apiPath) {
					pathMetadata.apiPath = metadata.apiPath ? `${metadata.apiPath}.${key}` : key;
				}
				this.tagSystemMetadata(value, pathMetadata, { _fromSubtreeApply: true });
			} else if (value && typeof value === "object") {
				// Recurse for objects
				const pathMetadata = { ...metadata };
				if (metadata.apiPath !== undefined) {
					pathMetadata.apiPath = metadata.apiPath ? `${metadata.apiPath}.${key}` : key;
				}
				this.applyToSubtree(value, pathMetadata, visited);
			}
		}
	}
}
