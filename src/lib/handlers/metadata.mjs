/**
 * @fileoverview Metadata API handler for accessing function metadata
 * @module @cldmv/slothlet/handlers/metadata
 * @package
 */

import { ComponentBase } from "@cldmv/slothlet/factories/component-base";

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
	 * @param {Object} systemData - System metadata (filePath, apiPath, moduleId, sourceFolder)
	 * @private
	 */
	tagSystemMetadata(target, systemData) {
		if (!target) return;

		// WeakMap only accepts objects/functions as keys
		if (typeof target !== "object" && typeof target !== "function") {
			return;
		}

		// Construct full moduleID as "moduleId:apiPath/with/slashes"
		let fullModuleID = systemData.moduleId;
		if (systemData.apiPath && systemData.moduleId) {
			const apiPathSlashes = systemData.apiPath.replace(/\./g, "/");
			fullModuleID = `${systemData.moduleId}:${apiPathSlashes}`;
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
		const actualTarget = target.__wrapper || target;

		// Try _impl first (for wrapped functions), then target itself
		const systemData = this.#secureMetadata.get(actualTarget._impl || actualTarget);
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
		const actualTarget = target.__wrapper || target;

		// Get system metadata - try WRAPPER first (each wrapper has unique metadata),
		// then fall back to _impl (for cases where wrapper wasn't tagged)
		const systemData = this.#secureMetadata.get(actualTarget) || this.#secureMetadata.get(actualTarget._impl) || {};

		// Lookup user metadata by API PATH from system metadata
		// Extract root apiPath segment (e.g., "nested" from "nested.mathCjs.add")
		const apiPath = systemData.apiPath;
		const rootApiPath = apiPath ? apiPath.split(".")[0].split("/")[0] : null;

		const userMetadataEntry = rootApiPath ? this.#userMetadataStore.get(rootApiPath) : null;
		const userData = userMetadataEntry?.metadata || {};

		// Merge order: global < user (by moduleID) < SYSTEM (system always wins)
		const combined = {
			...this.#globalUserMetadata,
			...userData,
			...systemData // System metadata LAST = highest priority (immutable)
		};

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
				expected: "function or object",
				hint: "setUserMetadata expects a function or object reference"
			});
		}

		// Normalize target: if it's a proxy, get the underlying wrapper
		const actualTarget = target.__wrapper || target;

		// Get system metadata to find moduleID
		const systemData = this.#secureMetadata.get(actualTarget._impl || actualTarget) || {};
		const moduleID = systemData.moduleID || systemData.moduleId;

		if (!moduleID) {
			throw new this.SlothletError(
				"METADATA_NO_MODULE_ID",
				{ hint: "Cannot set user metadata without moduleID in system metadata" },
				null,
				{ validationError: true }
			);
		}

		// Get or create user metadata entry for this moduleID
		let entry = this.#userMetadataStore.get(moduleID);
		if (!entry) {
			entry = { metadata: {}, apiPaths: new Set() };
			this.#userMetadataStore.set(moduleID, entry);
		}

		// Set the metadata key
		entry.metadata[key] = value;
	}

	/**
	 * Remove user metadata from specific function
	 * @param {Function} target - Function to remove metadata from
	 * @param {string} [key] - Optional key to remove (removes all if omitted)
	 * @public
	 */
	removeUserMetadata(target, key) {
		if (typeof target !== "function" && typeof target !== "object") {
			throw new this.SlothletError("INVALID_METADATA_TARGET", {
				target: typeof target,
				expected: "function or object",
				hint: "removeUserMetadata expects a function or object reference"
			});
		}

		// Normalize target: if it's a proxy, get the underlying wrapper
		const actualTarget = target.__wrapper || target;

		// Get system metadata to find moduleID
		const systemData = this.#secureMetadata.get(actualTarget._impl || actualTarget) || {};
		const moduleID = systemData.moduleID || systemData.moduleId;

		if (!moduleID) return;

		const entry = this.#userMetadataStore.get(moduleID);
		if (!entry) return;

		if (key === undefined) {
			// Remove all user metadata for this moduleID
			this.#userMetadataStore.delete(moduleID);
		} else {
			// Remove specific key
			delete entry.metadata[key];
		}
	}

	/**
	 * Register user metadata for an API path
	 *
	 * @description
	 * Stores user-provided metadata keyed by apiPath (root segment only).
	 * Each apiPath entry tracks its associated paths for cleanup purposes.
	 *
	 * @param {string} apiPath - API path (e.g., "nested", "math", etc.)
	 * @param {Object} metadata - User metadata object to store/merge
	 * @package
	 */
	registerUserMetadata(apiPath, metadata = {}) {
		if (!apiPath || typeof apiPath !== "string") {
			throw new this.SlothletError(
				"INVALID_ARGUMENT",
				{
					argument: "apiPath",
					expected: "non-empty string",
					received: typeof apiPath
				},
				null,
				{ validationError: true }
			);
		}

		// Get or create user metadata entry for this apiPath
		let entry = this.#userMetadataStore.get(apiPath);
		if (!entry) {
			entry = { metadata: {}, apiPaths: new Set() };
			this.#userMetadataStore.set(apiPath, entry);
		}

		// Merge new metadata with existing
		entry.metadata = { ...entry.metadata, ...metadata };

		// Track apiPath for cleanup
		entry.apiPaths.add(apiPath);
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
}
