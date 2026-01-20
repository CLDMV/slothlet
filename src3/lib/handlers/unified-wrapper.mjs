/**
 * @fileoverview Unified wrapper - combines __impl pattern, lazy/eager modes, materialization, and context binding
 * @module @cldmv/slothlet/handlers/unified-wrapper
 */
import { SlothletError } from "@cldmv/slothlet/errors";

const wrapperDebugEnabled =
	process.env.SLOTHLET_DEBUG_WRAPPER === "1" ||
	process.env.SLOTHLET_DEBUG_WRAPPER === "true" ||
	process.env.SLOTHLET_DEBUG_SCRIPT_VERBOSE === "1" ||
	process.env.SLOTHLET_DEBUG_SCRIPT_VERBOSE === "true";

/**
 * Unified wrapper class that handles all proxy concerns in one place:
 * - __impl pattern for reload support
 * - Lazy/eager mode materialization
 * - Recursive waiting proxy for deep lazy loading
 * - Context binding through contextManager
 *
 * @class
 * @public
 */
export class UnifiedWrapper {
	/**
	 * @param {Object} options - Configuration options
	 * @param {string} options.mode - "lazy" or "eager"
	 * @param {string} options.apiPath - API path for this wrapper (e.g., "math.advanced.calc")
	 * @param {Object} options.contextManager - Context manager for AsyncLocalStorage binding
	 * @param {string} options.instanceID - Slothlet instance ID
	 * @param {Object} [options.initialImpl=null] - Initial implementation (null for lazy mode)
	 * @param {Function} [options.materializeFunc=null] - Async function to materialize lazy modules
	 * @param {Object} [options.ownership=null] - Ownership manager
	 * @param {boolean} [options.isCallable=false] - Whether the wrapper should be callable
	 *
	 * @description
	 * Creates a unified wrapper instance for a specific API path.
	 *
	 * @example
	 * const wrapper = new UnifiedWrapper({
	 * 	mode: "lazy",
	 * 	apiPath: "math",
	 * 	contextManager,
	 * 	instanceID
	 * });
	 */
	constructor({ mode, apiPath, contextManager, instanceID, initialImpl = null, materializeFunc = null, ownership = null, isCallable }) {
		this.mode = mode;
		this.apiPath = apiPath;
		this.contextManager = contextManager;
		this.instanceID = instanceID;
		this.isCallable =
			typeof isCallable === "boolean"
				? isCallable
				: typeof initialImpl === "function" || (initialImpl && typeof initialImpl.default === "function");
		this._childCache = new Map();
		this._proxy = null;
		this._invalid = false;
		this._impl = initialImpl;
		this._state = {
			materialized: initialImpl !== null,
			inFlight: false
		};
		this._materializeFunc = materializeFunc;
		this.ownership = ownership;
		if (initialImpl !== null) {
			this._adoptImplChildren();
		}
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
		if (wrapperDebugEnabled && this.apiPath === "string") {
			console.log(`[__setImpl] apiPath=${this.apiPath}, newImpl keys=${Object.keys(newImpl || {}).join(",")}`);
		}
		this._impl = newImpl;
		if (typeof newImpl === "function" || (newImpl && typeof newImpl.default === "function")) {
			this.isCallable = true;
		}
		this._invalid = false;
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

		if (wrapperDebugEnabled && this.apiPath === "string") {
			console.log(`[_materialize] START for apiPath=${this.apiPath}`);
		}

		this._state.inFlight = true;

		try {
			if (this._materializeFunc) {
				if (wrapperDebugEnabled && this.apiPath === "string") {
					console.log(`[_materialize] Calling materializeFunc (no args, expects return value)...`);
				}
				// POC pattern: materializeFunc returns the implementation
				const result = await this._materializeFunc();
				this._impl = result;
				this._invalid = false;
				this._adoptImplChildren();
				this._state.materialized = true;
				this._state.inFlight = false;
				if (wrapperDebugEnabled && this.apiPath === "string") {
					console.log(
						`[_materialize] DONE! result=${typeof result}, result keys=${result ? Object.keys(result).join(",") : "null"}, impl keys=${this._impl ? Object.keys(this._impl).join(",") : "null"}`
					);
				}
			}
		} catch (error) {
			if (wrapperDebugEnabled && this.apiPath === "string") {
				console.log(`[_materialize] ERROR: ${error.message}`);
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

		const nestedWrapper = new UnifiedWrapper({
			mode: "eager",
			apiPath: this.apiPath ? `${this.apiPath}.${String(key)}` : String(key),
			contextManager: this.contextManager,
			instanceID: this.instanceID,
			initialImpl: childImpl,
			ownership: this.ownership,
			isCallable: typeof childImpl === "function"
		});
		return nestedWrapper.createProxy();
	}

	/**
	 * Create recursive waiting proxy for deep lazy loading
	 * Builds property chain (e.g., ["advanced", "calc", "power"]) and waits for all parent
	 * wrappers to materialize before accessing the final property.
	 *
	 * @param {Array<string|symbol>} propChain - Property chain being built
	 * @returns {Proxy} Waiting proxy that chains property access
	 * @private
	 */
	/**
	 * Create a waiting proxy that resolves a property chain after lazy materialization.
	 * @private
	 * @param {Array<string|symbol>} [propChain=[]] - Property chain to resolve.
	 * @returns {Proxy} Proxy that waits for materialization before applying calls.
	 */
	_createWaitingProxy(propChain = []) {
		const wrapper = this;
		const waitingTarget = function waitingProxyTarget() {};

		return new Proxy(waitingTarget, {
			get(___target, prop) {
				if (prop === "then") return undefined;
				if (typeof prop === "symbol") return undefined;
				if (prop === "length") return 0;
				if (prop === "name") return "unifiedWrapperProxy";
				if (prop === "toString") return Function.prototype.toString.bind(waitingTarget);
				if (prop === "valueOf") return Function.prototype.valueOf.bind(waitingTarget);
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

		const isCallable = wrapper.mode === "lazy" || typeof wrapper._impl === "function" || wrapper.isCallable;
		const proxyTarget = isCallable ? function unifiedWrapperProxy() {} : {};
		proxyTarget.__wrapper = wrapper;

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
			if (prop === "__getState") return wrapper.__getState.bind(wrapper);
			if (prop === "__setImpl") return wrapper.__setImpl.bind(wrapper);
			if (prop === "__materialize") return wrapper.__materialize.bind(wrapper);
			if (prop === "__invalidate") return wrapper.__invalidate.bind(wrapper);
			if (prop === "__slothletPath") return wrapper.apiPath;
			if (prop === "__wrapper") return wrapper;
			if (prop === "_impl") return wrapper._impl;
			if (prop === "_state") return wrapper._state;
			if (prop === "_invalid") return wrapper._invalid;
			if (prop === "then") return undefined;
			if (prop === "constructor") return Object.prototype.constructor;
			if (typeof prop === "symbol") return undefined;
			if (prop === "length") return 0;
			if (prop === "name") return "unifiedWrapperProxy";
			if (prop === "toString") return Function.prototype.toString.bind(target);
			if (prop === "valueOf") return Function.prototype.valueOf.bind(target);

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
								if (wrapper.contextManager) {
									resolve(wrapper.contextManager.runInContext(wrapper.instanceID, impl, thisArg, args));
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
								new SlothletError(
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
								new SlothletError("INVALID_CONFIG_LAZY_MATERIALIZATION_FAILED", { apiPath: wrapper.apiPath }, null, {
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
				if (wrapper.contextManager) {
					return wrapper.contextManager.runInContext(wrapper.instanceID, impl, thisArg, args);
				}
				return impl.apply(thisArg, args);
			}

			if (impl && typeof impl === "object" && typeof impl.default === "function") {
				if (wrapper.contextManager) {
					return wrapper.contextManager.runInContext(wrapper.instanceID, impl.default, impl, args);
				}
				return impl.default.apply(impl, args);
			}

			throw new SlothletError(
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

			keys.add("__impl");
			keys.add("__setImpl");
			keys.add("__getState");
			keys.add("__materialize");
			keys.add("__invalidate");

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
