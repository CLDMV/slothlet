/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /src/lib/handlers/unified-wrapper.mjs
 *	@Date: 2026-01-30 16:47:31 -08:00 (1769820451)
 *	@Author: Nate Hyson <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Hyson <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-02-06 22:45:32 -08:00 (1770446732)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /src/lib/handlers/unified-wrapper.mjs
 *	@Date: 2026-01-30 16:47:31 -08:00 (1769820451)
 *	@Author: Nate Hyson <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Hyson <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-01-31 11:09:55 -08:00 (1769886595)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Unified wrapper - combines __impl pattern, lazy/eager modes, materialization, and context binding
 * @module @cldmv/slothlet/handlers/unified-wrapper
 */

// Symbol to mark properties added during collision merge (so materialization knows to allow folder children alongside them)
const COLLISION_MERGED_PROPERTY = Symbol("collisionMergedProperty");
import util from "node:util";
import { ComponentBase } from "@cldmv/slothlet/factories/component-base";

/**
 * Symbol to detect errors already processed by hook error handlers
 * Must match the symbol from hook-manager.mjs
 * @private
 */
const ERROR_HOOK_PROCESSED = Symbol.for("@cldmv/slothlet/hook-error-processed");

/**
 * Extract the original error from a SlothletError wrapper if present.
 * Hooks should receive the actual error that occurred, not the wrapped SlothletError.
 * @param {Error} error - Error to unwrap
 * @returns {Error} Original error if wrapped, otherwise the error itself
 * @private
 */
function unwrapError(error) {
	// If error is a SlothletError with an originalError, return that
	if (error && error.name === "SlothletError" && error.originalError) {
		return error.originalError;
	}
	return error;
}

const wrapperDebugEnabled =
	process.env.SLOTHLET_DEBUG_WRAPPER === "1" ||
	process.env.SLOTHLET_DEBUG_WRAPPER === "true" ||
	process.env.SLOTHLET_DEBUG_SCRIPT_VERBOSE === "1" ||
	process.env.SLOTHLET_DEBUG_SCRIPT_VERBOSE === "true";

/**
 * Symbols for __type property states
 * @public
 */
export const TYPE_STATES = {
	UNMATERIALIZED: Symbol("unmaterialized"),
	IN_FLIGHT: Symbol("inFlight")
};

/**
 * Build a safe function name for debugging and inspection output.
 * @param {string} apiPath - API path to derive a name from.
 * @param {string} fallback - Fallback name when a safe name cannot be derived.
 * @returns {string} Safe function name.
 */
function getSafeFunctionName(apiPath, fallback) {
	const parts = String(apiPath || "")
		.split(".")
		.filter((part) => part && part !== "null");
	const baseName = parts.length > 0 ? parts[parts.length - 1] : "";
	let safeName = String(baseName || "").replace(/[^A-Za-z0-9_$]/g, "_");
	if (!safeName || !/^[A-Za-z_$]/.test(safeName[0])) {
		safeName = safeName ? `_${safeName}` : "";
	}
	return safeName || fallback;
}

/**
 * Create a named proxy target function for clearer debug output.
 * @param {string} nameHint - Name hint derived from apiPath.
 * @param {string} fallback - Fallback function name if nameHint is unusable.
 * @returns {Function} Named proxy target function.
 */
function createNamedProxyTarget(nameHint, fallback) {
	const safeName = getSafeFunctionName(nameHint, fallback);
	return { [safeName]: function () {} }[safeName];
}

/**
 * Unified wrapper class that handles all proxy concerns in one place:
 * - __impl pattern for reload support
 * - Lazy/eager mode materialization
 * - Recursive waiting proxy for deep lazy loading
 * - Context binding through contextManager
 *
 * @class
 * @extends ComponentBase
 * @public
 */
export class UnifiedWrapper extends ComponentBase {
	/**
	 * @param {Object} slothlet - Slothlet instance (provides contextManager, instanceID, ownership)
	 * @param {Object} options - Configuration options
	 * @param {string} options.mode - "lazy" or "eager"
	 * @param {string} options.apiPath - API path for this wrapper (e.g., "math.advanced.calc")
	 * @param {Object} [options.initialImpl=null] - Initial implementation (null for lazy mode)
	 * @param {Function} [options.materializeFunc=null] - Async function to materialize lazy modules
	 * @param {boolean} [options.isCallable=false] - Whether the wrapper should be callable
	 * @param {boolean} [options.materializeOnCreate=false] - Whether to materialize on creation
	 * @param {string} [options.filePath=null] - File path of the module source
	 * @param {string} [options.moduleID=null] - Module identifier
	 * @param {string} [options.sourceFolder=null] - Source folder for metadata
	 * @param {Object} [options.userMetadata={}] - User metadata to apply
	 *
	 * @description
	 * Creates a unified wrapper instance for a specific API path. Extends ComponentBase
	 * to access slothlet.contextManager, slothlet.instanceID, and slothlet.handlers.ownership.
	 *
	 * @example
	 * const wrapper = new UnifiedWrapper(this.slothlet, {
	 * 	mode: "lazy",
	 * 	apiPath: "math",
	 * 	initialImpl: null,
	 * 	materializeFunc: async () => import("./math.mjs")
	 * });
	 */
	constructor(
		slothlet,
		{
			mode,
			apiPath,
			initialImpl = null,
			materializeFunc = null,
			isCallable,
			materializeOnCreate = false,
			filePath = null,
			moduleID = null,
			sourceFolder = null,
			userMetadata = {}
		}
	) {
		super(slothlet);
		this._id = Math.random().toString(36).substr(2, 9); // Unique ID for debugging
		this.mode = mode;
		this.apiPath = apiPath;
		this.materializeOnCreate = materializeOnCreate;
		this.isCallable =
			typeof isCallable === "boolean"
				? isCallable
				: typeof initialImpl === "function" || (initialImpl && typeof initialImpl.default === "function");

		// Initialize _proxyTarget EARLY - before any child adoption
		// Use callable target for functions, plain object otherwise
		const shouldBeCallable = this.isCallable || (mode === "lazy" && !initialImpl);
		this._proxyTarget = shouldBeCallable ? createNamedProxyTarget(apiPath, "proxyTarget") : {};

		this._waitingProxyCache = new Map(); // Cache waiting proxies by propChain key
		this._proxy = null;
		this._invalid = false;
		this._impl = initialImpl;
		this._userMetadata = userMetadata || {}; // Store user metadata for inheritance

		this._state = {
			materialized: initialImpl !== null,
			inFlight: false
		};
		this._materializeFunc = materializeFunc;
		this.displayName = apiPath ? `${String(apiPath).replace(/\./g, "__")}__UnifiedWrapper` : "UnifiedWrapper";

		// Emit impl:created event for lifecycle management (wrapper creation)
		if (filePath && slothlet.handlers?.lifecycle) {
			slothlet.handlers.lifecycle.emit("impl:created", {
				apiPath,
				impl: this,
				wrapper: this,
				source: "initial",
				moduleID,
				filePath,
				sourceFolder: sourceFolder || slothlet.config?.dir
			});
		}

		// For eager mode with initial impl, also emit event for impl
		if (initialImpl !== null && filePath && slothlet.handlers?.lifecycle) {
			slothlet.handlers.lifecycle.emit("impl:created", {
				apiPath,
				impl: initialImpl,
				wrapper: this,
				source: "initial",
				moduleID,
				filePath,
				sourceFolder: sourceFolder || slothlet.config?.dir
			});
		}

		if (initialImpl !== null) {
			const implKeys = Object.keys(initialImpl || {});
			if ((wrapperDebugEnabled || this.config?.debug?.wrapper) && apiPath && (apiPath === "config" || apiPath.startsWith("config."))) {
				this.slothlet.debug("wrapper", {
					message: "UnifiedWrapper constructor - impl keys",
					apiPath,
					keyCount: implKeys.length,
					keySample: implKeys.slice(0, 5)
				});
			}
			this._adoptImplChildren();
			if ((wrapperDebugEnabled || this.config?.debug?.wrapper) && apiPath && (apiPath === "config" || apiPath.startsWith("config."))) {
				const childKeys = Object.keys(this._proxyTarget).filter((k) => k !== "__wrapper");
				this.slothlet.debug("wrapper", {
					message: "UnifiedWrapper constructor - after adopt",
					apiPath,
					childCount: childKeys.length,
					childKeySample: childKeys.slice(0, 5)
				});
			}
		}
	}

	/**
	 * Custom inspect output for Node.js util.inspect.
	 * @returns {*} The actual implementation for inspection.
	 */
	[util.inspect.custom](depth, options, inspect) {
		// If we have children in _proxyTarget AND we're not a function/callable, show them
		// (functions with attached properties might have children, but we want to show the function itself)
		const childKeys = this._proxyTarget ? Object.keys(this._proxyTarget).filter((k) => k !== "__wrapper") : [];
		if (childKeys.length > 0 && !this.isCallable) {
			const inspectObj = {};
			for (const key of childKeys) {
				// Return the proxy/wrapper directly - Node will recursively inspect it
				inspectObj[key] = this._proxyTarget[key];
			}
			return inspectObj;
		}

		// For callables or leaf nodes - return actual _impl value if materialized
		// For unmaterialized lazy wrappers, return the proxy to show it's a function
		if (this.mode === "lazy" && !this._state.materialized && this._proxy) {
			return this._proxy;
		}
		return this._impl;
	}

	/**
	 * Get current implementation
	 * @returns {Object|null} Current __impl value
	 * @public
	 */
	get __impl() {
		return this._impl;
	}

	/**
	 * Set new implementation and adopt children
	 * @param {*} newImpl - New implementation
	 * @param {string} [moduleID] - Optional moduleID for lifecycle event (for replacements)
	 * @private
	 */
	__setImpl(newImpl, moduleID = null) {
		if ((wrapperDebugEnabled || this.config?.debug?.wrapper) && this.apiPath === "string") {
			this.slothlet.debug("wrapper", {
				message: "__setImpl called",
				apiPath: this.apiPath,
				newImplKeys: Object.keys(newImpl || {})
			});
		}
		this._impl = newImpl;
		if (typeof newImpl === "function" || (newImpl && typeof newImpl.default === "function")) {
			this.isCallable = true;
		}
		this._invalid = false;

		// Emit impl:changed event for lifecycle management
		if (newImpl && this.slothlet.handlers?.lifecycle) {
			const wrapperMetadata = this.slothlet.handlers.metadata.getMetadata(this);
			// Use provided moduleID (for replacements) or extract from metadata
			const extractedModuleId = moduleID || (wrapperMetadata?.moduleID ? wrapperMetadata.moduleID.split(":")[0] : null);

			this.slothlet.handlers.lifecycle.emit("impl:changed", {
				apiPath: this.apiPath,
				impl: newImpl,
				wrapper: this,
				source: "hot-reload",
				moduleID: extractedModuleId,
				filePath: wrapperMetadata?.filePath,
				sourceFolder: wrapperMetadata?.sourceFolder
			});
		}

		this._adoptImplChildren();
		this._state.materialized = true;
		this._state.inFlight = false;
	}

	/**
	 * Get current materialization state
	 * @returns {Object} State object with {materialized, inFlight}
	 * @public
	 */
	__getState() {
		return this._state;
	}

	/**
	 * Trigger materialization (lazy mode only)
	 * @returns {Promise<void>}
	 * @private
	 */
	async _materialize() {
		// If already materialized, return immediately
		if (this._state.materialized) {
			return;
		}

		// If materialization is already in progress, return the existing promise
		// This allows multiple callers to await the same materialization without polling
		if (this._materializationPromise) {
			this.slothlet.debug("wrapper", {
				message: "MATERIALIZE-AWAIT: awaiting existing materialization promise",
				apiPath: this.apiPath
			});
			return this._materializationPromise;
		}

		if ((wrapperDebugEnabled || this.config?.debug?.wrapper) && this.apiPath === "string") {
			this.slothlet.debug("wrapper", {
				message: "_materialize start",
				apiPath: this.apiPath
			});
		}

		// Create and store the materialization promise
		this._materializationPromise = (async () => {
			this._state.inFlight = true;

			try {
				if (this._materializeFunc) {
					if ((wrapperDebugEnabled || this.config?.debug?.wrapper) && this.apiPath === "string") {
						this.slothlet.debug("wrapper", {
							message: "_materialize calling materializeFunc",
							apiPath: this.apiPath
						});
					}
					// POC pattern: materializeFunc can set implementation synchronously via setter
					// This matches v2 behavior where 'materialized' variable is set immediately
					const lazy_setImpl = (value) => {
						this._impl = value;
						this._invalid = false;

						// CRITICAL: Update wrapper's filePath BEFORE adopting children
						// This happens for lazy folder wrappers that import a file
						// Use the file path stored on the impl by modes-processor
						if (!this.filePath && this._impl && this._impl.__filePath) {
							this.filePath = this._impl.__filePath;
							this.slothlet.debug("wrapper", {
								message: "MATERIALIZE-UPDATE-PATH: updated filePath from null",
								apiPath: this.apiPath,
								filePath: this.filePath
							});
						}

						this._adoptImplChildren();
					};
					const result = await this._materializeFunc(lazy_setImpl);

					// If materializeFunc didn't call setter, set _impl from return value
					if (!this._impl) {
						this._impl = result;
						this._invalid = false;
						this._adoptImplChildren();
					}

					this._state.materialized = true;

					if ((wrapperDebugEnabled || this.config?.debug?.wrapper) && this.apiPath === "string") {
						this.slothlet.debug("wrapper", {
							message: "_materialize complete",
							apiPath: this.apiPath,
							resultType: typeof result,
							resultKeys: Object.keys(result || {})
						});
					}
				}
			} catch (error) {
				if ((wrapperDebugEnabled || this.config?.debug?.wrapper) && this.apiPath === "string") {
					this.slothlet.debug("wrapper", {
						message: "_materialize error",
						apiPath: this.apiPath,
						error: error.message
					});
				}
				throw error;
			} finally {
				// CRITICAL: Always clear inFlight flag and promise reference
				this._state.inFlight = false;
				this._materializationPromise = null;
			}
		})();

		// Return the promise so the caller can await it
		return this._materializationPromise;
	}

	/**
	 * @private
	 * @returns {Promise<void>}
	 *
	 * @description
	 * Exposes lazy materialization for waiting proxies and nested wrappers.
	 *
	 * @example
	 * await wrapper.__materialize();
	 */
	__materialize() {
		return this._materialize();
	}

	/**
	 * @private
	 * @returns {void}
	 *
	 * @description
	 * Invalidates this wrapper when its parent removes the API path.
	 *
	 * @example
	 * wrapper.__invalidate();
	 */
	__invalidate() {
		this._invalid = true;
		this._impl = null;
		// Clear all child properties from _proxyTarget
		if (this._proxyTarget && (typeof this._proxyTarget === "object" || typeof this._proxyTarget === "function")) {
			for (const key of Reflect.ownKeys(this._proxyTarget)) {
				if (key === "__wrapper") {
					continue;
				}
				const descriptor = Object.getOwnPropertyDescriptor(this._proxyTarget, key);
				if (descriptor?.configurable) {
					delete this._proxyTarget[key];
				}
			}
		}
	}

	/**
	 * @private
	 * @returns {void}
	 *
	 * @description
	 * Moves child properties off the impl and into the _proxyTarget as properties
	 * so this wrapper only represents the current API path.
	 *
	 * @example
	 * wrapper._adoptImplChildren();
	 */
	_adoptImplChildren() {
		const preExistingKeys = this._proxyTarget ? Object.keys(this._proxyTarget).filter((k) => k !== "__wrapper") : [];
		this.slothlet.debug("wrapper", {
			message: "ADOPT-START",
			apiPath: this.apiPath,
			wrapperId: this._id || "no-id",
			preExistingKeys: preExistingKeys.join(","),
			collisionMode: this._state.collisionMode
		});

		if (!this._impl || (typeof this._impl !== "object" && typeof this._impl !== "function")) {
			return;
		}

		const ownKeys = Reflect.ownKeys(this._impl);

		const internalKeys = new Set(["__impl", "__setImpl", "__getState", "__materialize", "_impl", "_state", "_invalid"]);
		const keepImplProperties =
			typeof this._impl === "function" || (this._impl && typeof this._impl === "object" && typeof this._impl.default === "function");
		if (keepImplProperties && this._impl && typeof this._impl === "object" && typeof this._impl.default === "function") {
			internalKeys.add("default");
		}
		const observedKeys = new Set();

		// CRITICAL: Check stored collision mode to determine how to handle existing properties
		// - For "replace" mode: Clear existing properties before adopting new ones
		// - For "merge" or "merge-replace": Keep existing properties and merge
		const existingKeys = this._proxyTarget ? Object.keys(this._proxyTarget).filter((k) => k !== "__wrapper") : [];
		const storedCollisionMode = this._state.collisionMode; // Set during collision in api-assignment.mjs
		const isMergeScenario = storedCollisionMode !== "replace" && existingKeys.length > 0;

		this.slothlet.debug("wrapper", {
			message: "ADOPT",
			apiPath: this.apiPath,
			mode: this.mode,
			storedCollisionMode,
			existingKeys: existingKeys.join(","),
			isMergeScenario
		});

		// If collision mode is "replace", clear existing properties from collision
		if (storedCollisionMode === "replace" && existingKeys.length > 0) {
			this.slothlet.debug("wrapper", {
				message: "ADOPT: REPLACE MODE - Clearing existing properties",
				count: existingKeys.length
			});

			for (const key of existingKeys) {
				const descriptor = Object.getOwnPropertyDescriptor(this._proxyTarget, key);
				if (descriptor?.configurable) {
					delete this._proxyTarget[key];
				}
			}
			// Don't add to observedKeys - let them be replaced
		} else {
			// For merge modes, add existing _proxyTarget keys to observedKeys so they don't get deleted
			for (const key of existingKeys) {
				observedKeys.add(key);
			}
		}

		// Define metadata/helper keys that should never be adopted as children
		const metadataKeys = new Set(["__childFilePaths", "__filePath", "__childFilePathsPreMaterialize"]);
		const skipKeys = typeof this._impl === "function" ? new Set(["length", "name", "prototype"]) : null;

		for (const key of ownKeys) {
			if (internalKeys.has(key)) {
				continue;
			}
			// Skip metadata/helper keys
			if (typeof key === "string" && metadataKeys.has(key)) {
				continue;
			}
			if (skipKeys && typeof key === "string" && skipKeys.has(key)) {
				continue;
			}
			const descriptor = Object.getOwnPropertyDescriptor(this._impl, key);
			if (!descriptor) {
				continue;
			}
			const value = this._impl[key];
			if (value === this._impl) {
				continue;
			}
			// Skip logging if key is a symbol (can't convert to string)
			if (typeof key !== "symbol") {
				this.slothlet.debug("wrapper", {
					message: "ADOPT-PROCESS",
					apiPath: this.apiPath,
					key,
					typeOf: typeof value,
					valueName: value?.name
				});
			}
			observedKeys.add(key);

			// CRITICAL: Check if _proxyTarget already has this key (from collision merge)
			if (key in this._proxyTarget && key !== "__wrapper") {
				// Check if this is a collision-merged property (from file)
				// Skip logging if key is a symbol
				if (typeof key !== "symbol") {
					this.slothlet.debug("wrapper", {
						message: "ADOPT-CHECK",
						apiPath: this.apiPath,
						key,
						has__collisionMergedKeys: !!this.__collisionMergedKeys,
						inSet: this.__collisionMergedKeys?.has(key)
					});
				}
				const isCollisionMerged = this.__collisionMergedKeys && this.__collisionMergedKeys.has(key);

				if (isCollisionMerged) {
					// IMPORTANT: Collision-merged means this key came from file exports that were merged
					// But we still need to update child wrapper implementation if it exists!
					// Check if there's an existing child wrapper to update
					const existingMergedChild = this._proxyTarget?.[key];
					if (existingMergedChild && typeof existingMergedChild.__setImpl === "function") {
						// Update the existing child wrapper with new implementation
						if (typeof key !== "symbol") {
							this.slothlet.debug("wrapper", {
								message: "ADOPT-COLLISION-UPDATE: updating existing child wrapper",
								apiPath: this.apiPath,
								key
							});
						}
						existingMergedChild.__setImpl(value, this.slothlet, this.moduleID, this.filePath);
					} else {
						// No wrapper to update, just skip
						if (typeof key !== "symbol") {
							this.slothlet.debug("wrapper", {
								message: "ADOPT-SKIP: is collision-merged, skipping",
								apiPath: this.apiPath,
								key
							});
						}
					}
					if (descriptor.configurable) {
						delete this._impl[key];
					}
					continue;
				}
				// Property exists but is NOT collision-merged
				// This could be from a previous materialization or folder children that should coexist
				// DON'T skip - fall through to add folder child alongside file properties
				if (typeof key !== "symbol") {
					this.slothlet.debug("wrapper", {
						message: "ADOPT-ALLOW: is NOT collision-merged, allowing",
						apiPath: this.apiPath,
						key
					});
				}
			}

			// CRITICAL: Check if child wrapper already exists to maintain live binding
			// If it exists, update its implementation instead of creating new wrapper
			const existingChild = this._proxyTarget?.[key];
			let wrapped;

			if (existingChild && typeof existingChild.__setImpl === "function") {
				// Reuse existing wrapper - update its implementation to maintain live binding
				existingChild.__setImpl(value, this.slothlet, this.moduleID, this.filePath);
				wrapped = existingChild;
				if (typeof key !== "symbol") {
					this.slothlet.debug("wrapper", {
						message: "ADOPT-REUSE: Reused existing child wrapper",
						apiPath: this.apiPath,
						key
					});
				}
			} else {
				// No existing wrapper - create new one
				wrapped = this._createChildWrapper(key, value);
				if (typeof key !== "symbol") {
					this.slothlet.debug("wrapper", {
						message: "ADOPT-WRAP",
						apiPath: this.apiPath,
						key,
						wrapped: wrapped ? "YES" : wrapped === null ? "NULL" : "NO"
					});
				}
			}

			if (wrapped) {
				// Store wrapper as property on _proxyTarget (where proxy handlers can see it)
				if (typeof key !== "symbol") {
					this.slothlet.debug("wrapper", {
						message: "ADOPT-DEFINE: defining on _proxyTarget",
						apiPath: this.apiPath,
						key
					});
				}
				Object.defineProperty(this._proxyTarget, key, {
					value: wrapped,
					writable: false,
					enumerable: true,
					configurable: true
				});
				if (typeof key !== "symbol") {
					this.slothlet.debug("wrapper", {
						message: "ADOPT-DEFINED: defined successfully on _proxyTarget",
						apiPath: this.apiPath,
						key
					});
				}
				if (descriptor.configurable && !keepImplProperties) {
					delete this._impl[key];
				}
			} else if (wrapped === null) {
				// _createChildWrapper returned null, meaning this value should be stored unwrapped
				Object.defineProperty(this._proxyTarget, key, {
					value: value,
					writable: false,
					enumerable: true,
					configurable: true
				});
				if (descriptor.configurable && !keepImplProperties) {
					delete this._impl[key];
				}
			} else {
				// wrapped is falsy but not null - shouldn't happen, but define value anyway
				Object.defineProperty(this._proxyTarget, key, {
					value: value,
					writable: false,
					enumerable: true,
					configurable: true
				});
				if (descriptor.configurable && !keepImplProperties) {
					delete this._impl[key];
				}
			}
		}

		// Only clean up unobserved keys if this is NOT a merge scenario
		// In merge mode (isMergeScenario=true), we want to keep ALL existing entries
		if (!isMergeScenario) {
			const currentKeys = this._proxyTarget ? Object.keys(this._proxyTarget).filter((k) => k !== "__wrapper") : [];
			for (const key of currentKeys) {
				if (!observedKeys.has(key)) {
					const existing = this._proxyTarget[key];
					if (existing && typeof existing.__invalidate === "function") {
						existing.__invalidate();
					}
					const descriptor = Object.getOwnPropertyDescriptor(this._proxyTarget, key);
					if (descriptor?.configurable) {
						delete this._proxyTarget[key];
					}
				}
			}
		}

		// Handle merge-after-materialize for lazy wrappers in merge-replace mode
		if (this._mergeAfterMaterialize) {
			const { existingWrapper, isMergeReplace } = this._mergeAfterMaterialize;

			// Now that this wrapper has materialized with its own keys,
			// add non-conflicting keys from the existing wrapper
			const existingKeys = existingWrapper._proxyTarget ? Object.keys(existingWrapper._proxyTarget).filter((k) => k !== "__wrapper") : [];
			for (const key of existingKeys) {
				if (!(key in this._proxyTarget) || key === "__wrapper") {
					const child = existingWrapper._proxyTarget[key];
					Object.defineProperty(this._proxyTarget, key, {
						value: child,
						writable: false,
						enumerable: true,
						configurable: true
					});
				}
			}

			// Clear the merge info
			delete this._mergeAfterMaterialize;
		}
	}

	/**
	 * @private
	 * @param {string|symbol} key - Child property name
	 * @param {unknown} value - Child value
	 * @returns {Object|Function|undefined} Wrapped child proxy when applicable
	 *
	 * @description
	 * Creates a child wrapper for impl values, including primitives.
	 *
	 * @example
	 * const child = wrapper._createChildWrapper("add", fn);
	 */
	_createChildWrapper(key, value) {
		if (value === undefined) {
			return undefined;
		}

		if (value && typeof value.__getState === "function") {
			return value;
		}

		// Return null for built-in objects that require proper 'this' binding
		// Returning null signals to the caller to store the value unwrapped
		// These include: Map, Set, WeakMap, WeakSet, Date, RegExp, Promise, Error, TypedArrays
		if (
			value instanceof Map ||
			value instanceof Set ||
			value instanceof WeakMap ||
			value instanceof WeakSet ||
			value instanceof Date ||
			value instanceof RegExp ||
			value instanceof Promise ||
			value instanceof Error ||
			ArrayBuffer.isView(value) ||
			value instanceof ArrayBuffer
		) {
			return null;
		}

		let childImpl = value;
		if (this.mode === "eager" && childImpl && typeof childImpl === "object") {
			if (Array.isArray(childImpl)) {
				childImpl = childImpl.slice();
			} else {
				const descriptors = Object.getOwnPropertyDescriptors(childImpl);
				childImpl = Object.create(Object.getPrototypeOf(childImpl), descriptors);
			}
		}

		// Get parent wrapper's metadata to inherit filePath and moduleID
		const parentMetadata = this.slothlet.handlers?.metadata?.getMetadata(this);

		// Try to get child's actual filePath from its own metadata first (if already tagged during materialization)
		const childExistingMetadata = this.slothlet.handlers?.metadata?.getMetadata(value);
		let childFilePath = childExistingMetadata?.filePath || null;
		let childModuleId = null;

		if (!childFilePath) {
			// No existing metadata on child - try __childFilePaths map from lazy materialization
			const keyStr = typeof key === "symbol" ? String(key) : key;
			this.slothlet.debug("wrapper", {
				message: "WRAP-CHILD-PATH: checking for child file path",
				apiPath: this.apiPath,
				key: keyStr,
				has_impl: !!this._impl,
				has__childFilePaths: !!(this._impl && this._impl.__childFilePaths),
				has__childFilePathsPreMaterialize: !!this.__childFilePathsPreMaterialize,
				parentFilePath: parentMetadata?.filePath
			});
			if (this._impl && this._impl.__childFilePaths) {
				this.slothlet.debug("wrapper", {
					message: "WRAP-CHILD-PATH: __childFilePaths available",
					keys: Object.keys(this._impl.__childFilePaths).join(","),
					key: keyStr,
					found: !!this._impl.__childFilePaths[key]
				});
			}
			if (this._impl && this._impl.__childFilePaths && this._impl.__childFilePaths[key]) {
				childFilePath = this._impl.__childFilePaths[key];
				this.slothlet.debug("wrapper", {
					message: "WRAP-CHILD-PATH: Using __childFilePaths",
					childFilePath
				});
			} else if (this.__childFilePathsPreMaterialize && this.__childFilePathsPreMaterialize[key]) {
				// Check pre-materialize mapping from collision merge
				childFilePath = this.__childFilePathsPreMaterialize[key];
				this.slothlet.debug("wrapper", {
					message: "WRAP-CHILD-PATH: Using __childFilePathsPreMaterialize",
					childFilePath
				});
			} else {
				// Fall back to parent's filePath (will be directory path for lazy wrappers)
				childFilePath = parentMetadata?.filePath || null;
				this.slothlet.debug("wrapper", {
					message: "WRAP-CHILD-PATH: Using fallback parentMetadata?.filePath",
					childFilePath
				});
			}

			// Extract SHORT moduleID from parent's FULL moduleID format "moduleID:apiPath"
			if (parentMetadata?.moduleID) {
				const colonIndex = parentMetadata.moduleID.indexOf(":");
				childModuleId = colonIndex > 0 ? parentMetadata.moduleID.substring(0, colonIndex) : parentMetadata.moduleID;
			}
		} else {
			// Child already has metadata - extract moduleID from it
			if (childExistingMetadata?.moduleID) {
				const colonIndex = childExistingMetadata.moduleID.indexOf(":");
				childModuleId = colonIndex > 0 ? childExistingMetadata.moduleID.substring(0, colonIndex) : childExistingMetadata.moduleID;
			}
		}

		const childSourceFolder = childExistingMetadata?.sourceFolder || parentMetadata?.sourceFolder || null;

		// Inherit user metadata from parent wrapper
		const childUserMetadata = this._userMetadata || {};

		const nestedWrapper = new UnifiedWrapper(this.slothlet, {
			mode: "eager",
			apiPath: this.apiPath ? `${this.apiPath}.${typeof key === "symbol" ? String(key) : key}` : String(key),
			initialImpl: childImpl,
			isCallable: typeof childImpl === "function",
			filePath: childFilePath,
			moduleID: childModuleId,
			sourceFolder: childSourceFolder,
			userMetadata: childUserMetadata
		});
		return nestedWrapper.createProxy();
	}

	/**
	 * Create recursive waiting proxy for deep lazy loading
	 * Builds property chain (e.g., ["advanced", "calc", "power"]) and waits for all parent
	 * wrappers to materialize before accessing the final property.
	 *
	 * Waiting proxies are ONLY created when not materialized or in-flight.
	 * Once materialized, we return actual cached values, not waiting proxies.
	 * Therefore, waiting proxies always represent in-flight/unmaterialized state.
	 *
	 * CRITICAL: Caches waiting proxies by propChain key to ensure subsequent accesses
	 * return the SAME proxy object, which can then delegate once materialization completes.
	 * This matches v2's propertyProxyCache behavior.
	 *
	 * @private
	 * @param {Array<string|symbol>} [propChain=[]] - Property chain to resolve.
	 * @returns {Proxy} Proxy that waits for materialization before applying calls.
	 */
	_createWaitingProxy(propChain = []) {
		const wrapper = this;

		// Create cache key from propChain
		const cacheKey = propChain.join(".");

		// Return cached waiting proxy if it exists
		if (wrapper._waitingProxyCache.has(cacheKey)) {
			return wrapper._waitingProxyCache.get(cacheKey);
		}

		// Waiting proxies always use function target since they represent unknown/in-flight values
		// Native typeof will always return "function" - use __type property for actual state
		const waitingTarget = createNamedProxyTarget(`${wrapper.apiPath}_waitingProxy`, "waitingProxyTarget");

		// Link waiting proxy back to wrapper so metadata can be found
		waitingTarget.__wrapper = wrapper;

		const waitingProxy = new Proxy(waitingTarget, {
			get(___target, prop) {
				if (prop === "then") return undefined;
				if (prop === "__wrapper") return wrapper;
				if (prop === "__materialize") return wrapper.__materialize.bind(wrapper);
				if (prop === "__impl") {
					// For waiting proxies, return the impl after resolving through _proxyTarget properties
					// This allows waiting proxies to behave like regular wrappers for inspection
					if (wrapper._impl !== null && wrapper._impl !== undefined) {
						// Resolve through propChain to get the actual child wrapper
						let current = wrapper;
						for (const chainProp of propChain) {
							if (current._proxyTarget && chainProp in current._proxyTarget && chainProp !== "__wrapper") {
								const cached = current._proxyTarget[chainProp];
								if (cached && cached.__wrapper) {
									current = cached.__wrapper;
								} else {
									// Not a wrapper, return undefined
									return undefined;
								}
							} else if (current._impl && typeof current._impl === "object" && util.types.isProxy(current._impl)) {
								// Custom proxy - can't traverse further
								return current._impl;
							} else {
								return undefined;
							}
						}
						// Return the resolved wrapper's impl
						return current._impl;
					}
					// Not yet materialized
					return null;
				}

				// Trigger materialization if needed (fire-and-forget)
				// This ensures lazy wrappers start loading when accessed
				if (wrapper.mode === "lazy" && !wrapper._state.materialized && !wrapper._state.inFlight) {
					wrapper._materialize();
				}

				if (prop === util.inspect.custom) {
					// Custom inspect for console.log
					// If in flight, return waiting proxy target
					if (wrapper._state.inFlight) {
						return waitingTarget;
					}
					// If unmaterialized, return waiting proxy target
					if (!wrapper._state.materialized) {
						return waitingTarget;
					}
					// Check if property exists after materialization
					if (wrapper._impl) {
						let current = wrapper._impl;
						for (const chainProp of propChain) {
							if (!current || current === null) {
								return undefined;
							}
							current = current[chainProp];
						}
						// Return the actual value for inspection
						return current;
					}
					return waitingTarget;
				}
				if (prop === "__type") {
					wrapper.slothlet.debug("wrapper", {
						message: "WAITING-TYPE",
						apiPath: wrapper.apiPath,
						propChain: propChain.join(","),
						materialized: wrapper._state.materialized,
						hasImpl: wrapper._impl !== null
					});
					// CRITICAL: After wrapper materialization, resolve the propChain and return actual type
					// This fixes collision merge scenarios where waiting proxies are created before materialization
					// After materialization, these proxies should report the correct type, not IN_FLIGHT
					if (wrapper._state.materialized || (wrapper._impl !== null && wrapper._impl !== undefined)) {
						// Wrapper has materialized - walk propChain to determine actual type
						let current = wrapper.createProxy();
						for (const chainProp of propChain) {
							if (!current) break;
							if (current && current.__wrapper) {
								const currentWrapper = current.__wrapper;
								if (currentWrapper._proxyTarget && chainProp in currentWrapper._proxyTarget) {
									current = currentWrapper._proxyTarget[chainProp];
									wrapper.slothlet.debug("wrapper", {
										message: "WAITING-TYPE-WALK: found in _proxyTarget",
										chainProp: String(chainProp),
										typeOf: typeof current
									});
									continue;
								}
								if (
									currentWrapper._impl &&
									typeof currentWrapper._impl === "object" &&
									currentWrapper._impl !== null &&
									chainProp in currentWrapper._impl
								) {
									current = currentWrapper._impl[chainProp];
									wrapper.slothlet.debug("wrapper", {
										message: "WAITING-TYPE-WALK: found in _impl",
										chainProp: String(chainProp),
										typeOf: typeof current
									});
									continue;
								}
							}
							wrapper.slothlet.debug("wrapper", {
								message: "WAITING-TYPE-WALK: accessed directly",
								chainProp: String(chainProp),
								typeOf: typeof current
							});
							current = current[chainProp];
						}
						// Return the actual type of the resolved value
						const resolvedType =
							typeof current === "function" ? "function" : typeof current === "object" && current !== null ? "object" : typeof current;
						wrapper.slothlet.debug("wrapper", {
							message: "WAITING-TYPE-RESOLVED",
							apiPath: wrapper.apiPath,
							propChain: propChain.join(","),
							resolvedType
						});
						return resolvedType;
					}
					// Waiting proxies return IN_FLIGHT if wrapper not yet materialized
					wrapper.slothlet.debug("wrapper", {
						message: "WAITING-TYPE-INFLIGHT: returning IN_FLIGHT",
						apiPath: wrapper.apiPath,
						propChain: propChain.join(",")
					});
					return TYPE_STATES.IN_FLIGHT;
				}
				if (prop === "__metadata") {
					// Return metadata through wrapper
					if (wrapper.slothlet.handlers?.metadata) {
						return wrapper.slothlet.handlers.metadata.getMetadata(wrapper);
					}
					return {};
				}
				if (typeof prop === "symbol") return undefined;
				if (prop === "length") {
					// For waiting proxies in lazy mode, we can't know the length until materialized
					// Return 0 as a placeholder - the actual length will be available after materialization
					return 0;
				}
				if (prop === "name") return waitingTarget.name || "waitingProxyTarget";
				if (prop === "toString") {
					// For waiting proxies, we can't access impl yet, so use target
					return Function.prototype.toString.bind(waitingTarget);
				}
				if (prop === "valueOf") {
					// For waiting proxies, we can't access impl yet, so use target
					return Function.prototype.valueOf.bind(waitingTarget);
				}

				// CRITICAL: Check if wrapper._impl is already set
				// This allows property access once _impl is populated (matches v2 behavior)
				// Lifecycle events, metadata, and ownership may still be in progress
				// This handles custom proxy behavior like array access on devices proxy
				// Custom proxies return plain objects/values that should NOT be wrapped
				if (
					wrapper._impl !== null &&
					wrapper._impl !== undefined &&
					typeof wrapper._impl === "object" &&
					util.types.isProxy(wrapper._impl)
				) {
					// Direct delegation to custom proxy
					// Traverse propChain through the custom proxy first
					let result = wrapper._impl;
					for (const chainProp of propChain) {
						result = result[chainProp];
					}
					// Then access the requested prop on the result
					return result[prop];
				}

				// CRITICAL: After materialization OR if _impl is set, resolve through property chain
				// Check _impl FIRST (not just _state.materialized) to match v2 behavior where
				// once state.materialized variable was set, values were returned synchronously
				// This allows waiting proxies to resolve immediately once _impl is available,
				// even if _state.inFlight is still true (materialization finishing up)
				if (wrapper._impl !== null && wrapper._impl !== undefined) {
					// Start from the parent wrapper and traverse using _proxyTarget properties
					let current = wrapper;
					let remainingChain = [...propChain];

					// Traverse propChain through _proxyTarget until we hit a custom proxy
					for (let i = 0; i < propChain.length; i++) {
						const chainProp = propChain[i];

						// If current wrapper has a custom proxy, delegate remaining chain to it
						if (current._impl && typeof current._impl === "object" && util.types.isProxy(current._impl)) {
							// Traverse remaining propChain through the custom proxy
							let proxyResult = current._impl;
							for (const remainingProp of remainingChain) {
								proxyResult = proxyResult[remainingProp];
							}

							// Now access the final prop on the result
							return proxyResult[prop];
						}

						if (current && current._proxyTarget && chainProp in current._proxyTarget && chainProp !== "__wrapper") {
							const cached = current._proxyTarget[chainProp];

							// Get the wrapper from cached proxy
							if (cached && cached.__wrapper) {
								current = cached.__wrapper;
								remainingChain.shift(); // Remove this prop from remaining chain
							} else {
								// Cached value is not a wrapper (primitive or unwrapped object)
								return undefined;
							}
						} else {
							// Property doesn't exist in property chain
							return undefined;
						}
					}

					// CRITICAL: If current wrapper's _impl is a custom proxy, delegate property access to it
					// Custom proxies handle their own property access (array indices, computed properties, etc.)
					if (current && current._impl && typeof current._impl === "object" && util.types.isProxy(current._impl)) {
						return current._impl[prop];
					}

					// Now check if the final prop exists in the resolved wrapper's _proxyTarget
					if (current && current._proxyTarget && prop in current._proxyTarget && prop !== "__wrapper") {
						return current._proxyTarget[prop];
					}

					// Property doesn't exist
					return undefined;
				}

				// CRITICAL FIX: Before materialization, check if prop exists in _proxyTarget
				// This handles collision-merged file properties that are added to _proxyTarget BEFORE materialization
				// For lazy folders in merge mode, file properties are copied to _proxyTarget during collision handling
				// These properties should be accessible immediately without waiting for full materialization
				if (wrapper._proxyTarget && prop in wrapper._proxyTarget && prop !== "__wrapper") {
					wrapper.slothlet.debug("wrapper", {
						message: "WAITING-GET-PREMATURE: found in _proxyTarget before materialization",
						apiPath: wrapper.apiPath,
						prop
					});
					return wrapper._proxyTarget[prop];
				}

				// CRITICAL FIX #2: For collision-merged lazy folders, trigger materialization immediately
				// This ensures folder children are available in _proxyTarget before returning
				// Without this, folder properties remain as waiting proxies instead of being accessible
				if (wrapper.__needsImmediateChildAdoption && wrapper._materializeFunc && !wrapper._state.materialized && !wrapper._state.inFlight) {
					wrapper.slothlet.debug("wrapper", {
						message: "WAITING-GET-IMMEDIATE-MAT: triggering immediate materialization for collision-merged folder",
						apiPath: wrapper.apiPath,
						prop
					});
					// Trigger materialization NOW (async but we'll check after)
					wrapper._materialize().catch((err) => {
						wrapper.slothlet.debug("wrapper", {
							message: "WAITING-GET-IMMEDIATE-MAT-ERROR: materialization failed",
							apiPath: wrapper.apiPath,
							error: err.message
						});
					});
					// Now check if prop is in _proxyTarget after materialization started
					// _adoptImplChildren runs synchronously within _materialize before any awaits
					if (prop in wrapper._proxyTarget) {
						wrapper.slothlet.debug("wrapper", {
							message: "WAITING-GET-IMMEDIATE-MAT-SUCCESS: now available in _proxyTarget",
							apiPath: wrapper.apiPath,
							prop
						});
						return wrapper._proxyTarget[prop];
					}
				}

				// If materialization is in flight but not complete, return waiting proxy
				if (wrapper._state.inFlight) {
					// Materialization started but not complete yet
					// Return waiting proxy to allow chaining, but __type will return IN_FLIGHT symbol
					return wrapper._createWaitingProxy([...propChain, prop]);
				}

				// Not yet materialized and not in flight - create waiting proxy that will trigger materialization
				return wrapper._createWaitingProxy([...propChain, prop]);
			},

			async apply(___target, ___thisArg, args) {
				wrapper.slothlet.debug("wrapper", {
					message: "WAITING-APPLY-ENTRY",
					apiPath: wrapper.apiPath,
					propChain: propChain.join(","),
					args: args.join(",")
				});
				const chainLabel = propChain.map((prop) => String(prop)).join(".");

				if (wrapper.mode === "lazy" && !wrapper._state.materialized && !wrapper._state.inFlight) {
					wrapper.slothlet.debug("wrapper", {
						message: "WAITING-APPLY-MATERIALIZE: Triggering materialization",
						apiPath: wrapper.apiPath
					});
					await wrapper._materialize();
					wrapper.slothlet.debug("wrapper", {
						message: "WAITING-APPLY-MATERIALIZED: Materialization complete",
						apiPath: wrapper.apiPath
					});
				}

				wrapper.slothlet.debug("wrapper", {
					message: "WAITING-APPLY-START-WALK: Starting propChain walk",
					apiPath: wrapper.apiPath,
					propChain: propChain.join(",")
				});
				let current = wrapper.createProxy();
				let lastWrapper = wrapper;

				for (const prop of propChain) {
					wrapper.slothlet.debug("wrapper", {
						message: "WAITING-APPLY-WALK",
						prop: String(prop),
						typeOf: typeof current,
						constructorName: current?.constructor?.name
					});
					if (!current) {
						// PRIORITY 1: If the chain involves ANY symbol access (like util.inspect.custom), silently return undefined
						// Check the entire propChain, not just what we've iterated so far
						// This prevents errors during Node.js inspection operations, regardless of wrapper state
						if (propChain.some((p) => typeof p === "symbol")) {
							return undefined;
						}
						// PRIORITY 2: Check if root wrapper or last tracked wrapper was invalidated/deleted during async materialization
						// This happens when api.remove() is called while lazy wrappers are still materializing
						if (wrapper._invalid || wrapper._impl === null || (lastWrapper && (lastWrapper._invalid || lastWrapper._impl === null))) {
							return undefined;
						}
						// PRIORITY 3: If we're trying to access hasAttribute (or other inspect properties) on undefined,
						// return undefined instead of throwing - this happens when Node.js inspects non-existent properties
						const finalProp = propChain[propChain.length - 1];
						if (
							finalProp === "hasAttribute" ||
							finalProp === Symbol.toStringTag ||
							finalProp === "constructor" ||
							typeof finalProp === "symbol" ||
							typeof prop === "symbol"
						) {
							return undefined;
						}
						throw new Error(`${wrapper.apiPath}.${chainLabel} - cannot access ${String(prop)} of undefined`);
					}

					if (current && current.__wrapper && current.__getState) {
						const state = current.__getState();
						if (!state.materialized) {
							if (!state.inFlight && typeof current.__materialize === "function") {
								await current.__materialize();
							}
							while (!current.__getState().materialized) {
								const nextState = current.__getState();
								if (!nextState.inFlight && !nextState.materialized) {
									throw new Error(`${wrapper.apiPath}.${chainLabel} failed to materialize ${String(prop)}`);
								}
								await new Promise((resolve) => setImmediate(resolve));
							}
						}
					}

					if (current && current.__wrapper) {
						const currentWrapper = current.__wrapper;
						lastWrapper = currentWrapper; // Track the wrapper we're accessing
						if (currentWrapper._proxyTarget && prop in currentWrapper._proxyTarget && prop !== "__wrapper") {
							current = currentWrapper._proxyTarget[prop];
							continue;
						}
						// Check if _impl is an object before using 'in' operator
						if (
							currentWrapper._impl &&
							typeof currentWrapper._impl === "object" &&
							currentWrapper._impl !== null &&
							prop in currentWrapper._impl
						) {
							current = currentWrapper._impl[prop];
							continue;
						}
					}

					current = current[prop];
				}

				wrapper.slothlet.debug("wrapper", {
					message: "WAITING-APPLY",
					apiPath: wrapper.apiPath,
					propChain: propChain.join(","),
					typeOf: typeof current,
					currentName: current?.name,
					isFunction: typeof current === "function"
				});

				if (typeof current === "function") {
					return current(...args);
				}

				// Handle util.inspect checking for hasAttribute on primitives
				// When Node.js inspects an object, it checks for hasAttribute on all properties
				// If we're checking hasAttribute on a primitive value, just return undefined
				if (propChain[propChain.length - 1] === "hasAttribute") {
					return undefined;
				}

				// If current is undefined/null after traversing the chain, throw an error
				// The property doesn't exist after materialization
				if (current === undefined || current === null) {
					throw new Error(`${wrapper.apiPath}.${chainLabel} is not a function or does not exist`);
				}

				throw new Error(`${wrapper.apiPath}.${chainLabel} is not a function`);
			}
		});

		// Cache the waiting proxy so subsequent accesses return the same proxy object
		wrapper._waitingProxyCache.set(cacheKey, waitingProxy);

		return waitingProxy;
	}

	/**
	 * Create main proxy for this wrapper
	 * Handles lazy/eager mode logic, property access, and context binding
	 *
	 * @returns {Proxy} Main proxy for API
	 * @public
	 */
	createProxy() {
		const wrapper = this;
		if (wrapper._proxy) {
			return wrapper._proxy;
		}

		// Optional: materialize on create for lazy mode when materializeOnCreate flag is set
		// This triggers background loading - typeof will still return "function" but first access is faster
		if (wrapper.materializeOnCreate && wrapper.mode === "lazy" && !wrapper._state.materialized && wrapper._materializeFunc) {
			wrapper._materialize(); // Fire-and-forget background materialization
		}

		// Use the _proxyTarget that was already initialized in constructor
		const proxyTarget = wrapper._proxyTarget;

		// Ensure __wrapper is defined
		if (!("__wrapper" in proxyTarget)) {
			Object.defineProperty(proxyTarget, "__wrapper", {
				value: wrapper,
				writable: false,
				enumerable: false,
				configurable: true
			});
		}

		// Add custom inspect to proxyTarget if not already present
		if (!(util.inspect.custom in proxyTarget)) {
			Object.defineProperty(proxyTarget, util.inspect.custom, {
				value: function () {
					// If _proxyTarget has children, show them
					const childKeys = Object.keys(wrapper._proxyTarget).filter((k) => k !== "__wrapper");
					if (childKeys.length > 0 && !wrapper.isCallable) {
						const obj = {};
						for (const key of childKeys) {
							// Return the value directly - if it's a proxy, Node will inspect it recursively
							obj[key] = wrapper._proxyTarget[key];
						}
						return obj;
					}
					// For lazy unmaterialized wrappers with null _impl, return the proxy target
					if (wrapper.mode === "lazy" && !wrapper._state.materialized && (wrapper._impl === null || wrapper._impl === undefined)) {
						return proxyTarget;
					}
					// Otherwise return _impl (functions, primitives, etc)
					return wrapper._impl;
				},
				writable: false,
				enumerable: false,
				configurable: true
			});
		}

		/**
		 * @private
		 * @param {Object} target - Proxy target
		 * @param {string|symbol} prop - Property name
		 * @param {Object} receiver - Proxy receiver
		 * @returns {unknown} Resolved property value
		 *
		 * @description
		 * Resolves properties from _proxyTarget properties, impl values, or target properties.
		 */
		const getTrap = (target, prop, receiver) => {
			// Debug logging for collision scenarios
			if (prop === "power" || prop === "add") {
				this.slothlet.debug("wrapper", {
					message: "GET-START",
					apiPath: wrapper.apiPath,
					prop: String(prop),
					mode: wrapper.mode,
					collisionMode: wrapper._state.collisionMode || "none",
					materialized: wrapper._state.materialized,
					hasImpl: wrapper._impl !== null,
					inProxyTarget: prop in wrapper._proxyTarget
				});
			}

			if (prop === "__impl") return wrapper._impl;
			if (prop === "__type") {
				// Trigger materialization if needed
				if (wrapper.mode === "lazy" && !wrapper._state.materialized && !wrapper._state.inFlight) {
					wrapper._materialize();
				}

				// Return state symbols for lazy mode if not ready
				if (wrapper.mode === "lazy" && wrapper._state.inFlight) {
					return TYPE_STATES.IN_FLIGHT;
				}
				if (wrapper.mode === "lazy" && !wrapper._state.materialized) {
					return TYPE_STATES.UNMATERIALIZED;
				}

				// Return typeof the actual impl (not the proxy target)
				const impl = wrapper._impl;
				if (typeof impl === "function") {
					return "function";
				}
				if (impl && typeof impl === "object" && typeof impl.default === "function") {
					return "function";
				}
				if (impl && typeof impl === "object") {
					return "object";
				}
				// Handle primitives
				if (typeof impl === "string") {
					return "string";
				}
				if (typeof impl === "number") {
					return "number";
				}
				if (typeof impl === "boolean") {
					return "boolean";
				}
				if (typeof impl === "symbol") {
					return "symbol";
				}
				if (typeof impl === "bigint") {
					return "bigint";
				}
				return "undefined";
			}
			if (prop === "__getState") return wrapper.__getState.bind(wrapper);
			if (prop === "__setImpl") return wrapper.__setImpl.bind(wrapper);
			if (prop === "__materialize") return wrapper.__materialize.bind(wrapper);
			if (prop === "_materialize") return wrapper.__materialize.bind(wrapper);
			if (prop === "__invalidate") return wrapper.__invalidate.bind(wrapper);
			if (prop === "__slothletPath") return wrapper.apiPath;
			if (prop === "__wrapper") return wrapper;
			if (prop === "__metadata") {
				// Return combined system + user metadata
				if (wrapper.slothlet.handlers?.metadata) {
					return wrapper.slothlet.handlers.metadata.getMetadata(wrapper);
				}
				return {};
			}
			if (prop === "_impl") return wrapper._impl;
			if (prop === "_state") return wrapper._state;
			if (prop === "_invalid") return wrapper._invalid;
			if (prop === "then") return undefined;
			if (prop === "constructor") return Object.prototype.constructor;
			if (prop === util.inspect.custom) {
				// Return function that builds object from _proxyTarget or returns _impl
				return () => {
					// If _proxyTarget has children and we're not a callable, show children
					const childKeys = Object.keys(wrapper._proxyTarget).filter((k) => k !== "__wrapper");
					if (childKeys.length > 0 && !wrapper.isCallable) {
						const obj = {};
						for (const key of childKeys) {
							obj[key] = wrapper._proxyTarget[key];
						}
						return obj;
					}
					// For lazy wrappers with null _impl, return the proxy target or proxy itself
					if (wrapper.mode === "lazy" && !wrapper._state.materialized && (wrapper._impl === null || wrapper._impl === undefined)) {
						this.slothlet.debug("wrapper", {
							message: "util.inspect.custom: Lazy unmaterialized",
							apiPath: wrapper.apiPath,
							_proxyTarget: wrapper._proxyTarget,
							_proxy: wrapper._proxy
						});
						return wrapper._proxyTarget || wrapper._proxy;
					}
					// Otherwise return _impl
					return wrapper._impl;
				};
			}
			if (prop === Symbol.toStringTag) {
				// Return "Object" for object exports, "Function" for function exports
				const impl = wrapper._impl;
				if (typeof impl === "function") {
					return "Function";
				}
				if (impl && typeof impl === "object" && typeof impl.default === "function") {
					return "Function";
				}
				return "Object";
			}
			if (typeof prop === "symbol") return undefined;
			if (prop === "length") {
				// Return actual function length from impl
				const impl = wrapper._impl;
				if (typeof impl === "function") {
					return impl.length;
				}
				if (impl && typeof impl === "object" && typeof impl.default === "function") {
					return impl.default.length;
				}
				return 0;
			}
			if (prop === "name") {
				// Return name derived from API path, not the internal function name
				// This ensures consistency: api.logger should report as "logger", not "log"
				if (wrapper.apiPath) {
					const pathParts = wrapper.apiPath.split(".");
					const lastPart = pathParts[pathParts.length - 1];
					if (lastPart) {
						return lastPart;
					}
				}
				return target.name || "unifiedWrapperProxy";
			}
			if (prop === "toString") {
				// Return toString bound to the actual impl, not the proxy target
				const impl = wrapper._impl;
				if (typeof impl === "function") {
					return impl.toString.bind(impl);
				}
				if (impl && typeof impl === "object" && typeof impl.default === "function") {
					return impl.default.toString.bind(impl.default);
				}
				return Function.prototype.toString.bind(target);
			}
			if (prop === "valueOf") {
				// Return valueOf bound to the actual impl, not the proxy target
				const impl = wrapper._impl;
				if (typeof impl === "function") {
					return impl.valueOf.bind(impl);
				}
				if (impl && typeof impl === "object" && typeof impl.default === "function") {
					return impl.default.valueOf.bind(impl.default);
				}
				return Function.prototype.valueOf.bind(target);
			}

			if (wrapper._invalid) {
				return undefined;
			}

			if (wrapper.mode === "lazy" && !wrapper._state.materialized && !wrapper._state.inFlight) {
				wrapper._materialize();
			}

			// If lazy mode is materialized and property doesn't exist in _impl, return undefined
			// CRITICAL: Check _proxyTarget BEFORE creating waiting proxy
			// In lazy mode with collisions, children may already be in _proxyTarget (from file/folder merge)
			// Return these children directly instead of creating a waiting proxy
			if (prop in wrapper._proxyTarget && prop !== "__wrapper") {
				// CRITICAL: In replace mode, check if property should exist at all
				if (wrapper._state.collisionMode === "replace" && (prop === "power" || prop === "add")) {
					this.slothlet.debug("wrapper", {
						message: "GET-CACHED-REPLACE",
						apiPath: wrapper.apiPath,
						prop: String(prop),
						collisionMode: wrapper._state.collisionMode,
						proxyTargetKeys: Object.keys(wrapper._proxyTarget).join(", ")
					});
				}
				this.slothlet.debug("wrapper", {
					message: "GET-CACHED",
					apiPath: wrapper.apiPath,
					prop: String(prop),
					materialized: wrapper._state.materialized,
					hasImpl: wrapper._impl !== null
				});
				const cached = wrapper._proxyTarget[prop];
				// If it's a wrapper with a primitive impl, return the unwrapped value
				// This ensures live runtime gets the actual value, not the wrapper object
				if (cached && cached.__wrapper && cached.__wrapper._impl !== null && cached.__wrapper._impl !== undefined) {
					const cachedImpl = cached.__wrapper._impl;
					// For primitives, return the unwrapped value
					const cachedType = typeof cachedImpl;
					if (
						cachedType === "string" ||
						cachedType === "number" ||
						cachedType === "boolean" ||
						cachedType === "bigint" ||
						cachedType === "symbol"
					) {
						return cachedImpl;
					}
				}
				// If cached is a wrapper in lazy mode that needs materialization, trigger it
				if (cached && cached.__wrapper) {
					const cachedWrapper = cached.__wrapper;
					if (cachedWrapper.mode === "lazy" && !cachedWrapper._state.materialized && !cachedWrapper._state.inFlight) {
						cachedWrapper._materialize();
					}
				}
				// For objects and functions, return the wrapper/proxy as-is
				return cached;
			}

			// CRITICAL: Check if _impl is already set (matches v2's state.materialized check)
			// This allows synchronous property access even during materialization
			// Must check BEFORE inFlight to handle synchronous setter pattern
			// Note: _impl is initialized to null, so check for non-null explicitly
			if (wrapper._impl !== null && wrapper._impl !== undefined) {
				// If _impl is a custom Proxy, delegate property access directly to it
				// Custom proxies handle their own property access logic (array indices, computed properties, etc.)
				if (typeof wrapper._impl === "object" && util.types.isProxy(wrapper._impl)) {
					return wrapper._impl[prop];
				}

				// For regular objects/functions, check _proxyTarget or _impl properties
				if (prop in wrapper._proxyTarget && prop !== "__wrapper") {
					if (prop === "power" || prop === "add") {
						this.slothlet.debug("wrapper", {
							message: "GET-PROXYGET: Accessing",
							prop,
							wrapperId: wrapper._id,
							apiPath: wrapper.apiPath,
							collisionMode: wrapper._state.collisionMode || "none"
						});
						this.slothlet.debug("wrapper", {
							message: "GET-PROXYGET: Found in _proxyTarget",
							proxyTargetKeys: Object.keys(wrapper._proxyTarget).join(", ")
						});
					}
					const cached = wrapper._proxyTarget[prop];
					// If cached is a wrapper in lazy mode that needs materialization, trigger it
					if (cached && cached.__wrapper) {
						const cachedWrapper = cached.__wrapper;
						if (cachedWrapper.mode === "lazy" && !cachedWrapper._state.materialized && !cachedWrapper._state.inFlight) {
							cachedWrapper._materialize();
						}
					}
					return cached;
				}
			}

			// If lazy mode is materialized and property doesn't exist in _proxyTarget or _impl, return undefined
			// This prevents creating waiting proxies for properties that were deleted
			if (
				wrapper.mode === "lazy" &&
				wrapper._state.materialized &&
				!(prop in wrapper._proxyTarget) &&
				wrapper._impl &&
				!(prop in wrapper._impl)
			) {
				return undefined;
			}

			if (wrapper.mode === "lazy" && (wrapper._state.inFlight || !wrapper._impl)) {
				// Trigger materialization if not started yet
				// This ensures lazy wrappers start loading when their properties are accessed
				if (!wrapper._state.materialized && !wrapper._state.inFlight) {
					wrapper._materialize();
				}

				this.slothlet.debug("wrapper", {
					message: "LAZY-GET: will create waiting proxy",
					prop: String(prop),
					collisionMode: wrapper._state.collisionMode || "none",
					apiPath: wrapper.apiPath
				});

				// If _impl is already set and is a custom proxy, delegate even during inFlight
				// This allows custom proxies to work immediately after being loaded
				if (wrapper._impl && typeof wrapper._impl === "object" && util.types.isProxy(wrapper._impl)) {
					const value = wrapper._impl[prop];
					return value;
				}
				return wrapper._createWaitingProxy([prop]);
			}

			// If _impl is a custom Proxy, delegate property access directly to it
			// Custom proxies handle their own property access logic (array indices, computed properties, etc.)
			// Wrapping their results breaks their intended behavior
			if (wrapper._impl && typeof wrapper._impl === "object" && util.types.isProxy(wrapper._impl)) {
				const value = wrapper._impl[prop];
				// Return the value directly - don't wrap it
				// This preserves custom proxy behavior for array access, computed properties, etc.
				return value;
			}

			// Check if the property exists on impl before caching
			// This handles property descriptors (getters) correctly
			let value = wrapper._impl ? wrapper._impl[prop] : undefined;

			// If value is undefined, check if it's a getter on the impl
			if (value === undefined && wrapper._impl) {
				const descriptor = Object.getOwnPropertyDescriptor(wrapper._impl, prop);
				if (descriptor && descriptor.get) {
					// It's a getter - call it to get the actual value
					value = descriptor.get.call(wrapper._impl);
				}
			}
			if (value === undefined && Object.prototype.hasOwnProperty.call(target, prop)) {
				value = target[prop];
			}

			if (value === undefined) {
				return undefined;
			}

			// Return primitives directly without wrapping
			// Primitives: string, number, boolean, bigint, symbol, null
			const valueType = typeof value;
			if (
				value === null ||
				valueType === "string" ||
				valueType === "number" ||
				valueType === "boolean" ||
				valueType === "bigint" ||
				valueType === "symbol"
			) {
				return value;
			}

			// Return built-in objects that require proper 'this' binding directly without wrapping
			// These include: Map, Set, WeakMap, WeakSet, Date, RegExp, Promise, Error, TypedArrays
			if (
				value instanceof Map ||
				value instanceof Set ||
				value instanceof WeakMap ||
				value instanceof WeakSet ||
				value instanceof Date ||
				value instanceof RegExp ||
				value instanceof Promise ||
				value instanceof Error ||
				ArrayBuffer.isView(value) ||
				value instanceof ArrayBuffer
			) {
				return value;
			}

			// Return custom Proxy objects directly without wrapping
			// Custom proxies (like LGTVControllers) need direct access for array indices and special get traps
			// Wrapping them breaks array access patterns like proxy[0]
			if (value && typeof value === "object" && util.types.isProxy(value)) {
				return value;
			}

			if (value && (typeof value === "object" || typeof value === "function") && (value.__wrapper || value.__getState)) {
				return value;
			}

			const wrapped = wrapper._createChildWrapper(prop, value);
			if (wrapped) {
				Object.defineProperty(wrapper._proxyTarget, prop, {
					value: wrapped,
					writable: false,
					enumerable: true,
					configurable: true
				});
				return wrapped;
			}

			return value;
		};

		/**
		 * @private
		 * @param {Object} target - Proxy target
		 * @param {Object} thisArg - Call receiver
		 * @param {Array} args - Call arguments
		 * @returns {unknown} Call result
		 *
		 * @description
		 * Invokes the underlying impl with context binding when callable.
		 * Integrates hook execution (before/after/always/error) synchronously.
		 * Follows V2 pattern: hooks execute synchronously, async handling via Promise.then().
		 */
		const applyTrap = (target, thisArg, args) => {
			if (wrapper._invalid) {
				throw new TypeError(`${wrapper.apiPath || "api"} is invalidated`);
			}

			// Get hook manager if available
			const hookManager = wrapper.slothlet.handlers?.hookManager;
			// Early exit if hooks disabled globally or this is a hook API function
			const hasHooks = hookManager && hookManager.enabled && !wrapper.apiPath.startsWith("slothlet.hook");

			// Get api (bound API) and ctx (user context) for hooks
			const api = wrapper.slothlet.boundApi;
			const ctx = wrapper.slothlet.config?.context || {};

			// Declare variables outside try-catch-finally so they're accessible in all blocks
			let result;
			let finalResult;
			let isAsync = false; // Track if we're dealing with a promise

			try {
				// Execute before hooks synchronously
				if (hasHooks) {
					const beforeResult = hookManager.executeBeforeHooks(wrapper.apiPath, args, api, ctx);
					args = beforeResult.args;

					// Check for short-circuit
					if (beforeResult.shortCircuit) {
						// Set finalResult so finally block can call always hooks with correct value
						finalResult = beforeResult.value;
						return beforeResult.value;
					}
				}

				// Materialize if needed (lazy mode)
				if (wrapper.mode === "lazy" && !wrapper._state.materialized && !wrapper._state.inFlight) {
					wrapper._materialize();
				}

				// Wait for materialization if in flight (returns Promise)
				if (wrapper.mode === "lazy" && wrapper._state.inFlight) {
					return new Promise((resolve, reject) => {
						const checkMaterialized = () => {
							if (wrapper._state.materialized) {
								const impl = wrapper._impl;
								if (typeof impl === "function") {
									if (wrapper.slothlet.contextManager) {
										resolve(wrapper.slothlet.contextManager.runInContext(wrapper.instanceID, impl, thisArg, args, wrapper));
									} else {
										resolve(impl.apply(thisArg, args));
									}
								} else if (impl && typeof impl === "object" && typeof impl.default === "function") {
									if (wrapper.contextManager) {
										resolve(wrapper.contextManager.runInContext(wrapper.instanceID, impl.default, impl, args, wrapper));
									} else {
										resolve(impl.default.apply(impl, args));
									}
								} else {
									reject(
										new wrapper.slothlet.SlothletError(
											"INVALID_CONFIG_NOT_A_FUNCTION",
											{
												apiPath: wrapper.apiPath,
												actualType: typeof impl
											},
											null,
											{ validationError: true }
										)
									);
								}
								return;
							}
							if (!wrapper._state.inFlight) {
								reject(
									new wrapper.slothlet.SlothletError("INVALID_CONFIG_LAZY_MATERIALIZATION_FAILED", { apiPath: wrapper.apiPath }, null, {
										validationError: true
									})
								);
								return;
							}
							setImmediate(checkMaterialized);
						};
						checkMaterialized();
					});
				}

				// Execute the actual function
				const impl = wrapper._impl;

				if (typeof impl === "function") {
					if (wrapper.slothlet.contextManager) {
						result = wrapper.slothlet.contextManager.runInContext(wrapper.instanceID, impl, thisArg, args, wrapper);
					} else {
						result = impl.apply(thisArg, args);
					}
				} else if (impl && typeof impl === "object" && typeof impl.default === "function") {
					if (wrapper.slothlet.contextManager) {
						result = wrapper.slothlet.contextManager.runInContext(wrapper.instanceID, impl.default, impl, args, wrapper);
					} else {
						result = impl.default.apply(impl, args);
					}
				} else {
					throw new wrapper.SlothletError(
						"INVALID_CONFIG_NOT_A_FUNCTION",
						{
							apiPath: wrapper.apiPath,
							actualType: typeof impl
						},
						null,
						{ validationError: true }
					);
				}

				// Check if result is a Promise (async function)
				if (result && typeof result === "object" && typeof result.then === "function") {
					// Mark as async so finally block skips always hooks (we handle them in the promise chain)
					isAsync = true;
					// Async result - attach hooks to Promise chain
					return result.then(
						(resolvedResult) => {
							try {
								// Execute after hooks synchronously with resolved value
								if (hasHooks) {
									const afterResult = hookManager.executeAfterHooks(wrapper.apiPath, resolvedResult, args, api, ctx);
									const finalResult = afterResult.modified ? afterResult.result : resolvedResult;
									hookManager.executeAlwaysHooks(wrapper.apiPath, args, finalResult, false, [], api, ctx);
									return finalResult;
								}
								return resolvedResult;
							} catch (error) {
								// Error in after hook during async resolution
								if (hasHooks) {
									const originalError = unwrapError(error);
									const sourceInfo = {
										type: "after",
										timestamp: Date.now(),
										stack: originalError.stack
									};
									hookManager.executeErrorHooks(wrapper.apiPath, originalError, sourceInfo, args, api, ctx);
									hookManager.executeAlwaysHooks(wrapper.apiPath, args, undefined, true, [originalError], api, ctx);
								}

								// Check if errors should be suppressed
								const suppressErrors = wrapper.slothlet.config?.hook?.suppressErrors === true;
								if (suppressErrors) {
									return undefined;
								}

								throw error;
							}
						},
						(error) => {
							// Async function error
							if (hasHooks && !error[ERROR_HOOK_PROCESSED]) {
								const originalError = unwrapError(error);
								const sourceInfo = {
									type: "function",
									timestamp: Date.now(),
									stack: originalError.stack
								};
								hookManager.executeErrorHooks(wrapper.apiPath, originalError, sourceInfo, args, api, ctx);
							}
							// Always hooks execute for rejected promises
							if (hasHooks) {
								const originalError = unwrapError(error);
								hookManager.executeAlwaysHooks(wrapper.apiPath, args, undefined, true, [originalError], api, ctx);
							}

							// Check if errors should be suppressed
							const suppressErrors = wrapper.slothlet.config?.hook?.suppressErrors === true;
							if (suppressErrors) {
								return undefined;
							}

							throw error;
						}
					);
				}

				// Sync result - execute after hooks (can modify result)
				finalResult = result;
				if (hasHooks) {
					const afterResult = hookManager.executeAfterHooks(wrapper.apiPath, result, args, api, ctx);
					if (afterResult.modified) {
						finalResult = afterResult.result;
					}
				}
				return finalResult;
			} catch (error) {
				// Synchronous error (from before hook or function)
				this.lastSyncError = error; // Flag for finally block
				if (hasHooks && !error[ERROR_HOOK_PROCESSED]) {
					const originalError = unwrapError(error);
					const sourceInfo = {
						type: "function",
						timestamp: Date.now(),
						stack: originalError.stack
					};
					hookManager.executeErrorHooks(wrapper.apiPath, originalError, sourceInfo, args, api, ctx);
				}

				// Check if errors should be suppressed
				const suppressErrors = wrapper.slothlet.config?.hook?.suppressErrors === true;
				if (suppressErrors) {
					// Don't throw - return undefined after always hooks run
					return undefined;
				}

				throw error;
			} finally {
				// Always hooks execute once for synchronous code paths
				// (async paths handle always hooks in their promise chains)
				// Skip only if we're dealing with an async result (promise)
				if (hasHooks && !isAsync) {
					// Track error state with a flag set in catch block
					const syncError = this.lastSyncError;
					this.lastSyncError = null;
					// Use finalResult if available (successful sync call), undefined if error
					const resultValue = syncError ? undefined : typeof finalResult !== "undefined" ? finalResult : result;
					const errors = syncError ? [unwrapError(syncError)] : [];
					hookManager.executeAlwaysHooks(wrapper.apiPath, args, resultValue, !!syncError, errors, api, ctx);
				}
			}
		};

		/**
		 * @private
		 * @param {Object} target - Proxy target
		 * @param {string|symbol} prop - Property name
		 * @returns {boolean} True if property exists
		 *
		 * @description
		 * Checks for properties on impl, target, and _proxyTarget.
		 */
		const hasTrap = (target, prop) => {
			if (
				prop === "__impl" ||
				prop === "__setImpl" ||
				prop === "__getState" ||
				prop === "__materialize" ||
				prop === "__invalidate" ||
				prop === "__wrapper"
			) {
				return true;
			}

			if (wrapper.mode === "lazy" && !wrapper._state.materialized && !wrapper._state.inFlight) {
				wrapper._materialize();
			}

			if (prop in wrapper._proxyTarget && prop !== "__wrapper") {
				return true;
			}

			if (wrapper._impl && (typeof wrapper._impl === "object" || typeof wrapper._impl === "function") && prop in wrapper._impl) {
				return true;
			}

			return Object.prototype.hasOwnProperty.call(target, prop);
		};

		/**
		 * @private
		 * @param {Object} target - Proxy target
		 * @param {string|symbol} prop - Property name
		 * @returns {PropertyDescriptor|undefined} Descriptor for the property
		 *
		 * @description
		 * Provides descriptors for target, impl, and _proxyTarget properties.
		 */
		const getOwnPropertyDescriptorTrap = (target, prop) => {
			if (wrapper.mode === "lazy" && !wrapper._state.materialized && !wrapper._state.inFlight) {
				wrapper._materialize();
			}

			if (prop === "__wrapper") {
				return {
					configurable: true,
					enumerable: false,
					value: wrapper,
					writable: false
				};
			}

			if (prop === "prototype" && typeof target === "function") {
				const desc = Object.getOwnPropertyDescriptor(target, "prototype");
				// Only return descriptor if property actually exists
				if (desc) {
					return desc;
				}
			}

			if (Object.prototype.hasOwnProperty.call(target, prop)) {
				return Object.getOwnPropertyDescriptor(target, prop);
			}

			if (prop in wrapper._proxyTarget && prop !== "__wrapper") {
				const desc = Object.getOwnPropertyDescriptor(wrapper._proxyTarget, prop);
				// Return descriptor if it exists
				if (desc) {
					return desc;
				}
			}

			if (wrapper._impl && (typeof wrapper._impl === "object" || typeof wrapper._impl === "function") && prop in wrapper._impl) {
				return Object.getOwnPropertyDescriptor(wrapper._impl, prop);
			}

			return undefined;
		};

		/**
		 * @private
		 * @param {Object} target - Proxy target
		 * @returns {Array<string|symbol>} Property keys
		 *
		 * @description
		 * Returns property keys from target, impl, and _proxyTarget.
		 */
		const ownKeysTrap = (target) => {
			if (wrapper.mode === "lazy" && !wrapper._state.materialized && !wrapper._state.inFlight) {
				wrapper._materialize();
			}

			const keys = new Set(Reflect.ownKeys(target));
			const implKeys =
				wrapper._impl && (typeof wrapper._impl === "object" || typeof wrapper._impl === "function") ? Reflect.ownKeys(wrapper._impl) : [];
			for (const key of implKeys) {
				// Skip 'prototype' from impl - it causes descriptor invariant violations
				if (key !== "prototype") {
					keys.add(key);
				}
			}
			const proxyTargetKeys = Reflect.ownKeys(wrapper._proxyTarget);
			for (const key of proxyTargetKeys) {
				if (key !== "__wrapper") {
					keys.add(key);
				}
			}
			keys.delete("__wrapper");

			return Array.from(keys);
		};

		/**
		 * @private
		 * @param {Object} target - Proxy target
		 * @param {string|symbol} prop - Property name
		 * @param {unknown} value - Value to assign
		 * @returns {boolean} True when set succeeds
		 *
		 * @description
		 * Allows attaching properties directly to callable proxies.
		 */
		const setTrap = (target, prop, value) => {
			if (wrapper.mode === "lazy" && !wrapper._state.materialized && !wrapper._state.inFlight) {
				wrapper._materialize();
			}
			const internalKeys = new Set(["__impl", "__setImpl", "__getState", "__materialize", "__invalidate", "_impl", "_state", "_invalid"]);
			if (!internalKeys.has(prop)) {
				// Delete property first if it exists (to allow reassignment)
				if (prop in wrapper._proxyTarget) {
					delete wrapper._proxyTarget[prop];
				}
				Object.defineProperty(wrapper._proxyTarget, prop, {
					value: value,
					writable: false,
					enumerable: true,
					configurable: true
				});
			} else {
				// For internal properties, just assign directly
				target[prop] = value;
			}
			return true;
		};

		/**
		 * @private
		 * @param {Object} target - Proxy target
		 * @param {string|symbol} prop - Property name to delete
		 * @returns {boolean} True when deletion succeeds
		 *
		 * @description
		 * Handles property deletion from wrapper proxies, removing from _proxyTarget and impl.
		 */
		const deletePropertyTrap = (target, prop) => {
			// Don't materialize when deleting - just delete directly
			// If lazy wrapper hasn't materialized yet, that's fine - we're deleting it anyway
			// if (wrapper.mode === "lazy" && !wrapper._state.materialized && !wrapper._state.inFlight) {
			// 	wrapper._materialize();
			// }

			// Don't allow deletion of internal properties
			const internalKeys = new Set([
				"__impl",
				"__setImpl",
				"__getState",
				"__materialize",
				"__invalidate",
				"__wrapper",
				"__metadata",
				"_impl",
				"_state",
				"_invalid"
			]);
			if (internalKeys.has(prop)) {
				return false;
			}

			// If deleting a child wrapper, invalidate it
			if (prop in wrapper._proxyTarget && prop !== "__wrapper") {
				const childWrapper = wrapper._proxyTarget[prop];
				if (childWrapper && childWrapper.__invalidate) {
					childWrapper.__invalidate();
				}
				const descriptor = Object.getOwnPropertyDescriptor(wrapper._proxyTarget, prop);
				if (descriptor?.configurable) {
					delete wrapper._proxyTarget[prop];
				}
			}

			// Remove from _impl if it's an object
			if (wrapper._impl && typeof wrapper._impl === "object" && prop in wrapper._impl) {
				delete wrapper._impl[prop];
			}

			// Remove from proxy target
			delete target[prop];

			return true;
		};

		wrapper._proxy = new Proxy(proxyTarget, {
			get: getTrap,
			apply: applyTrap,
			has: hasTrap,
			getOwnPropertyDescriptor: getOwnPropertyDescriptorTrap,
			ownKeys: ownKeysTrap,
			set: setTrap,
			deleteProperty: deletePropertyTrap
		});

		return wrapper._proxy;
	}
}
