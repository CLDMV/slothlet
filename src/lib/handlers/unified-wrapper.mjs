/**
 * @fileoverview Unified wrapper - combines __impl pattern, lazy/eager modes, materialization, and context binding
 * @module @cldmv/slothlet/handlers/unified-wrapper
 */
import util from "node:util";
import { ComponentBase } from "@cldmv/slothlet/factories/component-base";

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

		// Tag wrapper with system metadata immediately
		if (filePath && slothlet.handlers?.metadata) {
			slothlet.handlers.metadata.tagSystemMetadata(this, {
				filePath,
				apiPath,
				moduleId,
				sourceFolder: sourceFolder || slothlet.config?.dir
			});
		}

		// For eager mode with initial impl, also tag the impl
		if (initialImpl !== null && filePath && slothlet.handlers?.metadata) {
			slothlet.handlers.metadata.tagSystemMetadata(initialImpl, {
				filePath,
				apiPath,
				moduleId,
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
	 * Set implementation (for materialization or reload)
	 * @param {Object} newImpl - New implementation
	 * @public
	 */
	__setImpl(newImpl) {
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

		// Update metadata for new impl
		if (newImpl && this.slothlet.handlers?.metadata) {
			const wrapperMetadata = this.slothlet.handlers.metadata.getMetadata(this);
			if (wrapperMetadata && wrapperMetadata.filePath) {
				this.slothlet.handlers.metadata.tagSystemMetadata(newImpl, {
					filePath: wrapperMetadata.filePath,
					apiPath: this.apiPath,
					moduleId: wrapperMetadata.moduleId,
					sourceFolder: wrapperMetadata.sourceFolder
				});
			}
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
			const existing = this._childCache.get(key);
			if (existing && typeof existing.__setImpl === "function") {
				existing.__setImpl(value);
				if (descriptor.configurable && !keepImplProperties) {
					delete this._impl[key];
				}
				continue;
			}

			const wrapped = this._createChildWrapper(key, value);
			if (wrapped) {
				this._childCache.set(key, wrapped);
				if (this._proxyTarget && (typeof key === "string" || typeof key === "symbol")) {
					this._proxyTarget[key] = wrapped;
				}
				if (descriptor.configurable && !keepImplProperties) {
					delete this._impl[key];
				}
			}
		}

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
		const childFilePath = parentMetadata?.filePath || null;
		const childSourceFolder = parentMetadata?.sourceFolder || null;

		// Inherit user metadata from parent wrapper
		const childUserMetadata = this._userMetadata || {};

		// Extract SHORT moduleId from FULL moduleID format "moduleId:apiPath"
		let childModuleId = null;
		if (parentMetadata?.moduleID) {
			const colonIndex = parentMetadata.moduleID.indexOf(":");
			childModuleId = colonIndex > 0 ? parentMetadata.moduleID.substring(0, colonIndex) : parentMetadata.moduleID;
		}

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
		for (const [key, value] of wrapper._childCache.entries()) {
			if (typeof key === "string" || typeof key === "symbol") {
				proxyTarget[key] = value;
			}
		}

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
				return wrapper._childCache.get(prop);
			}

			let value = wrapper._impl ? wrapper._impl[prop] : undefined;
			if (value === undefined && Object.prototype.hasOwnProperty.call(target, prop)) {
				value = target[prop];
			}

			if (value === undefined) {
				return undefined;
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
		 */
		const applyTrap = (target, thisArg, args) => {
			if (wrapper._invalid) {
				throw new TypeError(`${wrapper.apiPath || "api"} is invalidated`);
			}

			if (wrapper.mode === "lazy" && !wrapper._state.materialized && !wrapper._state.inFlight) {
				wrapper._materialize();
			}

			if (wrapper.mode === "lazy" && wrapper._state.inFlight) {
				return new Promise((resolve, reject) => {
					const checkMaterialized = () => {
						if (wrapper._state.materialized) {
							const impl = wrapper._impl;
							if (typeof impl === "function") {
								if (wrapper.slothlet.contextManager) {
									resolve(wrapper.slothlet.contextManager.runInContext(wrapper.instanceID, impl, thisArg, args));
								} else {
									resolve(impl.apply(thisArg, args));
								}
								return;
							}
							if (impl && typeof impl === "object" && typeof impl.default === "function") {
								if (wrapper.contextManager) {
									resolve(wrapper.contextManager.runInContext(wrapper.instanceID, impl.default, impl, args));
								} else {
									resolve(impl.default.apply(impl, args));
								}
								return;
							}
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

			const impl = wrapper._impl;
			if (typeof impl === "function") {
				if (wrapper.slothlet.contextManager) {
					return wrapper.slothlet.contextManager.runInContext(wrapper.instanceID, impl, thisArg, args, wrapper);
				}
				return impl.apply(thisArg, args);
			}

			if (impl && typeof impl === "object" && typeof impl.default === "function") {
				if (wrapper.slothlet.contextManager) {
					return wrapper.slothlet.contextManager.runInContext(wrapper.instanceID, impl.default, impl, args, wrapper);
				}
				return impl.default.apply(impl, args);
			}

			throw new wrapper.SlothletError(
				"INVALID_CONFIG_NOT_A_FUNCTION",
				{
					apiPath: wrapper.apiPath,
					actualType: typeof impl
				},
				null,
				{ validationError: true }
			);
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
			if (prop === "__impl" || prop === "__setImpl" || prop === "__getState" || prop === "__materialize" || prop === "__invalidate") {
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
