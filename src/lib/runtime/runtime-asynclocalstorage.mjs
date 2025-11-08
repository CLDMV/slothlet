/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /src/lib/runtime/runtime.mjs
 *	@Date: 2025-10-21 16:20:59 -07:00 (1761088859)
 *	@Author: Nate Hyson <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Hyson <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2025-10-22 07:55:42 -07:00 (1761144942)
 *	-----
 *	@Copyright: Copyright (c) 2013-2025 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Runtime utilities for AsyncLocalStorage context management.
 * @module @cldmv/slothlet/runtime
 * @memberof module:@cldmv/slothlet
 * @public
 * @simpleName
 *
 * @description
 * Provides AsyncLocalStorage-based context isolation for slothlet instances,
 * enabling per-instance live bindings and context management across async operations.
 *
 * @example
 * // ESM usage (public API)
 * import { self, context, reference } from "@cldmv/slothlet/runtime";
 *
 * @example
 * // CJS usage (public API)
 * const { self, context, reference } = require("@cldmv/slothlet/runtime");
 */

import { AsyncLocalStorage } from "node:async_hooks";
import util from "node:util";
import { enableAlsForEventEmitters } from "@cldmv/slothlet/helpers/als-eventemitter";

const als = new AsyncLocalStorage();

/**
 * Shared AsyncLocalStorage instance for all slothlet instances.
 * Provides unified context management across all EventEmitter wrappers.
 * @type {AsyncLocalStorageType}
 * @public
 */
export const sharedALS = new AsyncLocalStorage();

// Enable AsyncLocalStorage context propagation for all EventEmitter instances
enableAlsForEventEmitters(als);

/**
 * @function runWithCtx
 * @package
 * @param {object} ctx - The context object containing self, context, and reference
 * @param {Function} fn - The function to execute
 * @param {any} thisArg - The 'this' argument for the function
 * @param {Array} args - Arguments to pass to the function
 * @returns {any} The result of the function execution
 * @throws {Error} When function execution fails
 *
 * @description
 * Run a function under the provided instance context using AsyncLocalStorage.
 *
 * @example
 * // Execute function with context
 * const result = runWithCtx(ctx, myFunction, this, [arg1, arg2]);
 */
export const runWithCtx = (ctx, fn, thisArg, args) => {
	/**
	 * @function runtime_runInALS
	 * @internal
	 * @private
	 * @returns {any} The result of the function execution
	 *
	 * @description
	 * Inner function that executes within AsyncLocalStorage context.
	 *
	 * @example
	 * // Internal execution within ALS context
	 * const result = runtime_runInALS();
	 */
	const runtime_runInALS = () => {
		const result = Reflect.apply(fn, thisArg, args);
		return result;
	};
	return als.run(ctx, runtime_runInALS);
};

/**
 * @function getCtx
 * @package
 * @returns {object|null} The current ALS context or null if not in context
 *
 * @description
 * Get the current AsyncLocalStorage context.
 *
 * @example
 * // Get current context
 * const ctx = getCtx();
 * if (ctx) {
 *   console.log("Current context:", ctx);
 * }
 */
export const getCtx = () => als.getStore() || null;

// Set of constructors to exclude from being considered as class instances
const EXCLUDED_CONSTRUCTORS = new Set([Object, Array, Promise, Date, RegExp, Error]);

// Array of constructor functions for instanceof checks
const EXCLUDED_INSTANCEOF_CLASSES = [ArrayBuffer, Map, Set, WeakMap, WeakSet];

// Promise method names that need special context-preserving handling
const PROMISE_METHODS = new Set(["then", "catch", "finally"]);

/**
 * @function runtime_shouldWrapMethod
 * @internal
 * @private
 * @param {any} value - The property value to check
 * @param {string|symbol} prop - The property name
 * @returns {boolean} True if the method should be wrapped
 *
 * @description
 * Determines if a method should be wrapped with context preservation.
 * Excludes built-in methods, constructors, and internal methods.
 *
 * @example
 * // Check if method should be wrapped
 * const shouldWrap = runtime_shouldWrapMethod(obj.method, 'method');
 */
function runtime_shouldWrapMethod(value, prop) {
	return (
		typeof value === "function" &&
		typeof prop === "string" && // Exclude symbol properties
		prop !== "constructor" &&
		!(prop in Object.prototype) &&
		!prop.startsWith("__")
	);
}

/**
 * @function runtime_isClassInstance
 * @internal
 * @private
 * @param {any} val - The value to check
 * @returns {boolean} True if the value is a class instance that should be wrapped
 *
 * @description
 * Determines if a value is a class instance (not a plain object, array, or primitive)
 * that should have its methods wrapped to preserve AsyncLocalStorage context.
 * Uses systematic exclusion lists for better maintainability.
 *
 * @example
 * // Check if value is a class instance
 * const isInstance = runtime_isClassInstance(new MyClass());
 */
function runtime_isClassInstance(val) {
	if (
		val == null ||
		typeof val !== "object" ||
		!val.constructor ||
		typeof val.constructor !== "function" ||
		EXCLUDED_CONSTRUCTORS.has(val.constructor)
	) {
		return false;
	}

	for (const cls of EXCLUDED_INSTANCEOF_CLASSES) {
		if (typeof cls === "function" && val instanceof cls) {
			return false;
		}
	}

	return true;
}

/**
 * @function runtime_wrapClassInstance
 * @internal
 * @private
 * @param {object} instance - The class instance to wrap
 * @param {object} ctx - The AsyncLocalStorage context to preserve
 * @param {Function} wrapFn - The wrap function for recursive wrapping
 * @param {WeakMap} instanceCache - The cache for wrapped instances
 * @returns {Proxy} A proxied instance with context-aware method calls
 *
 * @description
 * Wraps a class instance so that all method calls maintain the AsyncLocalStorage context.
 * This ensures that calls to methods on returned class instances preserve the slothlet
 * context for runtime imports like `self` and `context`.
 *
 * @example
 * // Wrap a class instance to preserve context
 * const wrappedInstance = runtime_wrapClassInstance(instance, ctx, wrap, instanceCache);
 */
function runtime_wrapClassInstance(instance, ctx, wrapFn, instanceCache) {
	if (instanceCache.has(instance)) {
		return instanceCache.get(instance);
	}

	// Cache for wrapped methods to avoid creating new function instances on repeated access
	const methodCache = new Map();

	const wrappedInstance = new Proxy(instance, {
		get(target, prop, receiver) {
			// Check method cache first to avoid unnecessary property access and function creation
			if (methodCache.has(prop)) {
				return methodCache.get(prop);
			}

			const value = Reflect.get(target, prop, receiver);

			// If it's a method (function), wrap it to preserve context
			// Exclude constructor, Object.prototype methods, and double-underscore methods to avoid introspection issues
			if (runtime_shouldWrapMethod(value, prop)) {
				// Function creation only occurs on cache miss - subsequent accesses return cached wrapper
				/**
				 * @function runtime_contextPreservingMethod
				 * @internal
				 * @private
				 * @param {...any} args - Arguments to pass to the original method
				 * @returns {any} Result from the original method call, recursively wrapped if needed
				 *
				 * @description
				 * Wrapper function that executes the original method within the AsyncLocalStorage context
				 * and recursively wraps the return value to maintain context preservation chain.
				 * Note: wrapFn includes circular reference protection via WeakMap cache.
				 *
				 * @example
				 * // Method wrapper that preserves context
				 * const result = runtime_contextPreservingMethod(arg1, arg2);
				 */
				const runtime_contextPreservingMethod = function (...args) {
					const result = runWithCtx(ctx, value, target, args);
					// wrapFn handles circular reference detection via WeakMap cache
					return wrapFn(result);
				};

				// Cache the wrapped method for future access - prevents recreation on subsequent calls
				methodCache.set(prop, runtime_contextPreservingMethod);
				return runtime_contextPreservingMethod;
			}

			// For non-function properties, recursively wrap if needed
			return wrapFn(value);
		},

		set(target, prop, value, receiver) {
			// Clear method cache for this property if it's being overwritten
			if (methodCache.has(prop)) {
				methodCache.delete(prop);
			}
			return Reflect.set(target, prop, value, receiver);
		}
	});

	instanceCache.set(instance, wrappedInstance);
	return wrappedInstance;
}

/**
 * @function makeWrapper
 * @package
 * @param {object} ctx - The context object containing self, context, and reference
 * @returns {Function} A wrapping function that applies context to any value
 * @throws {Error} When context is invalid
 *
 * @description
 * Create a lazy, per-instance wrapper that runs any function call under the instance's ALS context.
 * Wraps lazily so methods added later are also covered with context isolation.
 *
 * @example
 * // Create wrapper for an instance context
 * const wrapper = makeWrapper(ctx);
 * const wrappedAPI = wrapper(api);
 *
 * @example
 * // All function calls will run with context
 * await wrappedAPI.someMethod(); // Executes with ctx in AsyncLocalStorage
 */
export const makeWrapper = (ctx) => {
	const cache = new WeakMap();
	const instanceCache = new WeakMap();
	const promiseMethodCache = new WeakMap(); // Memoize Promise method wrappers
	const wrap = (val) => {
		if (val == null || (typeof val !== "object" && typeof val !== "function")) return val;
		if (cache.has(val)) return cache.get(val);

		const proxied = new Proxy(val, {
			apply(target, thisArg, args) {
				// console.log("[DEBUG makeWrapper] Function call with context:", {
				// 	targetName: target.name || "anonymous",
				// 	ctxSelfType: typeof ctx.self,
				// 	ctxSelfKeys: Object.keys(ctx.self || {}),
				// 	ctxContextType: typeof ctx.context,
				// 	ctxContextKeys: Object.keys(ctx.context || {}),
				// 	ctxReferenceType: typeof ctx.reference,
				// 	ctxReferenceKeys: Object.keys(ctx.reference || {}),
				// 	hasRunWithCtx: typeof runWithCtx === "function"
				// });

				const result = runWithCtx(ctx, target, thisArg, args);

				// Auto-wrap returned class instances to preserve context for method calls
				if (runtime_isClassInstance(result)) {
					return runtime_wrapClassInstance(result, ctx, wrap, instanceCache);
				}

				return result;
			},
			construct(target, args, newTarget) {
				// If callers "new" a function off the API, preserve context too
				const result = runWithCtx(ctx, Reflect.construct, undefined, [target, args, newTarget]);

				// Auto-wrap constructed instances to preserve context for method calls
				if (runtime_isClassInstance(result)) {
					return runtime_wrapClassInstance(result, ctx, wrap, instanceCache);
				}

				return result;
			},
			get(target, prop, receiver) {
				const value = Reflect.get(target, prop, receiver);

				// Special handling for Promise methods to preserve prototype chain and context
				// Support both native Promises and thenables (objects with callable 'then')
				const isPromiseMethod = typeof value === "function" && PROMISE_METHODS.has(prop);
				const isNativePromise = util.types.isPromise(target);
				const hasThen = typeof target?.then === "function";

				if (isPromiseMethod && (isNativePromise || hasThen)) {
					// Memoize Promise method wrappers to preserve function identity
					let targetMethodCache = promiseMethodCache.get(target);
					if (!targetMethodCache) {
						targetMethodCache = new Map();
						promiseMethodCache.set(target, targetMethodCache);
					}

					if (targetMethodCache.has(prop)) {
						return targetMethodCache.get(prop);
					}

					const wrappedMethod = function (...args) {
						// Wrap callback functions to preserve runtime context
						const wrappedArgs = args.map((arg) => {
							if (typeof arg === "function") {
								return function (...callbackArgs) {
									return runWithCtx(ctx, arg, undefined, callbackArgs);
								};
							}
							return arg;
						});

						// Use Reflect.apply for cross-realm safety and avoid overridden apply
						const result = Reflect.apply(value, target, wrappedArgs);
						// The result might be a new Promise that also needs context wrapping
						return wrap(result);
					};

					targetMethodCache.set(prop, wrappedMethod);
					return wrappedMethod;
				}

				return wrap(value);
			},
			set(target, prop, value, receiver) {
				// Invalidate cached Promise method wrapper for this (target, prop)
				const methodCache = promiseMethodCache.get(target);
				if (methodCache && methodCache.has(prop)) {
					methodCache.delete(prop);
				}
				return Reflect.set(target, prop, value, receiver);
			},
			defineProperty: Reflect.defineProperty,
			deleteProperty(target, prop) {
				// Invalidate cached Promise method wrapper for this (target, prop)
				const methodCache = promiseMethodCache.get(target);
				if (methodCache && methodCache.has(prop)) {
					methodCache.delete(prop);
				}
				return Reflect.deleteProperty(target, prop);
			},
			ownKeys: Reflect.ownKeys,
			getOwnPropertyDescriptor: Reflect.getOwnPropertyDescriptor,
			has: Reflect.has
		});

		cache.set(val, proxied);
		return proxied;
	};
	return wrap;
};
/**
 * @function runtime_mutateLiveBinding
 * @internal
 * @private
 * @param {function|object} target - The target object or function to mutate
 * @param {string} contextKey - The key to read from the current context
 *
 * @description
 * Mutate a live-binding (object or function‑with‑methods) to match current ctx[contextKey].
 *
 * @example
 * // Mutate target to match current context value
 * runtime_mutateLiveBinding(target, 'self');
 */
function runtime_mutateLiveBinding(target, contextKey) {
	const ctx = getCtx();
	const source = ctx?.[contextKey];

	// Clear if no source
	if (!source) {
		for (const key of Object.keys(target)) {
			if (key !== "_impl") delete target[key];
		}
		return;
	}

	if (typeof source === "function") {
		// Ensure calls go to the current function
		/**
		 * @function runtime_forwardToSource
		 * @internal
		 * @private
		 * @param {...any} args - Arguments to forward to the source function
		 * @returns {any} Result from the source function
		 *
		 * @description
		 * Forwards calls to the current source function.
		 *
		 * @example
		 * // Forward call to source function
		 * const result = runtime_forwardToSource(arg1, arg2);
		 */
		const runtime_forwardToSource = (...args) => source(...args);
		target._impl = runtime_forwardToSource;

		// Reset existing props (except _impl) and copy function's own props
		for (const key of Object.keys(target)) {
			if (key !== "_impl") delete target[key];
		}
		for (const key of Object.getOwnPropertyNames(source)) {
			if (key !== "length" && key !== "name" && key !== "prototype" && key !== "_impl") {
				try {
					target[key] = source[key];
				} catch {
					// ignore
				}
			}
		}
	} else if (typeof source === "object" && source !== null) {
		// Reset and shallow-copy object props
		// When target is a function, preserve built-in function properties
		for (const key of Object.keys(target)) {
			if (key !== "_impl" && key !== "length" && key !== "name" && key !== "prototype") {
				delete target[key];
			}
		}
		for (const [key, value] of Object.entries(source)) {
			try {
				target[key] = value;
			} catch (error) {
				// Skip read-only properties like function 'name', 'length', etc.
				// This commonly occurs when reference object contains 'name' property
				// and target is a function (live binding target)
				if (error instanceof TypeError && error.message.includes("read only")) {
					continue;
				}
				// Re-throw other errors
				throw error;
			}
		}
		if (typeof source._impl === "function") {
			target._impl = source._impl;
		}
	}
}

/**
 * @function runtime_createLiveBinding
 * @internal
 * @private
 * @param {string} contextKey - The key in the context to create a live binding for
 * @returns {Proxy} A proxy that provides live access to the context value
 *
 * @description
 * Create a live binding that mutates from ALS on every access/log/JSON.
 *
 * @example
 * // Create a live binding for 'self' context key
 * const selfBinding = runtime_createLiveBinding("self");
 */
function runtime_createLiveBinding(contextKey) {
	// Function target gives us the *option* to be callable (self may be a function)
	/**
	 * @function runtime_liveBindingTarget
	 * @internal
	 * @private
	 *
	 * @description
	 * Function target that provides the option to be callable when self is a function.
	 *
	 * @example
	 * // Target function for live binding proxy
	 * runtime_liveBindingTarget();
	 */
	function runtime_liveBindingTarget() {}
	const liveBinding = runtime_liveBindingTarget;

	/**
	 * @function runtime_syncWithContext
	 * @internal
	 * @private
	 *
	 * @description
	 * Synchronizes the live binding with the current context value.
	 *
	 * @example
	 * // Sync binding with current context
	 * runtime_syncWithContext();
	 */
	const runtime_syncWithContext = () => runtime_mutateLiveBinding(liveBinding, contextKey);

	// Pretty rendering for console.log / util.inspect
	/**
	 * @function runtime_renderSnapshot
	 * @internal
	 * @private
	 * @param {any} val - The value to render for inspection
	 * @returns {object|any} Rendered snapshot for pretty printing
	 *
	 * @description
	 * Creates a pretty rendering for console.log / util.inspect.
	 *
	 * @example
	 * // Render function for inspection
	 * const snapshot = runtime_renderSnapshot(myFunction);
	 */
	const runtime_renderSnapshot = (val) => {
		if (typeof val === "function") {
			const name = val.name || "anonymous";
			const props = {};
			for (const k of Object.keys(val)) props[k] = val[k];
			// show function "identity" + enumerable props
			return { [`[Function: ${name}]`]: true, ...props };
		}
		return val;
	};

	const proxy = new Proxy(liveBinding, {
		// Allow calling when current value is a function
		apply(_t, thisArg, args) {
			const cur = getCtx()?.[contextKey];
			if (typeof cur === "function") {
				return Reflect.apply(cur, thisArg, args);
			}
			// Not callable right now; return the current value (or throw if you prefer)
			return cur;
		},
		construct(_t, args, newTarget) {
			const cur = getCtx()?.[contextKey];
			if (typeof cur === "function") {
				return Reflect.construct(cur, args, newTarget);
			}
			throw new TypeError(`${contextKey} is not a constructor`);
		},

		get(target, prop) {
			// Debug gate for non-existent path testing
			if (prop === "nonExistentTestProperty") {
				// console.log(`[DEBUG GATE] Accessing nonExistentTestProperty in ${contextKey} binding - this should not exist!`);
				// console.log(`[DEBUG GATE] Current context:`, getCtx());
				// console.log(`[DEBUG GATE] Context value for ${contextKey}:`, getCtx()?.[contextKey]);
				return undefined;
			}

			// Make logging/JSON/snapshot always reflect the *current* ctx value
			if (prop === util.inspect.custom) return runtime_inspectHandler;
			if (prop === "toJSON") return runtime_toJSONHandler;
			if (prop === "$value") return runtime_toJSONHandler;
			if (prop === Symbol.toPrimitive) {
				/**
				 * @function runtime_toPrimitiveHandler
				 * @internal
				 * @private
				 * @param {string} hint - Primitive conversion hint ("string", "number", or "default")
				 * @returns {any} Converted primitive value
				 *
				 * @description
				 * Handler for primitive conversion operations.
				 *
				 * @example
				 * // Primitive conversion handler
				 * const primitive = runtime_toPrimitiveHandler("string");
				 */
				const runtime_toPrimitiveHandler = (hint) => {
					const v = getCtx()?.[contextKey];
					return hint === "string" ? String(v) : v;
				};
				return runtime_toPrimitiveHandler;
			}

			// Always return property from current context value, not stale target
			/*
			const currentValue = getCtx()?.[contextKey];
			if (currentValue && typeof currentValue === "object") {
				return currentValue[prop];
			}
			if (typeof currentValue === "function" && prop in currentValue) {
				return currentValue[prop];
			}
			*/

			// Fallback to target if no current context
			runtime_syncWithContext();
			return target[prop];
		},

		set(target, prop, value) {
			runtime_syncWithContext();
			target[prop] = value;

			// Reflect writes into the current context object when it’s object-like
			const ctx = getCtx();
			if (ctx && ctx[contextKey] && typeof ctx[contextKey] === "object") {
				ctx[contextKey][prop] = value;
			}
			return true;
		},

		has(target, prop) {
			runtime_syncWithContext();
			return prop in target;
		},

		ownKeys(target) {
			runtime_syncWithContext();
			return Reflect.ownKeys(target);
		},

		getOwnPropertyDescriptor(target, prop) {
			runtime_syncWithContext();
			const descriptor = Reflect.getOwnPropertyDescriptor(target, prop);
			// For prototype property on functions, ensure we return undefined if it doesn't exist
			// This prevents the proxy invariant violation
			if (prop === "prototype" && !descriptor) {
				return undefined;
			}
			return descriptor;
		}
	});

	// Some tools inspect the underlying *target* directly — add hooks there as well
	/**
	 * @function runtime_inspectHandler
	 * @internal
	 * @private
	 * @returns {object|any} Rendered snapshot of current context value
	 *
	 * @description
	 * Handler for util.inspect custom inspection.
	 *
	 * @example
	 * // Custom inspect handler
	 * const inspected = runtime_inspectHandler();
	 */
	const runtime_inspectHandler = () => runtime_renderSnapshot(getCtx()?.[contextKey]);

	/**
	 * @function runtime_toJSONHandler
	 * @internal
	 * @private
	 * @returns {any} Current context value for JSON serialization
	 *
	 * @description
	 * Handler for JSON serialization.
	 *
	 * @example
	 * // JSON handler
	 * const jsonValue = runtime_toJSONHandler();
	 */
	const runtime_toJSONHandler = () => getCtx()?.[contextKey];

	Object.defineProperty(liveBinding, util.inspect.custom, { value: runtime_inspectHandler, enumerable: false });
	Object.defineProperty(liveBinding, "toJSON", { value: runtime_toJSONHandler, enumerable: false });

	// And on the proxy (console.log(proxy) should work in any case)
	// Object.defineProperty(proxy, util.inspect.custom, { value: () => renderSnapshot(getCtx()?.[contextKey]), enumerable: false });
	// Object.defineProperty(proxy, "toJSON", { value: () => getCtx()?.[contextKey], enumerable: false });

	return proxy;
}

// Export live bindings

/**
 * @constant self
 * @memberof module:@cldmv/slothlet/runtime
 * @export module:@cldmv/slothlet/runtime
 * @public
 * @type {function|object}
 *
 * @description
 * Live binding to the current instance's 'self' reference from AsyncLocalStorage context.
 *
 * @example
 * // Access current instance self
 * console.log(self); // Current slothlet instance
 */
export const self = runtime_createLiveBinding("self");

/**
 * @constant context
 * @memberof module:@cldmv/slothlet/runtime
 * @export module:@cldmv/slothlet/runtime
 * @public
 * @type {object}
 *
 * @description
 * Live binding to the current instance's 'context' data from AsyncLocalStorage context.
 *
 * @example
 * // Access current context data
 * console.log(context); // Current context object
 */
export const context = runtime_createLiveBinding("context");

/**
 * @constant reference
 * @memberof module:@cldmv/slothlet/runtime
 * @export module:@cldmv/slothlet/runtime
 * @public
 * @type {object}
 *
 * @description
 * Live binding to the current instance's 'reference' object from AsyncLocalStorage context.
 *
 * @example
 * // Access current reference object
 * console.log(reference); // Current reference data
 */
export const reference = runtime_createLiveBinding("reference");

/**
 * @typedef {import("node:async_hooks").AsyncLocalStorage} AsyncLocalStorageType
 */
