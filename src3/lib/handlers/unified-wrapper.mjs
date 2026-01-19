/**
 * @fileoverview Unified wrapper - combines __impl pattern, lazy/eager modes, materialization, and context binding
 * @module @cldmv/slothlet/handlers/unified-wrapper
 */
import { SlothletError } from "@cldmv/slothlet/errors";

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
	 * @param {string} options.instanceId - Slothlet instance ID
	 * @param {Object} [options.initialImpl=null] - Initial implementation (null for lazy mode)
	 * @param {Function} [options.materializeFunc=null] - Async function to materialize lazy modules
	 * @param {Object} [options.ownership=null] - Ownership manager
	 */
	constructor({ mode, apiPath, contextManager, instanceId, initialImpl = null, materializeFunc = null, ownership = null }) {
		this.mode = mode;
		this.apiPath = apiPath;
		this.contextManager = contextManager;
		this.instanceId = instanceId;
		this._impl = initialImpl;
		this._state = {
			materialized: initialImpl !== null,
			inFlight: false
		};
		this._materializeFunc = materializeFunc;
		this.ownership = ownership;
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
		this._impl = newImpl;
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

		this._state.inFlight = true;

		try {
			if (this._materializeFunc) {
				await this._materializeFunc(this);
			}
		} catch (error) {
			this._state.inFlight = false;
			throw error;
		}
	}

	/**
	 * Create recursive waiting proxy for deep lazy loading
	 * Builds property chain (e.g., ["advanced", "calc", "power"]) and waits for all parent
	 * wrappers to materialize before accessing the final property.
	 *
	 * @param {Array<string>} propChain - Property chain being built
	 * @returns {Proxy} Waiting proxy that chains property access
	 * @private
	 */
	_createWaitingProxy(propChain = []) {
		const self = this;

		return new Proxy(function waitingProxy() {}, {
			get(___target, prop) {
				// Build deeper chain
				return self._createWaitingProxy([...propChain, prop]);
			},

			async apply(___target, thisArg, args) {
				// Wait for parent to materialize
				while (!self._state.materialized && self._state.inFlight) {
					await new Promise((resolve) => setTimeout(resolve, 10));
				}

				if (!self._state.materialized) {
					await self._materialize();
				}

				// Traverse property chain, triggering nested wrapper materializations
				let current = self._impl;
				for (const key of propChain) {
					// Check if current is a UnifiedWrapper
					if (current && typeof current === "object" && current.__getState) {
						const state = current.__getState();
						if (!state.materialized) {
							// Trigger nested materialization
							await current._materialize();
						}
						// Access __impl after materialization
						current = current.__impl ? current.__impl[key] : current[key];
					} else {
						// Regular object property access
						current = current ? current[key] : undefined;
					}
				}

				// Wrap final function with context if we have a context manager
				if (typeof current === "function" && self.contextManager) {
					return self.contextManager.runInContext(self.instanceId, current, thisArg, args);
				}

				// Not a function - error
				if (typeof current !== "function") {
					throw new SlothletError(
						"INVALID_CONFIG_NOT_A_FUNCTION",
						{
							apiPath: `${self.apiPath}.${propChain.join(".")}`,
							actualType: typeof current
						},
						null,
						{ validationError: true }
					);
				}

				return current(...args);
			}
		});
	}

	/**
	 * Wrap function with context manager
	 * @param {Function} fn - Function to wrap
	 * @param {string} fnPath - Full API path for this function
	 * @returns {Function} Wrapped function
	 * @private
	 */
	_wrapFunction(fn, fnPath) {
		if (!this.contextManager) {
			return fn;
		}

		const self = this;
		const wrapped = function slothlet_wrapped(...args) {
			return self.contextManager.runInContext(self.instanceId, fn, this, args);
		};

		// Preserve metadata
		Object.defineProperty(wrapped, "name", {
			value: fn.name || "anonymous",
			configurable: true
		});

		wrapped.__slothletPath = fnPath;
		wrapped.__slothletOriginal = fn;
		wrapped.__slothletInstanceId = this.instanceId;

		// Copy function properties (for functions with methods)
		for (const key of Object.keys(fn)) {
			if (key !== "name" && key !== "length") {
				const value = fn[key];
				if (typeof value === "function") {
					wrapped[key] = this._wrapFunction(value, `${fnPath}.${key}`);
				} else {
					wrapped[key] = value;
				}
			}
		}

		return wrapped;
	}

	/**
	 * Check if a value is a plain object (not array, not null, not special object)
	 * @param {*} obj - Value to check
	 * @returns {boolean} True if plain object
	 * @private
	 */
	_isPlainObject(obj) {
		if (!obj || typeof obj !== "object" || Array.isArray(obj)) {
			return false;
		}
		const proto = Object.getPrototypeOf(obj);
		return proto === Object.prototype || proto === null;
	}

	/**
	 * Create main proxy for this wrapper
	 * Handles lazy/eager mode logic, property access, and context binding
	 *
	 * @returns {Proxy} Main proxy for API
	 * @public
	 */
	createProxy() {
		const self = this;

		// Always use a function as target so the proxy remains callable and property access works correctly
		// We'll handle typeof checks through Symbol.toStringTag
		const target = function unifiedWrapperProxy() {};

		// Attach wrapper reference so we can access it from traps
		target.__wrapper = self;

		return new Proxy(target, {
			get(target, prop, ___receiver) {
				const wrapper = target.__wrapper;

				// Special properties - return directly from wrapper
				if (prop === "__impl") return wrapper._impl;
				if (prop === "__getState") return () => wrapper.__getState();
				if (prop === "__setImpl") return (impl) => wrapper.__setImpl(impl);
				if (prop === "__slothletPath") return wrapper.apiPath;
				if (prop === "__wrapper") return wrapper;
				if (prop === "then") return undefined; // Not a thenable
				if (prop === "constructor") return Object.prototype.constructor;

				// LAZY MODE: Trigger materialization on first property access
				if (wrapper.mode === "lazy" && !wrapper._state.materialized && !wrapper._state.inFlight) {
					wrapper._materialize();
				}

				// LAZY MODE: Return waiting proxy if materialization in progress
				if (wrapper.mode === "lazy" && wrapper._state.inFlight) {
					return wrapper._createWaitingProxy([prop]);
				}

				// Check ownership for dynamic updates (add/remove API)
				let value;
				if (wrapper.ownership) {
					const fullPath = `${wrapper.apiPath}.${String(prop)}`;
					value = wrapper.ownership.getCurrentValue(fullPath);
				}

				// Check target directly for attached properties (e.g., logger.utils from other files)
				if (value === undefined && target[prop] !== undefined) {
					value = target[prop];
				}

				// Fall back to __impl if ownership doesn't have it
				if (value === undefined && wrapper._impl) {
					value = wrapper._impl[prop];
				}

				// Return undefined if property doesn't exist
				if (value === undefined) {
					return undefined;
				}

				// Don't wrap UnifiedWrapper proxies - return them directly
				// Check for __wrapper (proxy) or __getState (raw wrapper)
				// Functions are typeof "function", not "object", so check both
				if (value && (typeof value === "object" || typeof value === "function") && (value.__wrapper || value.__getState)) {
					return value;
				}

				// Wrap functions with context
				if (typeof value === "function") {
					return wrapper._wrapFunction(value, `${wrapper.apiPath}.${String(prop)}`);
				}

				// EAGER MODE: Wrap plain objects recursively
				// LAZY MODE: Return lazy wrappers as-is (already wrapped during materialization)
				if (wrapper.mode === "eager" && wrapper._isPlainObject(value)) {
					// Create eager wrapper for nested object
					const nestedWrapper = new UnifiedWrapper({
						mode: "eager",
						apiPath: `${wrapper.apiPath}.${String(prop)}`,
						contextManager: wrapper.contextManager,
						instanceId: wrapper.instanceId,
						initialImpl: value,
						ownership: wrapper.ownership
					});
					return nestedWrapper.createProxy();
				}

				// Return primitives, arrays, and other objects as-is
				return value;
			},

			apply(target, thisArg, args) {
				const wrapper = target.__wrapper;

				// LAZY MODE: Trigger materialization if not materialized
				if (wrapper.mode === "lazy" && !wrapper._state.materialized && !wrapper._state.inFlight) {
					wrapper._materialize();
				}

				// LAZY MODE: Return promise if materializing
				if (wrapper.mode === "lazy" && !wrapper._state.materialized) {
					return new Promise((resolve, reject) => {
						const checkMaterialized = () => {
							if (wrapper._state.materialized) {
								const impl = wrapper._impl;
								if (typeof impl === "function") {
									// Wrap with context
									if (wrapper.contextManager) {
										resolve(wrapper.contextManager.runInContext(wrapper.instanceId, impl, thisArg, args));
									} else {
										resolve(impl.apply(thisArg, args));
									}
								} else if (impl && typeof impl === "object" && typeof impl.default === "function") {
									// Object with default method
									if (wrapper.contextManager) {
										resolve(wrapper.contextManager.runInContext(wrapper.instanceId, impl.default, impl, args));
									} else {
										resolve(impl.default.apply(impl, args));
									}
								} else {
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
								}
							} else if (!wrapper._state.inFlight) {
								reject(
									new SlothletError("INVALID_CONFIG_LAZY_MATERIALIZATION_FAILED", { apiPath: wrapper.apiPath }, null, {
										validationError: true
									})
								);
							} else {
								setImmediate(checkMaterialized);
							}
						};
						checkMaterialized();
					});
				}

				// EAGER MODE or LAZY MODE (materialized): Call function directly
				const impl = wrapper._impl;
				if (typeof impl === "function") {
					// Wrap with context
					if (wrapper.contextManager) {
						return wrapper.contextManager.runInContext(wrapper.instanceId, impl, thisArg, args);
					}
					return impl.apply(thisArg, args);
				}

				// Check if impl is an object with a 'default' method
				if (impl && typeof impl === "object" && typeof impl.default === "function") {
					// Call the default method
					if (wrapper.contextManager) {
						return wrapper.contextManager.runInContext(wrapper.instanceId, impl.default, impl, args);
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
			},

			has(target, prop) {
				const wrapper = target.__wrapper;

				// Trigger materialization if needed
				if (wrapper.mode === "lazy" && !wrapper._state.materialized && !wrapper._state.inFlight) {
					wrapper._materialize();
				}

				if (!wrapper._impl) return false;
				return prop in wrapper._impl;
			},

			ownKeys(target) {
				const wrapper = target.__wrapper;

				// Trigger materialization if needed
				if (wrapper.mode === "lazy" && !wrapper._state.materialized && !wrapper._state.inFlight) {
					wrapper._materialize();
				}

				const implKeys = wrapper._impl ? Object.keys(wrapper._impl) : [];
				const targetKeys = Object.getOwnPropertyNames(target);
				return [...new Set([...implKeys, ...targetKeys])];
			}
		});
	}
}
