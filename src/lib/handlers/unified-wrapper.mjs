/**
 * @fileoverview Unified wrapper - combines __impl pattern, lazy/eager modes, materialization, and context binding
 * @module @cldmv/slothlet/handlers/unified-wrapper
 */
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
	 * @param {string} [options.moduleId=null] - Module identifier
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
			moduleId = null,
			sourceFolder = null,
			userMetadata = {}
		}
	) {
		super(slothlet);
		this.mode = mode;
		this.apiPath = apiPath;
		this.materializeOnCreate = materializeOnCreate;
		this.isCallable =
			typeof isCallable === "boolean"
				? isCallable
				: typeof initialImpl === "function" || (initialImpl && typeof initialImpl.default === "function");
		this._childCache = new Map();
		this._proxy = null;
		this._proxyTarget = null;
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
				moduleId,
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
				moduleId,
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
				this.slothlet.debug("wrapper", {
					message: "UnifiedWrapper constructor - after adopt",
					apiPath,
					childCacheSize: this._childCache.size,
					childCacheKeySample: Array.from(this._childCache.keys()).slice(0, 5)
				});
			}
		}
	}

	/**
	 * Custom inspect output for Node.js util.inspect.
	 * @returns {string} Debug-friendly wrapper label.
	 */
	[util.inspect.custom]() {
		return this.displayName;
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
	 * @param {string} [moduleId] - Optional moduleId for lifecycle event (for replacements)
	 * @private
	 */
	__setImpl(newImpl, moduleId = null) {
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
			// Use provided moduleId (for replacements) or extract from metadata
			const extractedModuleId = moduleId || (wrapperMetadata?.moduleID ? wrapperMetadata.moduleID.split(":")[0] : null);

			this.slothlet.handlers.lifecycle.emit("impl:changed", {
				apiPath: this.apiPath,
				impl: newImpl,
				wrapper: this,
				source: "hot-reload",
				moduleId: extractedModuleId,
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
		if (this._state.inFlight || this._state.materialized) {
			return;
		}

		if ((wrapperDebugEnabled || this.config?.debug?.wrapper) && this.apiPath === "string") {
			this.slothlet.debug("wrapper", {
				message: "_materialize start",
				apiPath: this.apiPath
			});
		}

		this._state.inFlight = true;

		try {
			if (this._materializeFunc) {
				if ((wrapperDebugEnabled || this.config?.debug?.wrapper) && this.apiPath === "string") {
					this.slothlet.debug("wrapper", {
						message: "_materialize calling materializeFunc",
						apiPath: this.apiPath
					});
				}
				// POC pattern: materializeFunc returns the implementation
				const result = await this._materializeFunc();

				this._impl = result;
				this._invalid = false;
				this._adoptImplChildren();

				this._state.materialized = true;
				this._state.inFlight = false;

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
			this._state.inFlight = false;
			throw error;
		}
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
		this._childCache.clear();
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
	 * Moves child properties off the impl and into cached wrappers so this
	 * wrapper only represents the current API path.
	 *
	 * @example
	 * wrapper._adoptImplChildren();
	 */
	_adoptImplChildren() {
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

		// CRITICAL: If childCache already has entries (from collision merge), this is a MERGE scenario
		// In merge mode, we should NEVER delete existing entries - only add new ones
		const isMergeScenario = this._childCache.size > 0;

		// Add existing childCache keys to observedKeys so they don't get deleted
		for (const key of this._childCache.keys()) {
			observedKeys.add(key);
		}

		const skipKeys = typeof this._impl === "function" ? new Set(["length", "name", "prototype"]) : null;

		for (const key of ownKeys) {
			if (internalKeys.has(key)) {
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
			observedKeys.add(key);

			// CRITICAL: Check if childCache already has this key (from collision merge)
			// childCache contains RAW functions/values, not wrappers, so just check if key exists
			if (this._childCache.has(key)) {
				// Keep existing entry (don't replace) - preserves merge-mode behavior
				// CRITICAL: Remove this key from impl to prevent conflicts
				// The childCache entry takes precedence in merge mode
				if (descriptor.configurable) {
					delete this._impl[key];
				}
				continue;
			}

			const wrapped = this._createChildWrapper(key, value);
			if (wrapped) {
				this._childCache.set(key, wrapped);
				// NOTE: Do NOT set wrapped on _proxyTarget - it's a wrapper object
				// In live runtime, direct property access would return the wrapper instead of unwrapped value
				// The proxy's get trap will handle unwrapping from _childCache
				if (descriptor.configurable && !keepImplProperties) {
					delete this._impl[key];
				}
			} else if (wrapped === null) {
				// _createChildWrapper returned null, meaning this value should be stored unwrapped
				this._childCache.set(key, value);
				if (descriptor.configurable && !keepImplProperties) {
					delete this._impl[key];
				}
			}
		}

		// Only clean up unobserved keys if this is NOT a merge scenario
		// In merge mode (isMergeScenario=true), we want to keep ALL existing entries
		if (!isMergeScenario) {
			for (const key of this._childCache.keys()) {
				if (!observedKeys.has(key)) {
					const existing = this._childCache.get(key);
					if (existing && typeof existing.__invalidate === "function") {
						existing.__invalidate();
					}
					this._childCache.delete(key);
					if (this._proxyTarget && Object.prototype.hasOwnProperty.call(this._proxyTarget, key)) {
						const descriptor = Object.getOwnPropertyDescriptor(this._proxyTarget, key);
						if (descriptor?.configurable) {
							delete this._proxyTarget[key];
						}
					}
				}
			}
		}

		// Handle merge-after-materialize for lazy wrappers in merge-replace mode
		if (this._mergeAfterMaterialize) {
			const { existingWrapper, isMergeReplace } = this._mergeAfterMaterialize;

			// Now that this wrapper has materialized with its own keys,
			// add non-conflicting keys from the existing wrapper
			for (const [key, child] of existingWrapper._childCache.entries()) {
				if (!this._childCache.has(key)) {
					this._childCache.set(key, child);
					// NOTE: Do NOT set child on _proxyTarget - it's a wrapper object
					// In live runtime, direct property access would return the wrapper instead of unwrapped value
					// The proxy's get trap will handle unwrapping from _childCache
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

		// Get parent wrapper's metadata to inherit filePath and moduleId
		const parentMetadata = this.slothlet.handlers?.metadata?.getMetadata(this);

		// Try to get child's actual filePath from its own metadata first (if already tagged during materialization)
		const childExistingMetadata = this.slothlet.handlers?.metadata?.getMetadata(value);
		let childFilePath = childExistingMetadata?.filePath || null;
		let childModuleId = null;

		if (!childFilePath) {
			// No existing metadata on child - try __childFilePaths map from lazy materialization
			if (this._impl && this._impl.__childFilePaths && this._impl.__childFilePaths[key]) {
				childFilePath = this._impl.__childFilePaths[key];
			} else if (this.__childFilePathsPreMaterialize && this.__childFilePathsPreMaterialize[key]) {
				// Check pre-materialize mapping from collision merge
				childFilePath = this.__childFilePathsPreMaterialize[key];
			} else {
				// Fall back to parent's filePath (will be directory path for lazy wrappers)
				childFilePath = parentMetadata?.filePath || null;
			}

			// Extract SHORT moduleId from parent's FULL moduleID format "moduleId:apiPath"
			if (parentMetadata?.moduleID) {
				const colonIndex = parentMetadata.moduleID.indexOf(":");
				childModuleId = colonIndex > 0 ? parentMetadata.moduleID.substring(0, colonIndex) : parentMetadata.moduleID;
			}
		} else {
			// Child already has metadata - extract moduleId from it
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
			apiPath: this.apiPath ? `${this.apiPath}.${String(key)}` : String(key),
			initialImpl: childImpl,
			isCallable: typeof childImpl === "function",
			filePath: childFilePath,
			moduleId: childModuleId,
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
	 * @private
	 * @param {Array<string|symbol>} [propChain=[]] - Property chain to resolve.
	 * @returns {Proxy} Proxy that waits for materialization before applying calls.
	 */
	_createWaitingProxy(propChain = []) {
		const wrapper = this;
		const waitingTarget = createNamedProxyTarget(`${wrapper.apiPath}_waitingProxy`, "waitingProxyTarget");

		// Link waiting proxy back to wrapper so metadata can be found
		waitingTarget.__wrapper = wrapper;

		return new Proxy(waitingTarget, {
			get(___target, prop) {
				if (prop === "then") return undefined;
				if (prop === "__wrapper") return wrapper;
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
				return wrapper._createWaitingProxy([...propChain, prop]);
			},

			async apply(___target, ___thisArg, args) {
				const chainLabel = propChain.map((prop) => String(prop)).join(".");

				if (wrapper.mode === "lazy" && !wrapper._state.materialized && !wrapper._state.inFlight) {
					await wrapper._materialize();
				}

				while (wrapper._state.inFlight) {
					await new Promise((resolve) => setImmediate(resolve));
				}

				let current = wrapper.createProxy();

				for (const prop of propChain) {
					if (!current) {
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
						if (currentWrapper._childCache?.has(prop)) {
							current = currentWrapper._childCache.get(prop);
							continue;
						}
						if (currentWrapper._impl && prop in currentWrapper._impl) {
							current = currentWrapper._impl[prop];
							continue;
						}
					}

					current = current[prop];
				}

				if (typeof current === "function") {
					return current(...args);
				}

				// If current is undefined/null after traversing the chain, return undefined instead of throwing
				// This handles cases where test frameworks try to call methods that don't exist
				// during introspection/cleanup (e.g., after api.remove())
				if (current === undefined || current === null) {
					return undefined;
				}

				throw new Error(`${wrapper.apiPath}.${chainLabel} is not a function`);
			}
		});
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

		// Determine if this wrapper represents a callable (function)
		// For eager mode or materialized lazy: check actual impl
		// For unmaterialized lazy: default to function (standard lazy behavior)
		const isCallable =
			wrapper.isCallable ||
			typeof wrapper._impl === "function" ||
			(wrapper._impl && typeof wrapper._impl.default === "function") ||
			(wrapper.mode === "lazy" && !wrapper._state.materialized);

		const nameHint =
			wrapper.mode === "lazy" && !wrapper._state.materialized && wrapper.apiPath ? `${wrapper.apiPath}__lazy` : wrapper.apiPath;
		const proxyTarget = isCallable ? createNamedProxyTarget(nameHint, "unifiedWrapperProxy") : {};
		Object.defineProperty(proxyTarget, "__wrapper", {
			value: wrapper,
			writable: false,
			enumerable: false,
			configurable: true
		});
		wrapper._proxyTarget = proxyTarget;
		// NOTE: Do NOT copy _childCache entries to _proxyTarget
		// They are wrapper objects, and in live runtime direct property access would return wrappers
		// The proxy's get trap will handle unwrapping from _childCache

		/**
		 * @private
		 * @param {Object} target - Proxy target
		 * @param {string|symbol} prop - Property name
		 * @param {Object} receiver - Proxy receiver
		 * @returns {unknown} Resolved property value
		 *
		 * @description
		 * Resolves properties from cached wrappers, impl values, or target properties.
		 */
		const getTrap = (target, prop, receiver) => {
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

			if (wrapper.mode === "lazy" && (wrapper._state.inFlight || !wrapper._impl)) {
				return wrapper._createWaitingProxy([prop]);
			}

			if (wrapper._childCache.has(prop)) {
				const cached = wrapper._childCache.get(prop);
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
				// For objects and functions, return the wrapper/proxy as-is
				return cached;
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

			if (value && (typeof value === "object" || typeof value === "function") && (value.__wrapper || value.__getState)) {
				return value;
			}

			const wrapped = wrapper._createChildWrapper(prop, value);
			if (wrapped) {
				wrapper._childCache.set(prop, wrapped);
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
		 * Checks for properties on impl, target, and cached wrappers.
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

			if (wrapper._childCache.has(prop)) {
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
		 * Provides descriptors for target, impl, and cached wrapper properties.
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
				return Object.getOwnPropertyDescriptor(target, "prototype");
			}

			if (Object.prototype.hasOwnProperty.call(target, prop)) {
				return Object.getOwnPropertyDescriptor(target, prop);
			}

			if (wrapper._childCache.has(prop)) {
				return {
					configurable: true,
					enumerable: true,
					value: wrapper._childCache.get(prop),
					writable: false
				};
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
		 * Returns property keys from target, impl, and cached wrappers.
		 */
		const ownKeysTrap = (target) => {
			if (wrapper.mode === "lazy" && !wrapper._state.materialized && !wrapper._state.inFlight) {
				wrapper._materialize();
			}

			const keys = new Set(Reflect.ownKeys(target));
			const implKeys =
				wrapper._impl && (typeof wrapper._impl === "object" || typeof wrapper._impl === "function") ? Reflect.ownKeys(wrapper._impl) : [];
			for (const key of implKeys) {
				keys.add(key);
			}
			for (const key of wrapper._childCache.keys()) {
				keys.add(key);
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
				wrapper._childCache.set(prop, value);
			}
			target[prop] = value;
			return true;
		};

		wrapper._proxy = new Proxy(proxyTarget, {
			get: getTrap,
			apply: applyTrap,
			has: hasTrap,
			getOwnPropertyDescriptor: getOwnPropertyDescriptorTrap,
			ownKeys: ownKeysTrap,
			set: setTrap
		});

		return wrapper._proxy;
	}
}
