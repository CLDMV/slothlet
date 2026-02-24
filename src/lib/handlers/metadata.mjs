/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /src/lib/handlers/metadata.mjs
 *	@Date: 2026-01-20 20:25:54 -08:00 (1737432354)
 *	@Author: Nate Hyson <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Hyson <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-02-21 21:27:57 -08:00 (1771738077)
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
import { verifyToken } from "@cldmv/slothlet/handlers/lifecycle-token";

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
	 * Tag system metadata (SECURE, IMMUTABLE)
	 * Called internally during wrapper/function creation
	 *
	 * The `token` parameter must be the module-private `LIFECYCLE_TOKEN` Symbol exported
	 * from `@cldmv/slothlet/handlers/lifecycle-token`. Because a Symbol is a unique,
	 * non-forgeable value within a Node.js process, and because the token module is not
	 * listed in the package's public `exports` map, user-land code cannot construct a
	 * value that satisfies the `token === LIFECYCLE_TOKEN` check without modifying the
	 * source or importing an undocumented internal path.
	 *
	 * @param {Function|Object} target - Wrapper or function to tag
	 * @param {Object} systemData - System metadata (filePath, apiPath, moduleID, sourceFolder)
	 * @param {symbol} token - Must be `LIFECYCLE_TOKEN` — the unforgeable module-private Symbol
	 * @private
	 */
	tagSystemMetadata(target, systemData, token) {
		// ENFORCEMENT: caller must supply the per-instance lifecycle capability token.
		// The token is a Symbol created at runtime and stored in a module-private WeakMap
		// inside lifecycle-token.mjs — it is never exported as a constant, so no static
		// file import can yield a usable value.
		if (!verifyToken(this.slothlet, token)) {
			throw new this.SlothletError("METADATA_LIFECYCLE_BYPASS", {}, null, { validationError: true });
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

		// Get system metadata to find moduleID - wrapper-first (same lookup order as getMetadata)
		// so that set() and get() always resolve to the same moduleID, even after reload
		// (the wrapper retains a stable moduleID while impl gets a new one after each reload).
		const systemData = this.#secureMetadata.get(actualTarget) || this.#secureMetadata.get(actualTarget.____slothletInternal?.impl) || {};
		const moduleID = systemData.moduleID;

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

		// Get system metadata to find moduleID and apiPath - wrapper-first (same lookup order as getMetadata)
		const systemData = this.#secureMetadata.get(actualTarget) || this.#secureMetadata.get(actualTarget.____slothletInternal?.impl) || {};
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
	 * Register user metadata keyed by an identifier (moduleID or API path)
	 *
	 * @description
	 * Stores user-provided metadata in `#userMetadataStore` under the given
	 * `identifier`. The identifier is treated opaquely — callers pass either a
	 * generated moduleID (e.g. `base_slothlet`) or a dot-notation API path
	 * (e.g. `math`). `getMetadata()` retrieves entries using the same key via
	 * both the moduleID lookup and `collectMetadataFromParents`, so storing
	 * under a single key is sufficient for both cases.
	 *
	 * Multiple calls to the same identifier are merged; later calls override
	 * earlier ones for conflicting keys.
	 *
	 * @param {string} identifier - Module ID or dot-notation API path
	 * @param {Object} metadata - User metadata object to merge
	 * @package
	 */
	registerUserMetadata(identifier, metadata) {
		if (!identifier || typeof identifier !== "string") {
			throw new this.SlothletError(
				"INVALID_ARGUMENT",
				{
					argument: "identifier",
					expected: "non-empty string",
					received: typeof identifier
				},
				null,
				{ validationError: true }
			);
		}

		let entry = this.#userMetadataStore.get(identifier);
		if (!entry) {
			entry = { metadata: {}, apiPaths: new Set() };
			this.#userMetadataStore.set(identifier, entry);
		}
		// Merge incoming metadata over any existing values
		entry.metadata = { ...entry.metadata, ...metadata };
		// Track identifier in apiPaths so cleanup via removeUserMetadataByApiPath() works
		entry.apiPaths.add(identifier);
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
	 * this exact path segment - it does not walk descendant paths.
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
					// No current entry - restore the saved one directly
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
	 * Get metadata of any function by API path.
	 *
	 * Traverses `this.slothlet.api` using the dot-notation path, materializes
	 * lazy wrappers as needed, then returns the combined metadata for the
	 * resolved target via `getMetadata()`.
	 *
	 * Called by the `api.slothlet.metadata.get()` closure injected in
	 * `slothlet.injectRuntimeMetadataFunctions()`.
	 *
	 * @param {string} path - Dot-notation API path (e.g. `"math.add"`)
	 * @returns {Promise<object|null>} Combined metadata or null
	 * @public
	 */
	async get(path) {
		if (typeof path !== "string") {
			throw new this.SlothletError("INVALID_ARGUMENT", {
				argument: "path",
				expected: "string",
				received: typeof path
			});
		}

		const apiRoot = this.slothlet.api;
		if (!apiRoot) return null;

		const parts = path.split(".");
		let target = apiRoot;

		for (const part of parts) {
			if (!target || (typeof target !== "object" && typeof target !== "function")) {
				return null;
			}
			target = target[part];
		}

		if (target && typeof target._materialize === "function") {
			await target._materialize();
		}

		if (typeof target === "function" || (target && resolveWrapper(target)?.____slothletInternal?.impl)) {
			return this.getMetadata(target);
		}

		return null;
	}

	/**
	 * Get metadata for the currently-executing API function.
	 *
	 * Reads `currentWrapper` from the active context-manager store — the same
	 * fast synchronous path used by the unified wrapper's `apply` trap.
	 * Throws `RUNTIME_NO_ACTIVE_CONTEXT` when called outside of a slothlet
	 * execution context.
	 *
	 * Called by the `api.slothlet.metadata.self()` closure injected in
	 * `slothlet.injectRuntimeMetadataFunctions()`.
	 *
	 * @returns {object} Combined metadata for the current function
	 * @public
	 */
	self() {
		const ctx = this.slothlet.contextManager?.tryGetContext();
		if (!ctx || !ctx.currentWrapper) {
			throw new this.SlothletError("RUNTIME_NO_ACTIVE_CONTEXT", {}, null, { validationError: true });
		}
		return this.getMetadata(ctx.currentWrapper);
	}

	/**
	 * Get metadata for the API function that called the current function.
	 *
	 * Reads `callerWrapper` from the active context-manager store.
	 * Returns `null` when there is no caller in context (e.g. the function
	 * was invoked directly from outside the API).
	 *
	 * Called by the `api.slothlet.metadata.caller()` closure injected in
	 * `slothlet.injectRuntimeMetadataFunctions()`.
	 *
	 * @returns {object|null} Combined metadata for the calling function, or null
	 * @public
	 */
	caller() {
		const ctx = this.slothlet.contextManager?.tryGetContext();
		if (!ctx || !ctx.callerWrapper) return null;
		return this.getMetadata(ctx.callerWrapper);
	}
}
