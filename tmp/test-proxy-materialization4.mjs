/**
 * @fileoverview Unified wrapper proxy test harness. Internal file (not exported in
 * package.json).
 * @module @cldmv/slothlet/tmp/test-proxy-materialization4
 * @internal
 * @private
 *
 * @description
 * Exercises a unified proxy wrapper that supports lazy/eager loading, nested
 * materialization, and AsyncLocalStorage context isolation across instances.
 *
 * @example
 * node tmp/test-proxy-materialization4.mjs
 */

import { AsyncLocalStorage } from "node:async_hooks";
import { performance } from "node:perf_hooks";
import { writeFile } from "node:fs/promises";
import util from "node:util";

// ============================================================================
// Timing Helper
// ============================================================================

function formatTime(ms) {
	if (ms < 1) {
		return `${(ms * 1000).toFixed(2)}μs`;
	}
	return `${ms.toFixed(2)}ms`;
}

// ============================================================================
// AsyncLocalStorage Context Manager
// ============================================================================

class ContextManager {
	constructor() {
		this.als = new AsyncLocalStorage();
	}

	runInContext(instanceId, fn, thisArg, args) {
		const existingCtx = this.als.getStore();

		// If already in context for same instance, just run
		if (existingCtx?.instanceId === instanceId) {
			return Reflect.apply(fn, thisArg, args);
		}

		// Create new context with instance-specific data
		const ctx = {
			instanceId,
			self: existingCtx?.self || null,
			context: existingCtx?.context || {},
			// Add some test data to verify isolation
			testData: `context-for-${instanceId}`
		};

		return this.als.run(ctx, () => Reflect.apply(fn, thisArg, args));
	}

	getContext() {
		return this.als.getStore();
	}
}

// ============================================================================
// Unified Wrapper - Handles Everything
// ============================================================================

class UnifiedWrapper {
	/**
	 * @private
	 * @param {object} options
	 * @param {'eager'|'lazy'} options.mode
	 * @param {string} [options.apiPath=""]
	 * @param {ContextManager} options.contextManager
	 * @param {string} options.instanceId
	 * @param {function|object|null} [options.initialImpl=null]
	 * @param {function|undefined} [options.materializeFunc=undefined]
	 * @param {boolean} [options.isCallable=false]
	 *
	 * @description
	 * Initializes a unified wrapper for lazy or eager modules.
	 *
	 * @example
	 * const wrapper = new UnifiedWrapper({
	 * 	mode: "lazy",
	 * 	contextManager,
	 * 	instanceId
	 * });
	 */
	constructor(options) {
		this.mode = options.mode; // "lazy" or "eager"
		this.apiPath = options.apiPath || "";
		this.contextManager = options.contextManager;
		this.instanceId = options.instanceId;
		this.isCallable = typeof options.isCallable === "boolean" ? options.isCallable : false;
		this._childCache = new Map();

		// __impl pattern (replaceable implementation)
		this._impl = options.initialImpl || null;

		// Lazy mode state
		if (this.mode === "lazy") {
			this._state = { materialized: false, inFlight: false };
			this._materializeFunc = options.materializeFunc;
		} else {
			this._state = { materialized: true, inFlight: false };
		}
	}

	// Get current __impl
	get __impl() {
		return this._impl;
	}

	/**
	 * @private
	 * @param {function|object|null} newImpl
	 * @returns {void}
	 *
	 * @description
	 * Replaces the implementation and clears cached child wrappers.
	 *
	 * @example
	 * wrapper.__setImpl(nextImpl);
	 */
	__setImpl(newImpl) {
		this._impl = newImpl;
		this._adoptImplChildren();
		if (this.mode === "lazy") {
			this._state.materialized = true;
			this._state.inFlight = false;
		}
	}

	// Get current state
	__getState() {
		return { ...this._state, path: this.apiPath };
	}

	/**
	 * @private
	 * @returns {Promise<void>}
	 *
	 * @description
	 * Runs the lazy materializer and resets cached child wrappers on success.
	 *
	 * @example
	 * await wrapper._materialize();
	 */
	async _materialize() {
		if (this.mode !== "lazy" || this._state.materialized || this._state.inFlight) {
			return;
		}

		this._state.inFlight = true;

		try {
			const result = await this._materializeFunc();
			this._impl = result;
			this._adoptImplChildren();
			this._state.materialized = true;
			this._state.inFlight = false; // Set here so nested access works
		} catch (err) {
			console.error(`[MATERIALIZE ERROR] ${this.apiPath}:`, err);
			this._state.inFlight = false;
		}
	}

	/**
	 * @private
	 * @returns {void}
	 *
	 * @description
	 * Moves own configurable children off the impl into child wrappers so impl
	 * only represents the current path, not its descendants.
	 *
	 * @example
	 * wrapper._adoptImplChildren();
	 */
	_adoptImplChildren() {
		if (!this._impl || (typeof this._impl !== "object" && typeof this._impl !== "function")) return;
		const ownKeys = Reflect.ownKeys(this._impl);
		const internalKeys = new Set(["__impl", "__setImpl", "__getState", "__materialize", "_impl", "_state"]);
		const observedKeys = new Set();

		for (const key of ownKeys) {
			if (internalKeys.has(key)) continue;
			const descriptor = Object.getOwnPropertyDescriptor(this._impl, key);
			if (!descriptor || !descriptor.configurable) continue;

			const value = this._impl[key];
			observedKeys.add(key);
			const existing = this._childCache.get(key);
			if (existing && typeof existing.__setImpl === "function") {
				existing.__setImpl(value);
				delete this._impl[key];
				continue;
			}

			const wrapped = this._createChildWrapper(key, value);
			if (wrapped) {
				this._childCache.set(key, wrapped);
				delete this._impl[key];
			}
		}

		for (const key of this._childCache.keys()) {
			if (!observedKeys.has(key)) {
				this._childCache.delete(key);
			}
		}
	}

	/**
	 * @private
	 * @param {string|symbol} key
	 * @param {unknown} value
	 * @returns {function|object|undefined}
	 *
	 * @description
	 * Creates a child wrapper proxy for an impl property when the value is an
	 * object or function.
	 *
	 * @example
	 * const child = wrapper._createChildWrapper("add", fn);
	 */
	_createChildWrapper(key, value) {
		if (!value || (typeof value !== "function" && (typeof value !== "object" || Array.isArray(value)))) {
			return undefined;
		}

		if (value && typeof value.__getState === "function") {
			return value;
		}

		const nestedWrapper = new UnifiedWrapper({
			mode: "eager",
			apiPath: this.apiPath ? `${this.apiPath}.${String(key)}` : String(key),
			contextManager: this.contextManager,
			instanceId: this.instanceId,
			initialImpl: value,
			isCallable: typeof value === "function"
		});
		nestedWrapper._adoptImplChildren();

		return nestedWrapper.createProxy();
	}

	/**
	 * @private
	 * @returns {Promise<void>}
	 *
	 * @description
	 * Exposes lazy materialization as an internal proxy method for chained wrappers.
	 *
	 * @example
	 * await wrapper.__materialize();
	 */
	__materialize() {
		return this._materialize();
	}

	/**
	 * @private
	 * @param {(string|symbol)[]} [propChain=[]]
	 * @returns {function}
	 *
	 * @description
	 * Creates a waiting proxy that records a property chain and resolves it after
	 * lazy materialization completes.
	 *
	 * @example
	 * const waitProxy = wrapper._createWaitingProxy(["math", "advanced"]);
	 */
	_createWaitingProxy(propChain = []) {
		const wrapper = this;

		const waitingTarget = function waitingFunction() {};

		return new Proxy(waitingTarget, {
			get(___target, nestedProp) {
				if (nestedProp === "then") return undefined;

				// Add this property to the chain and return another waiting proxy
				return wrapper._createWaitingProxy([...propChain, nestedProp]);
			},

			apply: async (___target, ___thisArg, args) => {
				if (wrapper.mode === "lazy" && !wrapper._state.materialized && !wrapper._state.inFlight) {
					await wrapper._materialize();
				}

				// Wait for wrapper to materialize
				while (wrapper._state.inFlight) {
					await new Promise((r) => setImmediate(r));
				}

				// Now traverse the property chain
				let current = wrapper.createProxy();

				for (const prop of propChain) {
					if (!current) {
						throw new Error(`${wrapper.apiPath}.${propChain.join(".")} - cannot access ${prop} of undefined`);
					}

					// If current is a UnifiedWrapper, trigger its materialization and wait
					if (current && current.__getState) {
						const state = current.__getState();
						if (!state.materialized) {
							if (!state.inFlight && typeof current.__materialize === "function") {
								await current.__materialize();
							}
							while (!current.__getState().materialized) {
								const nextState = current.__getState();
								if (!nextState.inFlight && !nextState.materialized) {
									throw new Error(
										`${wrapper.apiPath}.${propChain.join(".")} failed to materialize ${String(prop)}`
									);
								}
								await new Promise((r) => setImmediate(r));
							}
						}
					}

					current = current[prop];
				}

				if (typeof current === "function") {
					return current(...args);
				}

				throw new Error(`${wrapper.apiPath}.${propChain.join(".")} is not a function`);
			}
		});
	}
	_createThenable(prop) {
		const parentWrapper = this;
		const thenableTarget = function thenable() {};

		return new Proxy(thenableTarget, {
			get(___target, nestedProp) {
				// Not a promise
				if (nestedProp === "then") return undefined;

				// If materialized, access from __impl
				if (parentWrapper._state.materialized && parentWrapper._impl) {
					const value = parentWrapper._impl[prop];

					// If value is a UnifiedWrapper proxy (lazy nested module), access its property
					// This triggers the nested wrapper's own proxy logic
					if (value && typeof value === "object" && value.__getState) {
						return value[nestedProp];
					}

					if (value && typeof value === "object") {
						return value[nestedProp];
					}
					return undefined;
				}

				// Still materializing - chain access by waiting for parent first,
				// then accessing the property chain
				return new Promise(async (resolve, reject) => {
					const check = async () => {
						if (parentWrapper._state.materialized && parentWrapper._impl) {
							try {
								const value = parentWrapper._impl[prop];

								// If value is a UnifiedWrapper, access its property
								if (value && typeof value === "object" && value.__getState) {
									const nestedValue = value[nestedProp];
									// If nested value is a promise/thenable, await it
									if (nestedValue && typeof nestedValue === "object" && typeof nestedValue.then === "function") {
										resolve(await nestedValue);
									} else {
										resolve(nestedValue);
									}
								} else if (value && typeof value === "object") {
									resolve(value[nestedProp]);
								} else {
									resolve(undefined);
								}
							} catch (err) {
								reject(err);
							}
						} else {
							setImmediate(check);
						}
					};
					check();
				});
			},

			apply(___target, ___thisArg, args) {
				// If materialized, call the function
				if (parentWrapper._state.materialized && parentWrapper._impl) {
					const fn = parentWrapper._impl[prop];

					// If fn is a UnifiedWrapper proxy (nested lazy module), it shouldn't be callable
					if (fn && typeof fn === "object" && fn.__getState) {
						throw new Error(`${parentWrapper.apiPath}.${String(prop)} is a module, not a callable function`);
					}

					if (typeof fn === "function") {
						return parentWrapper._wrapFunction(fn, `${parentWrapper.apiPath}.${String(prop)}`)(...args);
					}
				}

				// Not materialized - wait for materialization then call
				return new Promise((resolve, reject) => {
					const check = () => {
						if (parentWrapper._state.materialized && parentWrapper._impl) {
							try {
								const fn = parentWrapper._impl[prop];
								if (typeof fn === "function") {
									resolve(parentWrapper._wrapFunction(fn, `${parentWrapper.apiPath}.${String(prop)}`)(...args));
								} else {
									reject(new Error(`${parentWrapper.apiPath}.${String(prop)} is not a function`));
								}
							} catch (err) {
								reject(err);
							}
						} else {
							setImmediate(check);
						}
					};
					check();
				});
			}
		});
	}

	/**
	 * @private
	 * @param {function} fn
	 * @param {string} fnPath
	 * @returns {function}
	 *
	 * @description
	 * Wraps a function with AsyncLocalStorage context binding.
	 *
	 * @example
	 * const wrapped = wrapper._wrapFunction(() => "ok", "api.fn");
	 */
	_wrapFunction(fn, fnPath) {
		const wrapper = this;

		return function wrapped(...args) {
			return wrapper.contextManager.runInContext(wrapper.instanceId, fn, this, args);
		};
	}

	/**
	 * @private
	 * @returns {function|object}
	 *
	 * @description
	 * Creates the unified proxy that handles lazy materialization, context binding,
	 * and nested wrapper access.
	 *
	 * @example
	 * const api = wrapper.createProxy();
	 */
	createProxy() {
		const wrapper = this;

		// CRITICAL: The proxy target type must match what __impl is/will be
		// - If __impl is a function, use function target (allows typeof === "function" and calling)
		// - Otherwise, use object target (90% of modules are objects)
		const proxyTarget = (wrapper._impl && typeof wrapper._impl === "function") || wrapper.isCallable
			? function unifiedProxyTarget() {}
			: {};

		return new Proxy(proxyTarget, {
			get(target, prop, receiver) {
				// Internal methods - return from wrapper
				if (
					prop === "__impl" ||
					prop === "__setImpl" ||
					prop === "__getState" ||
					prop === "__materialize" ||
					prop === "_impl" ||
					prop === "_state"
				) {
					if (prop === "__setImpl") return wrapper.__setImpl.bind(wrapper);
					if (prop === "__getState") return wrapper.__getState.bind(wrapper);
					if (prop === "__materialize") return wrapper.__materialize.bind(wrapper);
					return wrapper[prop];
				}

				// Lazy mode: trigger materialization if needed
				if (wrapper.mode === "lazy" && !wrapper._state.materialized && !wrapper._state.inFlight) {
					wrapper._materialize();
				}

				// Lazy mode: if materializing OR impl not ready, return a special proxy that waits
				// This allows api.math.advanced.calc.power to work by chaining proxies
				if (wrapper.mode === "lazy" && (wrapper._state.inFlight || !wrapper._impl)) {
					// Return a waiting proxy with this property as the first in the chain
					return wrapper._createWaitingProxy([prop]);
				}

				// Access from __impl (materialized or eager mode)
				const impl = wrapper._impl;
				if (!impl) return undefined;

				if (wrapper._childCache.has(prop)) {
					return wrapper._childCache.get(prop);
				}

				const value = impl[prop];
				if (value === undefined) return undefined;

				// Check if value is a UnifiedWrapper (nested lazy module that hasn't materialized yet)
				// Return it directly - it will handle its own lazy materialization when accessed
				// NOTE: Check for __getState, not typeof === "object", because lazy wrappers have function targets
				if (value && value.__getState) {
					return value;
				}

				// Wrap functions and plain objects in unified wrappers
				if ((value && typeof value === "function") || (value && typeof value === "object" && !Array.isArray(value))) {
					const nestedWrapper = new UnifiedWrapper({
						mode: "eager", // Values from __impl are already loaded
						apiPath: wrapper.apiPath ? `${wrapper.apiPath}.${String(prop)}` : String(prop),
						contextManager: wrapper.contextManager,
						instanceId: wrapper.instanceId,
						initialImpl: value,
						isCallable: typeof value === "function"
					});
					const nestedProxy = nestedWrapper.createProxy();
					wrapper._childCache.set(prop, nestedProxy);
					return nestedProxy;
				}

				// Primitives and arrays
				return value;
			},

			apply(target, thisArg, args) {
				// Lazy mode: trigger materialization if needed
				if (wrapper.mode === "lazy" && !wrapper._state.materialized && !wrapper._state.inFlight) {
					wrapper._materialize();
				}

				// Lazy mode: return promise if materializing
				if (wrapper.mode === "lazy" && wrapper._state.inFlight) {
					return new Promise((resolve, reject) => {
						const check = () => {
							if (wrapper._state.materialized) {
								const impl = wrapper._impl;
								if (typeof impl === "function") {
									resolve(wrapper.contextManager.runInContext(wrapper.instanceId, impl, thisArg, args));
								} else {
									reject(new Error(`${wrapper.apiPath} is not callable`));
								}
							} else {
								setImmediate(check);
							}
						};
						check();
					});
				}

				// Call from __impl
				const impl = wrapper._impl;
				if (typeof impl === "function") {
					return wrapper.contextManager.runInContext(wrapper.instanceId, impl, thisArg, args);
				}

				throw new TypeError(`${wrapper.apiPath || "api"} is not a function`);
			},

			has(target, prop) {
				if (prop === "__impl" || prop === "__setImpl" || prop === "__getState" || prop === "__materialize") return true;
				return wrapper._impl ? prop in wrapper._impl : false;
			},

			ownKeys(target) {
				// Lazy mode: trigger materialization if needed
				if (wrapper.mode === "lazy" && !wrapper._state.materialized && !wrapper._state.inFlight) {
					wrapper._materialize();
				}

				const keys = new Set(Reflect.ownKeys(target));
				const implKeys = wrapper._impl ? Reflect.ownKeys(wrapper._impl) : [];
				implKeys.forEach((key) => keys.add(key));
				// Add internal methods
				keys.add("__impl");
				keys.add("__setImpl");
				keys.add("__getState");
				keys.add("__materialize");
				return Array.from(keys);
			}
		});
	}
}

// ============================================================================
// Test Setup - Create Pseudo API
// ============================================================================

async function loadMathModule(contextManager, instanceId, mode) {
	// Simulate async file loading
	console.log(`[LOAD] Loading math module (${mode} mode)...`);
	await new Promise((resolve) => setTimeout(resolve, 50));

	const impl = {
		add: (a, b) => {
			console.log(`[MATH.ADD] Called with a=${a}, b=${b}`);
			return a + b;
		},
		multiply: (a, b) => a * b,
		divide: (a, b) => a / b
	};

	// Add nested "advanced" module
	if (mode === "lazy") {
		// In lazy mode, advanced is another lazy wrapper
		const advancedWrapper = new UnifiedWrapper({
			mode: "lazy",
			apiPath: "math.advanced",
			contextManager,
			instanceId,
			initialImpl: null,
			materializeFunc: () => loadMathAdvancedModule(contextManager, instanceId, mode)
		});
		impl.advanced = advancedWrapper.createProxy();
	} else {
		// In eager mode, load immediately
		impl.advanced = await loadMathAdvancedModule(contextManager, instanceId, mode);
	}

	return impl;
}

async function loadMathAdvancedModule(contextManager, instanceId, mode) {
	console.log(`[LOAD] Loading math.advanced module (${mode} mode)...`);
	await new Promise((resolve) => setTimeout(resolve, 40));

	const impl = {
		square: (x) => x * x,
		cube: (x) => x * x * x
	};

	// Add even deeper nested "calc" module
	if (mode === "lazy") {
		const calcWrapper = new UnifiedWrapper({
			mode: "lazy",
			apiPath: "math.advanced.calc",
			contextManager,
			instanceId,
			initialImpl: null,
			materializeFunc: () => loadMathCalcModule()
		});
		impl.calc = calcWrapper.createProxy();
	} else {
		impl.calc = await loadMathCalcModule();
	}

	return impl;
}

async function loadMathCalcModule() {
	console.log(`[LOAD] Loading math.advanced.calc module...`);
	await new Promise((resolve) => setTimeout(resolve, 30));

	return {
		power: (a, b) => {
			console.log(`[MATH.ADVANCED.CALC.POWER] Called with a=${a}, b=${b}`);
			return Math.pow(a, b);
		},
		factorial: (n) => {
			if (n <= 1) return 1;
			return n * factorial(n - 1);
		}
	};
}

async function loadStringModule() {
	console.log(`[LOAD] Loading string module...`);
	await new Promise((resolve) => setTimeout(resolve, 30));

	return {
		upper: (str) => str.toUpperCase(),
		lower: (str) => str.toLowerCase(),
		reverse: (str) => str.split("").reverse().join("")
	};
}

// ============================================================================
// Logger Module - Tests "callable with properties" pattern
// ============================================================================

/**
 * @private
 * @param {ContextManager} contextManager
 * @param {string} instanceId
 * @param {'eager'|'lazy'} mode
 * @returns {Promise<function>}
 *
 * @description
 * Loads the logger module as a callable function with nested utils.
 *
 * @example
 * await loadLoggerModule(contextManager, "test", "lazy");
 */
async function loadLoggerModule(contextManager, instanceId, mode) {
	console.log(`[LOAD] Loading logger module (${mode} mode)...`);
	await new Promise((resolve) => setTimeout(resolve, 30));

	// The main logger function (from logger/logger.mjs default export)
	const loggerFunction = function logger_main(msg) {
		console.log(`[LOGGER] ${msg}`);
		return `logged: ${msg}`;
	};

	// Load utils as a nested module (from logger/utils.mjs)
	if (mode === "lazy") {
		const utilsWrapper = new UnifiedWrapper({
			mode: "lazy",
			apiPath: "logger.utils",
			contextManager,
			instanceId,
			initialImpl: null,
			materializeFunc: () => loadLoggerUtilsModule()
		});
		// Attach utils wrapper to the function as a property
		loggerFunction.utils = utilsWrapper.createProxy();
	} else {
		// Eager mode - load and attach immediately
		loggerFunction.utils = await loadLoggerUtilsModule();
	}

	// Return the function (with utils attached as a property)
	return loggerFunction;
}

async function loadLoggerUtilsModule() {
	console.log(`[LOAD] Loading logger.utils module...`);
	await new Promise((resolve) => setTimeout(resolve, 20));

	return {
		debug: (msg) => {
			console.log(`[DEBUG] ${msg}`);
			return `debug: ${msg}`;
		},
		error: (msg) => {
			console.error(`[ERROR] ${msg}`);
			return `error: ${msg}`;
		},
		info: (msg) => {
			console.log(`[INFO] ${msg}`);
			return `info: ${msg}`;
		}
	};
}

// ============================================================================
// Subfolder Module - Tests "nested folder with callable logger + properties"
// ============================================================================

/**
 * @private
 * @param {ContextManager} contextManager
 * @param {string} instanceId
 * @param {'eager'|'lazy'} mode
 * @returns {Promise<object>}
 *
 * @description
 * Loads a nested subfolder module with a callable logger.
 *
 * @example
 * await loadSubfolderModule(contextManager, "test", "eager");
 */
async function loadSubfolderModule(contextManager, instanceId, mode) {
	console.log(`[LOAD] Loading subfolder module (${mode} mode)...`);
	await new Promise((resolve) => setTimeout(resolve, 20));

	// subfolder is an object container
	const subfolder = {};

	// Add logger to subfolder (from subfolder/logger.mjs)
	if (mode === "lazy") {
		const loggerWrapper = new UnifiedWrapper({
			mode: "lazy",
			apiPath: "subfolder.logger",
			contextManager,
			instanceId,
			isCallable: true,
			initialImpl: null,
			materializeFunc: () => loadSubfolderLoggerModule(contextManager, instanceId, mode)
		});
		subfolder.logger = loggerWrapper.createProxy();
	} else {
		subfolder.logger = await loadSubfolderLoggerModule(contextManager, instanceId, mode);
	}

	return subfolder;
}

/**
 * @private
 * @param {ContextManager} contextManager
 * @param {string} instanceId
 * @param {'eager'|'lazy'} mode
 * @returns {Promise<function>}
 *
 * @description
 * Loads the subfolder logger module as a callable function with nested utils.
 *
 * @example
 * await loadSubfolderLoggerModule(contextManager, "test", "lazy");
 */
async function loadSubfolderLoggerModule(contextManager, instanceId, mode) {
	console.log(`[LOAD] Loading subfolder.logger module (${mode} mode)...`);
	await new Promise((resolve) => setTimeout(resolve, 25));

	// The main logger function (from subfolder/logger.mjs default export)
	const loggerFunction = function subfolder_logger_main(msg) {
		console.log(`[SUBFOLDER.LOGGER] ${msg}`);
		return `subfolder logged: ${msg}`;
	};

	// Load utils as a nested module (from subfolder/utils.mjs)
	if (mode === "lazy") {
		const utilsWrapper = new UnifiedWrapper({
			mode: "lazy",
			apiPath: "subfolder.logger.utils",
			contextManager,
			instanceId,
			initialImpl: null,
			materializeFunc: () => loadSubfolderLoggerUtilsModule()
		});
		// Attach utils wrapper to the function as a property
		loggerFunction.utils = utilsWrapper.createProxy();
	} else {
		// Eager mode - load and attach immediately
		loggerFunction.utils = await loadSubfolderLoggerUtilsModule();
	}

	// Return the function (with utils attached as a property)
	return loggerFunction;
}

async function loadSubfolderLoggerUtilsModule() {
	console.log(`[LOAD] Loading subfolder.logger.utils module...`);
	await new Promise((resolve) => setTimeout(resolve, 20));

	return {
		trace: (msg) => {
			console.log(`[SUBFOLDER TRACE] ${msg}`);
			return `trace: ${msg}`;
		},
		warn: (msg) => {
			console.warn(`[SUBFOLDER WARN] ${msg}`);
			return `warn: ${msg}`;
		}
	};
}

// ============================================================================
// Impl Replacement Helpers
// ============================================================================

/**
 * @private
 * @param {string} label
 * @returns {function}
 *
 * @description
 * Creates a new error implementation function with a label.
 *
 * @example
 * const fn = createErrorImpl("ref");
 */
function createErrorImpl(label) {
	/**
	 * @private
	 * @param {string} msg
	 * @returns {string}
	 *
	 * @description
	 * Formats an error message with the provided label.
	 *
	 * @example
	 * error_impl("boom");
	 */
	function error_impl(msg) {
		return `[${label}] error: ${msg}`;
	}

	return error_impl;
}

/**
 * @private
 * @param {string} label
 * @returns {function}
 *
 * @description
 * Creates a new debug implementation function with a label.
 *
 * @example
 * const fn = createDebugImpl("ref");
 */
function createDebugImpl(label) {
	/**
	 * @private
	 * @param {string} msg
	 * @returns {string}
	 *
	 * @description
	 * Formats a debug message with the provided label.
	 *
	 * @example
	 * debug_impl("ok");
	 */
	function debug_impl(msg) {
		return `[${label}] debug: ${msg}`;
	}

	return debug_impl;
}

/**
 * @private
 * @param {string} label
 * @returns {function}
 *
 * @description
 * Creates a new info implementation function with a label.
 *
 * @example
 * const fn = createInfoImpl("ref");
 */
function createInfoImpl(label) {
	/**
	 * @private
	 * @param {string} msg
	 * @returns {string}
	 *
	 * @description
	 * Formats an info message with the provided label.
	 *
	 * @example
	 * info_impl("ok");
	 */
	function info_impl(msg) {
		return `[${label}] info: ${msg}`;
	}

	return info_impl;
}

/**
 * @private
 * @param {string} label
 * @returns {object}
 *
 * @description
 * Creates a new utils implementation object with labeled methods.
 *
 * @example
 * const utils = createUtilsImpl("utils");
 */
function createUtilsImpl(label) {
	return {
		debug: createDebugImpl(`${label}:debug`),
		error: createErrorImpl(`${label}:error`),
		info: createInfoImpl(`${label}:info`)
	};
}

// ============================================================================
// Test Runner
// ============================================================================

/**
 * @private
 * @param {'eager'|'lazy'} mode
 * @returns {Promise<object>}
 *
 * @description
 * Runs the unified wrapper tests for the specified mode and returns the API.
 *
 * @example
 * const api = await testMode("lazy");
 */
async function testMode(mode) {
	console.log(`\n${"=".repeat(60)}`);
	console.log(`Testing ${mode.toUpperCase()} Mode`);
	console.log("=".repeat(60));
	console.log(`[testMode] Starting ${mode} mode test...`);

	const startTime = performance.now();
	const contextManager = new ContextManager();
	const instanceId = `test_${Date.now()}`;

	// Create API structure
	const api = {};

	// Math module
	const mathWrapper = new UnifiedWrapper({
		mode,
		apiPath: "math",
		contextManager,
		instanceId,
		initialImpl: mode === "eager" ? await loadMathModule(contextManager, instanceId, mode) : null,
		materializeFunc: mode === "lazy" ? () => loadMathModule(contextManager, instanceId, mode) : null
	});
	api.math = mathWrapper.createProxy();

	// String module
	const stringWrapper = new UnifiedWrapper({
		mode,
		apiPath: "string",
		contextManager,
		instanceId,
		initialImpl: mode === "eager" ? await loadStringModule() : null,
		materializeFunc: mode === "lazy" ? loadStringModule : null
	});
	api.string = stringWrapper.createProxy();

	// Logger module (callable function with .utils property)
	const loggerWrapper = new UnifiedWrapper({
		mode,
		apiPath: "logger",
		contextManager,
		instanceId,
		isCallable: true,
		initialImpl: mode === "eager" ? await loadLoggerModule(contextManager, instanceId, mode) : null,
		materializeFunc: mode === "lazy" ? () => loadLoggerModule(contextManager, instanceId, mode) : null
	});
	api.logger = loggerWrapper.createProxy();

	// Subfolder module (object with logger callable inside)
	const subfolderWrapper = new UnifiedWrapper({
		mode,
		apiPath: "subfolder",
		contextManager,
		instanceId,
		initialImpl: mode === "eager" ? await loadSubfolderModule(contextManager, instanceId, mode) : null,
		materializeFunc: mode === "lazy" ? () => loadSubfolderModule(contextManager, instanceId, mode) : null
	});
	api.subfolder = subfolderWrapper.createProxy();

	// Test 1: Check __impl pattern (before any materialization)
	const t1Start = performance.now();
	console.log("\n[TEST 1] __impl pattern (pre-materialization):");
	console.log("math.__getState():", api.math.__getState());
	console.log("string.__getState():", api.string.__getState());
	console.log("logger.__getState():", api.logger.__getState());
	console.log("subfolder.__getState():", api.subfolder.__getState());
	console.log(`⏱️  Test 1 took: ${formatTime(performance.now() - t1Start)}`);

	// Test 2: Deep nested call - THE CRITICAL TEST (triggers full chain)
	const t2Start = performance.now();
	console.log("\n[TEST 2] Deep nested call FIRST (api.math.advanced.calc.power):");
	console.log("[TEST 2] Mode:", mode);
	try {
		let result;
		if (mode === "lazy") {
			// Lazy mode might return promises
			console.log("Calling api.math.advanced.calc.power(2, 8) with await...");
			console.log("[TEST 2] About to access api.math...");
			const mathAdvanced = api.math.advanced;
			console.log("[TEST 2] Got math.advanced, about to access .calc...");
			const mathCalc = mathAdvanced.calc;
			console.log("[TEST 2] Got calc, about to access .power...");
			const powerFunc = mathCalc.power;
			console.log("[TEST 2] Got power function, about to call...");
			const callStart = performance.now();
			result = await powerFunc(2, 8);
			console.log(`  (Call itself took: ${formatTime(performance.now() - callStart)})`);
		} else {
			console.log("Calling api.math.advanced.calc.power(2, 8) directly...");
			result = api.math.advanced.calc.power(2, 8);
		}
		console.log("Result:", result);
		console.log("✅ Deep nested call successful");
		console.log(`⏱️  Test 2 took: ${formatTime(performance.now() - t2Start)}`);
	} catch (err) {
		console.log("❌ Deep nested call failed:", err.message);
		console.log("Stack:", err.stack);
		console.log(`⏱️  Test 2 took: ${formatTime(performance.now() - t2Start)}`);
	}

	// Test 2b: Logger callable function with nested utils
	const t2bStart = performance.now();
	console.log("\n[TEST 2b] Logger callable + nested utils (api.logger + api.logger.utils):");
	try {
		// Test main logger function
		let logResult;
		if (mode === "lazy") {
			console.log("Calling api.logger('test message') with await...");
			logResult = await api.logger("test message");
		} else {
			console.log("Calling api.logger('test message') directly...");
			logResult = api.logger("test message");
		}
		console.log("Logger result:", logResult);

		// Test nested utils.debug
		let debugResult;
		if (mode === "lazy") {
			console.log("Calling api.logger.utils.debug('debug message') with await...");
			debugResult = await api.logger.utils.debug("debug message");
		} else {
			console.log("Calling api.logger.utils.debug('debug message') directly...");
			debugResult = api.logger.utils.debug("debug message");
		}
		console.log("Utils.debug result:", debugResult);

		// Test nested utils.error
		let errorResult;
		if (mode === "lazy") {
			errorResult = await api.logger.utils.error("error message");
		} else {
			errorResult = api.logger.utils.error("error message");
		}
		console.log("Utils.error result:", errorResult);

		console.log("✅ Logger callable + nested utils successful");
		console.log(`⏱️  Test 2b took: ${formatTime(performance.now() - t2bStart)}`);
	} catch (err) {
		console.log("❌ Logger test failed:", err.message);
		console.log("Stack:", err.stack);
		console.log(`⏱️  Test 2b took: ${formatTime(performance.now() - t2bStart)}`);
	}

	// Test 3: Access properties at various depths (deepest to shallowest)
	const t3Start = performance.now();
	console.log("\n[TEST 3] Property type checks (deepest to shallowest):");
	console.log("[TEST 3.1] Checking api.subfolder.logger.utils.trace...");
	console.log("typeof api.subfolder.logger.utils.trace:", typeof api.subfolder.logger.utils.trace);
	console.log("[TEST 3.2] Checking api.subfolder.logger.utils...");
	console.log("typeof api.subfolder.logger.utils:", typeof api.subfolder.logger.utils);
	console.log("[TEST 3.3] Checking api.subfolder.logger...");
	console.log("typeof api.subfolder.logger:", typeof api.subfolder.logger);
	console.log("[TEST 3.4] Checking api.subfolder...");
	console.log("typeof api.subfolder:", typeof api.subfolder);
	console.log("[TEST 3.5] Checking api.logger.utils.debug...");
	console.log("typeof api.logger.utils.debug:", typeof api.logger.utils.debug);
	console.log("[TEST 3.6] Checking api.logger.utils...");
	console.log("typeof api.logger.utils:", typeof api.logger.utils);
	console.log("[TEST 3.7] Checking api.logger...");
	console.log("typeof api.logger:", typeof api.logger);
	console.log("[TEST 3.8] Checking api.math.advanced.calc.power...");
	console.log("typeof api.math.advanced.calc.power:", typeof api.math.advanced.calc.power);
	console.log("[TEST 3.9] Checking api.math.advanced.calc...");
	console.log("typeof api.math.advanced.calc:", typeof api.math.advanced.calc);
	console.log("[TEST 3.10] Checking api.math.advanced...");
	console.log("typeof api.math.advanced:", typeof api.math.advanced);
	console.log("[TEST 3.11] Checking api.math.add...");
	console.log("typeof api.math.add:", typeof api.math.add);
	console.log("[TEST 3.12] Checking api.math...");
	console.log("typeof api.math:", typeof api.math);
	console.log(`⏱️  Test 3 took: ${formatTime(performance.now() - t3Start)}`);

	// Test 4: Performance - First vs Sequential Calls (Shallow - UNMATERIALIZED branch)
	console.log("\n[TEST 4] Performance - Shallow calls (api.string.upper):");

	const shallowTimes = [];
	for (let i = 0; i < 5; i++) {
		const callStart = performance.now();
		let result;
		if (mode === "lazy") {
			result = await api.string.upper(`test${i}`);
		} else {
			result = api.string.upper(`test${i}`);
		}
		const callTime = performance.now() - callStart;
		shallowTimes.push(callTime);
		console.log(`  Call ${i + 1}: ${formatTime(callTime)} => ${result}`);
	}
	console.log(`  📊 First call: ${formatTime(shallowTimes[0])} ${mode === "lazy" ? "(includes materialization)" : ""}`);
	console.log(`  📊 Avg subsequent: ${formatTime(shallowTimes.slice(1).reduce((a, b) => a + b) / 4)}`);

	// Test 5: Performance - First vs Sequential Calls (Deep - already materialized)
	console.log("\n[TEST 5] Performance - Deep calls (api.math.advanced.calc.power):");

	const deepTimes = [];
	for (let i = 0; i < 5; i++) {
		const callStart = performance.now();
		let result;
		if (mode === "lazy") {
			result = await api.math.advanced.calc.power(2, 3 + i);
		} else {
			result = api.math.advanced.calc.power(2, 3 + i);
		}
		const callTime = performance.now() - callStart;
		deepTimes.push(callTime);
		console.log(`  Call ${i + 1}: ${formatTime(callTime)} => ${result}`);
	}
	console.log(`  📊 First call: ${formatTime(deepTimes[0])} ${mode === "lazy" ? "(already materialized from Test 2)" : ""}`);
	console.log(`  📊 Avg subsequent: ${formatTime(deepTimes.slice(1).reduce((a, b) => a + b) / 4)}`);

	// Test 6: Math module shallow call (already materialized)
	console.log("\n[TEST 6] Math module shallow call (already materialized):");
	try {
		let result;
		if (mode === "lazy") {
			result = await api.math.add(100, 200);
		} else {
			result = api.math.add(100, 200);
		}
		console.log("api.math.add(100, 200):", result);
		console.log("✅ Math add successful");
	} catch (err) {
		console.log("❌ Math add failed:", err.message);
	}

	// Test 7: State after all calls (should show materialized)
	console.log("\n[TEST 7] State after all calls:");
	console.log("math.__getState():", api.math.__getState());
	console.log("math.advanced.__getState():", api.math.advanced.__getState?.());
	console.log("string.__getState():", api.string.__getState());
	console.log("logger.__getState():", api.logger.__getState());
	console.log("logger.utils.__getState():", api.logger.utils.__getState?.());


	// Test 8: Subsequent calls (should be synchronous even in lazy)
	if (mode === "lazy") {
		console.log("\n[TEST 8] Subsequent calls (lazy mode):");
		const result2 = api.math.multiply(3, 4);
		console.log("api.math.multiply(3, 4):", result2);

		// Deep call should also be synchronous now
		const result3 = api.math.advanced.square(5);
		console.log("api.math.advanced.square(5):", result3);

		const result4 = api.math.advanced.calc.power(3, 3);
		console.log("api.math.advanced.calc.power(3, 3):", result4);

		// Logger calls should also be synchronous
		const result5 = api.logger("subsequent call");
		console.log("api.logger('subsequent call'):", result5);

		const result6 = api.logger.utils.info("subsequent info call");
		console.log("api.logger.utils.info('subsequent info call'):", result6);

		console.log("✅ All subsequent calls are synchronous");
	}

	// Test 9: Context isolation
	console.log("\n[TEST 9] Context isolation:");
	const ctx = contextManager.getContext();
	console.log("Current context:", ctx ? ctx.instanceId : "none");
	console.log("Context testData:", ctx ? ctx.testData : "none");


	const totalTime = performance.now() - startTime;
	console.log(`\n⏱️  Total ${mode.toUpperCase()} mode time: ${formatTime(totalTime)}`);
	console.log(`${mode.toUpperCase()} Mode Tests Complete!`);

	return api;
}

// ============================================================================
// Run All Tests
// ============================================================================

async function testContextIsolation() {
	console.log(`\n${"=".repeat(60)}`);
	console.log("Testing Context Isolation Between Instances");
	console.log("=".repeat(60));

	// Create two separate instances with shared context manager
	const sharedContextManager = new ContextManager();
	const instance1Id = "instance1_test";
	const instance2Id = "instance2_test";

	// Create instance 1 API
	const math1Wrapper = new UnifiedWrapper({
		mode: "eager",
		apiPath: "math",
		contextManager: sharedContextManager,
		instanceId: instance1Id,
		initialImpl: await loadMathModule(sharedContextManager, instance1Id, "eager")
	});
	const api1 = { math: math1Wrapper.createProxy() };

	// Create instance 2 API
	const math2Wrapper = new UnifiedWrapper({
		mode: "eager",
		apiPath: "math",
		contextManager: sharedContextManager,
		instanceId: instance2Id,
		initialImpl: await loadMathModule(sharedContextManager, instance2Id, "eager")
	});
	const api2 = { math: math2Wrapper.createProxy() };

	console.log("\n[TEST] Calling api1.math.add and api2.math.add with context tracking:");

	// Track which contexts were active
	const contexts = [];

	// Wrap add to capture context
	const captureContext = (id) => {
		return function (...args) {
			const ctx = sharedContextManager.getContext();
			contexts.push({
				calledFrom: id,
				contextInstanceId: ctx?.instanceId,
				testData: ctx?.testData,
				matches: ctx?.instanceId === id
			});
			return args[0] + args[1];
		};
	};

	// Call from instance 1
	const result1 = api1.math.add(10, 20);
	console.log(`Instance 1 result: ${result1}`);

	// Call from instance 2
	const result2 = api2.math.add(30, 40);
	console.log(`Instance 2 result: ${result2}`);

	// Verify contexts
	console.log("\n[VERIFY] Context isolation:");
	contexts.forEach((entry, i) => {
		console.log(
			`  Call ${i + 1}: calledFrom=${entry.calledFrom}, contextInstanceId=${entry.contextInstanceId}, matches=${entry.matches ? "✅" : "❌"}`
		);
	});

	const allMatch = contexts.every((c) => c.matches);
	if (allMatch) {
		console.log("\n✅ Context isolation verified - no bleed between instances");
	} else {
		console.log("\n❌ Context isolation FAILED - context bleeding detected!");
	}

	console.log("\nContext Isolation Tests Complete!");
}

/**
 * @private
 * @param {'eager'|'lazy'} mode
 * @param {object} api
 * @returns {Promise<void>}
 *
 * @description
 * Runs impl replacement checks for logger/utils/error at the end of output.
 *
 * @example
 * await testImplReplacement("lazy", api);
 */
async function testImplReplacement(mode, api) {
	console.log(`\n[FINAL] Impl replacement behavior (${mode}):`);
	try {
		const ref = api.logger;
		const before1 = mode === "lazy" ? await ref.utils.error("before-1") : ref.utils.error("before-1");
		console.log("ref.utils.error before:", before1);

		api.logger.utils.error.__setImpl(createErrorImpl("ref"));
		const after1 = mode === "lazy" ? await ref.utils.error("after-1") : ref.utils.error("after-1");
		console.log("ref.utils.error after:", after1);

		const ref2 = api.logger.utils.error;
		const before2 = mode === "lazy" ? await ref2("before-2") : ref2("before-2");
		console.log("ref2 before:", before2);

		api.logger.utils.error.__setImpl(createErrorImpl("ref2"));
		const after2 = mode === "lazy" ? await ref2("after-2") : ref2("after-2");
		console.log("ref2 after:", after2);

		api.logger.utils.__setImpl(createUtilsImpl("utils"));
		const afterUtils1 = mode === "lazy" ? await ref.utils.error("after-utils-1") : ref.utils.error("after-utils-1");
		const afterUtils2 = mode === "lazy" ? await ref2("after-utils-2") : ref2("after-utils-2");
		console.log("after utils impl replace ref:", afterUtils1);
		console.log("after utils impl replace ref2:", afterUtils2);
	} catch (err) {
		console.log("❌ Impl replacement test failed:", err.message);
		console.log("Stack:", err.stack);
	}
}

/**
 * @private
 * @param {string} name
 * @param {object} api
 * @returns {object}
 *
 * @description
 * Builds a raw tree object that captures wrapper and impl details without filtering.
 *
 * @example
 * console.log(util.inspect(dumpApiTree("api", api), { depth: null, showHidden: true }));
 */
function dumpApiTree(name, api) {
	const seen = new WeakSet();

	const collectApiTree = (node, path) => {
		if (!node || (typeof node !== "object" && typeof node !== "function")) return null;
		if (seen.has(node)) return { path, cycle: true };
		seen.add(node);

		const isWrapper = typeof node.__getState === "function";
		const state = isWrapper ? node.__getState() : null;
		const impl = isWrapper ? node.__impl : null;
		const type = typeof node;
		const implType = impl ? typeof impl : "null";
		const implOwnKeys = impl && (typeof impl === "object" || typeof impl === "function") ? Reflect.ownKeys(impl) : [];
		const wrapperOwnKeys = isWrapper
			? ["__impl", "__setImpl", "__getState", "__materialize", "_impl", "_state"]
			: Reflect.ownKeys(node);
		const wrapperProps = {};
		const implProps = {};

		if (!isWrapper) {
			for (const key of wrapperOwnKeys) {
				let child;
				try {
					child = node[key];
				} catch (err) {
					wrapperProps[key] = { error: err.message };
					continue;
				}

				const childType = typeof child;
				if (child && (childType === "object" || childType === "function")) {
					wrapperProps[key] = collectApiTree(child, `${path}.${String(key)}`);
				} else {
					wrapperProps[key] = { type: childType, value: child };
				}
			}
		}

		if (impl && (typeof impl === "object" || typeof impl === "function")) {
			for (const key of implOwnKeys) {
				let child;
				try {
					child = impl[key];
				} catch (err) {
					implProps[key] = { error: err.message };
					continue;
				}

				const childType = typeof child;
				if (child && (childType === "object" || childType === "function")) {
					implProps[key] = collectApiTree(child, `${path}.${String(key)}`);
				} else {
					implProps[key] = { type: childType, value: child };
				}
			}
		}

		return {
			path,
			type,
			wrapper: {
				materialized: state?.materialized ?? null,
				inFlight: state?.inFlight ?? null,
				ownKeys: wrapperOwnKeys,
				descriptors: isWrapper ? null : Object.getOwnPropertyDescriptors(node),
				inspect: isWrapper ? null : util.inspect(node, { depth: null, colors: false, showHidden: true, getters: true })
			},
			impl: {
				type: implType,
				ownKeys: implOwnKeys,
				descriptors: impl ? Object.getOwnPropertyDescriptors(impl) : null,
				inspect: util.inspect(impl, { depth: null, colors: false, showHidden: true, getters: true })
			},
			wrapperProps,
			implProps
		};
	};

	return collectApiTree(api, name);
}

/**
 * @private
 * @param {string} filePath
 * @param {string} eagerDump
 * @param {string} lazyDump
 * @returns {Promise<void>}
 *
 * @description
 * Writes eager and lazy API dumps to a Markdown file.
 *
 * @example
 * await writeDumpFile("tmp/api-dumps.md", eagerDump, lazyDump);
 */
async function writeDumpFile(filePath, eagerDump, lazyDump) {
	const wrappedContent = `# API Dumps\n\n## EAGER API\n\n\
\
\
${eagerDump}\n\n## LAZY API\n\n\
\
\
${lazyDump}\n`;
	const content = wrappedContent
		.replace("## EAGER API\n\n", "## EAGER API\n\n```js\n")
		.replace("\n\n## LAZY API", "\n```\n\n## LAZY API\n\n```js\n")
		.concat("\n```");

	await writeFile(filePath, content, "utf8");
}

async function runTests() {
	console.log("Unified Wrapper Test - Lazy vs Eager with AsyncLocalStorage\n");

	const totalStart = performance.now();

	const eagerApi = await testMode("eager");
	const lazyApi = await testMode("lazy");
	await testContextIsolation();

	const eagerDump = util.inspect(dumpApiTree("api", eagerApi), { depth: null, colors: false, showHidden: true, getters: true });
	const lazyDump = util.inspect(dumpApiTree("api", lazyApi), { depth: null, colors: false, showHidden: true, getters: true });
	await writeDumpFile("tmp/api-dumps.md", eagerDump, lazyDump);
	console.log("\nAPI dumps written to tmp/api-dumps.md");

	await testImplReplacement("eager", eagerApi);
	await testImplReplacement("lazy", lazyApi);

	const totalTime = performance.now() - totalStart;

	console.log("\n" + "=".repeat(60));
	console.log(`All Tests Complete! Total time: ${formatTime(totalTime)}`);
	console.log("=".repeat(60));
}

runTests().catch(console.error);
