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
	 * @param {string} options.instanceID - Slothlet instance ID
	 * @param {Object} [options.initialImpl=null] - Initial implementation (null for lazy mode)
	 * @param {Function} [options.materializeFunc=null] - Async function to materialize lazy modules
	 * @param {Object} [options.ownership=null] - Ownership manager
	 */
	constructor({ mode, apiPath, contextManager, instanceID, initialImpl = null, materializeFunc = null, ownership = null }) {
		this.mode = mode;
		this.apiPath = apiPath;
		this.contextManager = contextManager;
		this.instanceID = instanceID;
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
		if (this.apiPath === "string") {
			console.log(`[__setImpl] apiPath=${this.apiPath}, newImpl keys=${Object.keys(newImpl || {}).join(",")}`);
		}
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

		if (this.apiPath === "string") {
			console.log(`[_materialize] START for apiPath=${this.apiPath}`);
		}

		this._state.inFlight = true;

		try {
			if (this._materializeFunc) {
				if (this.apiPath === "string") {
					console.log(`[_materialize] Calling materializeFunc (no args, expects return value)...`);
				}
				// POC pattern: materializeFunc returns the implementation
				const result = await this._materializeFunc();
				this._impl = result;
				this._state.materialized = true;
				this._state.inFlight = false;
				if (this.apiPath === "string") {
					console.log(
						`[_materialize] DONE! result=${typeof result}, result keys=${result ? Object.keys(result).join(",") : "null"}, impl keys=${this._impl ? Object.keys(this._impl).join(",") : "null"}`
					);
				}
			}
		} catch (error) {
			if (this.apiPath === "string") {
				console.log(`[_materialize] ERROR: ${error.message}`);
			}
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
					return self.contextManager.runInContext(self.instanceID, current, thisArg, args);
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
			return self.contextManager.runInContext(self.instanceID, fn, this, args);
		};

		// Preserve metadata
		Object.defineProperty(wrapped, "name", {
			value: fn.name || "anonymous",
			configurable: true
		});

		wrapped.__slothletPath = fnPath;
		wrapped.__slothletOriginal = fn;
		wrapped.__slothletInstanceID = this.instanceID;

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

				// DEBUG: Log all string-related access in lazy mode
				if (wrapper.mode === "lazy" && (wrapper.apiPath === "string" || wrapper.apiPath.startsWith("string."))) {
					console.log(
						`[GET TRAP] mode=${wrapper.mode}, apiPath=${wrapper.apiPath}, prop=${String(prop)}, materialized=${wrapper._state.materialized}, impl=${wrapper._impl ? Object.keys(wrapper._impl).join(",") : "null"}`
					);
				}

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
					if (wrapper.apiPath === "string" || wrapper.apiPath.startsWith("string.")) {
						console.log(
							`[MATERIALIZATION TRIGGER] apiPath=${wrapper.apiPath}, prop=${String(prop)}, materializeFunc=${typeof wrapper._materializeFunc}`
						);
					}
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

				// Check target for attached properties (e.g., logger.utils attached via set trap)
				if (value === undefined && target[prop] !== undefined) {
					console.log(`[GET TRAP] Found ${prop} on target, type=${typeof target[prop]}`);
					value = target[prop];
				}

				// Get from __impl - properties are attached here by set trap
				if (value === undefined && wrapper._impl) {
					value = wrapper._impl[prop];
					// DEBUG: Log lazy mode property access
					if (wrapper.mode === "lazy" && wrapper.apiPath.includes("string")) {
						console.log(
							`[LAZY DEBUG] ${wrapper.apiPath}.${String(prop)} = ${typeof value} (impl keys: ${Object.keys(wrapper._impl || {}).join(", ")})`
						);
					}
				}

				// Log if utils is being accessed
				if (prop === "utils") {
					console.log(
						`[GET TRAP utils] apiPath=${wrapper.apiPath}, value=${typeof value}, target.utils=${typeof target.utils}, target keys=${Object.keys(target).join(",")}`
					);
				}
				// Log if logger is being accessed
				if (prop === "logger") {
					console.log(
						`[GET TRAP logger] apiPath=${wrapper.apiPath}, value type=${typeof value}, value keys=${value && typeof value === "object" ? Object.keys(value).join(",") : "n/a"}`
					);
				}
				// Return undefined if property doesn't exist
				if (value === undefined) {
					if (wrapper.mode === "lazy" && wrapper.apiPath.includes("string")) {
						console.log(`[LAZY DEBUG] ${wrapper.apiPath}.${String(prop)} = undefined! (impl: ${wrapper._impl ? "exists" : "null"})`);
					}
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
						instanceID: wrapper.instanceID,
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
										resolve(wrapper.contextManager.runInContext(wrapper.instanceID, impl, thisArg, args));
									} else {
										resolve(impl.apply(thisArg, args));
									}
								} else if (impl && typeof impl === "object" && typeof impl.default === "function") {
									// Object with default method
									if (wrapper.contextManager) {
										resolve(wrapper.contextManager.runInContext(wrapper.instanceID, impl.default, impl, args));
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
						return wrapper.contextManager.runInContext(wrapper.instanceID, impl, thisArg, args);
					}
					return impl.apply(thisArg, args);
				}

				// Check if impl is an object with a 'default' method
				if (impl && typeof impl === "object" && typeof impl.default === "function") {
					// Call the default method
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
			},

			has(target, prop) {
				const wrapper = target.__wrapper;

				// Trigger materialization if needed
				if (wrapper.mode === "lazy" && !wrapper._state.materialized && !wrapper._state.inFlight) {
					wrapper._materialize();
				}

			// Check both _impl and target for attached properties
			const inImpl = wrapper._impl && prop in wrapper._impl;
			const inTarget = Object.prototype.hasOwnProperty.call(target, prop);
			if (prop === "utils") {
				console.log(`[HAS TRAP utils] apiPath=${wrapper.apiPath}, inImpl=${inImpl}, inTarget=${inTarget}, target keys=${Object.keys(target).join(",")}`);
			}
			if (inImpl) return true;
			return inTarget;
		},
			if (wrapper.mode === "lazy" && !wrapper._state.materialized && !wrapper._state.inFlight) {
				wrapper._materialize();
			}

			// Always include prototype descriptor from target since target is a function
			if (prop === "prototype") {
			return Object.getOwnPropertyDescriptor(target, "prototype");
		}

		// Return descriptor from implementation
		if (wrapper._impl && prop in wrapper._impl) {
			return Object.getOwnPropertyDescriptor(wrapper._impl, prop);
		}

		return undefined;
	},

ownKeys(target) {
	const wrapper = target.__wrapper;

	// Trigger materialization if needed
	if (wrapper.mode === "lazy" && !wrapper._state.materialized && !wrapper._state.inFlight) {
		wrapper._materialize();
	}

	// Only return keys from implementation - target properties are internal
	// Always include 'prototype' since target is a function
	const implKeys = wrapper._impl ? Object.keys(wrapper._impl) : [];
	return [...implKeys, "prototype"];
},

set(target, prop, value) {
	const wrapper = target.__wrapper;

	// Trigger materialization if needed
	if (wrapper.mode === "lazy" && !wrapper._state.materialized && !wrapper._state.inFlight) {
		wrapper._materialize();
	}

	// Set property on the target (the proxy function itself)
	// This allows attaching wrapper proxies to callable wrappers (e.g., logger.utils wrapper)
	console.log(`[SET TRAP] prop=${prop}, setting on target, target is ${typeof target}, wrapper.apiPath=${wrapper.apiPath}`);
	target[prop] = value;
	console.log(`[SET TRAP] after set, target[${prop}] = ${typeof target[prop]}`);
	return true;
}
});
	}
}
