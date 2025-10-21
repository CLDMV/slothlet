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
 * import { self, context, reference } from '@cldmv/slothlet/runtime';
 *
 * @example
 * // CJS usage (public API)
 * const { self, context, reference } = require('@cldmv/slothlet/runtime');
 */

import { AsyncLocalStorage } from "node:async_hooks";
import util from "node:util";

const als = new AsyncLocalStorage();

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
		// Debug: Log what arguments are being passed to the function
		console.log(`[DEBUG runWithCtx] Calling function with ${args?.length || 0} arguments:`);
		args?.forEach((arg, index) => {
			console.log(
				`  runWithCtx arg ${index}: type=${typeof arg}, constructor=${arg?.constructor?.name}, isProxy=${typeof arg === "object" && arg.toString().includes("Proxy")}`
			);
		});

		const result = Reflect.apply(fn, thisArg, args);

		console.log(`[DEBUG runWithCtx] Function completed`);
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
 *   console.log('Current context:', ctx);
 * }
 */
export const getCtx = () => als.getStore() || null;

// Set of constructors to exclude from being considered as class instances
const EXCLUDED_CONSTRUCTORS = new Set([Object, Array, Promise, Date, RegExp, Error, Buffer]);

// Array of constructor functions for instanceof checks
const EXCLUDED_INSTANCEOF_CLASSES = [
	ArrayBuffer,
	Map,
	Set,
	WeakMap,
	WeakSet,
	Uint8Array,
	Int8Array,
	Uint16Array,
	Int16Array,
	Uint32Array,
	Int32Array,
	Float32Array,
	Float64Array
];

// Promise method names that need special context-preserving handling
const PROMISE_METHODS = new Set(["then", "catch", "finally"]);

// EventEmitter method names that accept callback functions as arguments
const EVENTEMITTER_METHODS = new Set([
	"on",
	"once",
	"addListener",
	"prependListener",
	"prependOnceListener",
	"removeListener",
	"off",
	"removeAllListeners"
]);

// EventEmitter callback position mapping - which argument position contains the callback
const EVENTEMITTER_CALLBACK_POSITIONS = new Map([
	["on", 1],
	["once", 1],
	["addListener", 1],
	["prependListener", 1],
	["prependOnceListener", 1],
	["removeListener", 1],
	["off", 1]
]);

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
			// Debug EventEmitter method access
			if (prop === "on" && typeof target?.on === "function" && typeof target?.emit === "function") {
				console.log(`[DEBUG Proxy] Accessing '${prop}' on EventEmitter-like object:`, {
					constructor: target?.constructor?.name,
					hasOn: typeof target?.on === "function",
					hasEmit: typeof target?.emit === "function"
				});
			}

			// Check method cache first to avoid unnecessary property access and function creation
			if (methodCache.has(prop)) {
				return methodCache.get(prop);
			}

			const value = Reflect.get(target, prop, receiver);

			// Special handling for EventEmitter methods to preserve context in event callbacks
			// Detect EventEmitter instances by checking for 'on' and 'emit' methods
			const isEventEmitterMethod = typeof value === "function" && EVENTEMITTER_METHODS.has(prop);
			const hasOnMethod = typeof target?.on === "function";
			const hasEmitMethod = typeof target?.emit === "function";
			const isEventEmitter = hasOnMethod && hasEmitMethod;

			// Debug EventEmitter detection for class instances
			if (prop === "on" || isEventEmitterMethod) {
				console.log(`[DEBUG ClassInstance] EventEmitter detection for '${prop}':`, {
					isEventEmitterMethod,
					hasOnMethod,
					hasEmitMethod,
					isEventEmitter,
					valueType: typeof value,
					targetConstructor: target?.constructor?.name,
					eventemitterMethodsHasProp: EVENTEMITTER_METHODS.has(prop)
				});
			}

			if (isEventEmitterMethod && isEventEmitter) {
				// Check if this method accepts a callback at a known position
				const callbackPosition = EVENTEMITTER_CALLBACK_POSITIONS.get(prop);

				if (callbackPosition !== undefined) {
					console.log(`[DEBUG ClassInstance] Creating EventEmitter wrapper for ${prop} on ${target?.constructor?.name}`);
					/**
					 * @function runtime_classInstanceEventEmitterMethodWrapper
					 * @internal
					 * @private
					 * @param {...any} args - Arguments passed to the EventEmitter method
					 * @returns {any} Result from the original EventEmitter method
					 */
					const runtime_classInstanceEventEmitterMethodWrapper = function (...args) {
						console.log(`[DEBUG ClassInstance] ${target?.constructor?.name}.${prop}() called with ${args.length} arguments`);
						console.log(`[DEBUG ClassInstance] Checking callback wrapping conditions:`, {
							argsLength: args.length,
							callbackPosition,
							hasCallbackArg: args.length > callbackPosition,
							callbackArgType: typeof args[callbackPosition],
							isFunction: typeof args[callbackPosition] === "function"
						});

						// Clone args array to avoid mutating the original
						const wrappedArgs = [...args];

						// Wrap the callback function at the specified position if it exists and is a function
						if (args.length > callbackPosition && typeof args[callbackPosition] === "function") {
							const originalCallback = args[callbackPosition];
							console.log(
								`[DEBUG ClassInstance] Wrapping callback at position ${callbackPosition} for ${target?.constructor?.name}.${prop}()`
							);

							wrappedArgs[callbackPosition] = function (...callbackArgs) {
								// Debug: Log callback argument wrapping for class instances
								console.log(`[DEBUG ClassInstance] EventEmitter callback for ${prop} - wrapping ${callbackArgs.length} arguments`);
								callbackArgs.forEach((arg, index) => {
									console.log(
										`  Arg ${index}: type=${typeof arg}, constructor=${arg?.constructor?.name}, needsWrap=${arg != null && (typeof arg === "object" || typeof arg === "function")}`
									);
								});

								// Also wrap the callback arguments (like socket instances) to preserve context in nested callbacks
								const wrappedCallbackArgs = callbackArgs.map((arg, index) => {
									const wrapped = wrapFn(arg);
									console.log(`  Wrapped arg ${index}: same=${wrapped === arg}, isProxy=${typeof wrapped === "object" && wrapped !== arg}`);
									console.log(`  Wrapped arg ${index} constructor:`, wrapped?.constructor?.name);
									console.log(`  Wrapped arg ${index} toString:`, wrapped.toString());
									return wrapped;
								});

								console.log(`[DEBUG ClassInstance] About to call original callback with ${wrappedCallbackArgs.length} wrapped args`);
								wrappedCallbackArgs.forEach((arg, index) => {
									console.log(`  Pre-call wrapped arg ${index}: type=${typeof arg}, constructor=${arg?.constructor?.name}`);
								});

								const result = runWithCtx(ctx, originalCallback, this, wrappedCallbackArgs);

								console.log(`[DEBUG ClassInstance] Original callback completed`);
								return result;
							};
						}

						// Use Reflect.apply for cross-realm safety
						const result = Reflect.apply(value, target, wrappedArgs);
						console.log(`[DEBUG ClassInstance] ${target?.constructor?.name}.${prop}() returned:`, typeof result);
						return result;
					};

					methodCache.set(prop, runtime_classInstanceEventEmitterMethodWrapper);
					return runtime_classInstanceEventEmitterMethodWrapper;
				}
			}

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
 * @function runtime_createEventEmitterHook
 * @internal
 * @private
 * @param {Function} wrapFn - The wrapper function
 * @returns {object} Hook object with cleanup method
 *
 * @description
 * Creates a hook that automatically wraps EventEmitter objects during function execution.
 * This ensures EventEmitters are wrapped immediately when created, not just when returned.
 *
 * @example
 * // Create auto-wrapping hook
 * const hook = runtime_createEventEmitterHook(wrap);
 * // ... function execution ...
 * hook.cleanup();
 */
function runtime_createEventEmitterHook(_) {
	// Return a no-op hook since we don't need module-specific interception
	// The emit interception in runtime_deepWrapEventEmitters handles all cases
	return {
		cleanup() {
			// No cleanup needed
		}
	};
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

		// Skip wrapping for problematic built-in objects that cause proxy issues
		if (
			val instanceof Buffer ||
			val instanceof ArrayBuffer ||
			val instanceof Uint8Array ||
			val instanceof Int8Array ||
			val instanceof Uint16Array ||
			val instanceof Int16Array ||
			val instanceof Uint32Array ||
			val instanceof Int32Array ||
			val instanceof Float32Array ||
			val instanceof Float64Array
		) {
			return val;
		}

		// Debug: Log what we're wrapping
		// console.log(`[DEBUG wrap] Wrapping object:`, {
		// 	type: typeof val,
		// 	constructor: val?.constructor?.name,
		// 	isClassInstance: runtime_isClassInstance(val),
		// 	hasOn: typeof val?.on === "function",
		// 	hasEmit: typeof val?.emit === "function",
		// 	hasServerProperty: val?.server !== undefined
		// });

		// Prioritize EventEmitter-like objects for immediate wrapping
		// This ensures Node.js objects like net.Server get wrapped before their methods are called
		const hasOnMethod = typeof val?.on === "function";
		const hasEmitMethod = typeof val?.emit === "function";
		const isEventEmitterLike = hasOnMethod && hasEmitMethod;

		if (isEventEmitterLike && runtime_isClassInstance(val)) {
			console.log(`[DEBUG wrap] Auto-wrapping EventEmitter-like class instance:`, {
				constructor: val?.constructor?.name,
				hasOn: hasOnMethod,
				hasEmit: hasEmitMethod
			});
			const wrapped = runtime_wrapClassInstance(val, ctx, wrap, instanceCache);
			cache.set(val, wrapped);
			return wrapped;
		}

		// Auto-wrap other class instances immediately to enable method context preservation
		if (runtime_isClassInstance(val)) {
			console.log(`[DEBUG wrap] Auto-wrapping non-EventEmitter class instance:`, {
				constructor: val?.constructor?.name,
				hasOn: typeof val?.on === "function",
				hasEmit: typeof val?.emit === "function"
			});
			const wrapped = runtime_wrapClassInstance(val, ctx, wrap, instanceCache);
			cache.set(val, wrapped);
			return wrapped;
		}

		// Special handling for Promises to wrap resolved values
		const isPromise = val && typeof val.then === "function";
		if (isPromise) {
			console.log(`[DEBUG wrap] Wrapping Promise to auto-wrap resolved values`);

			// Create a new Promise that wraps the resolved value
			const wrappedPromise = val.then((resolvedValue) => {
				console.log(`[DEBUG Promise] Wrapping resolved value:`, {
					valueType: typeof resolvedValue,
					valueConstructor: resolvedValue?.constructor?.name,
					hasServerProperty: resolvedValue?.server !== undefined
				});

				// Deep scan for EventEmitters in the resolved value
				console.log("[DEBUG Promise] Starting deep EventEmitter scan...");
				console.log("[DEBUG Promise] Resolved value details:", {
					type: typeof resolvedValue,
					constructor: resolvedValue?.constructor?.name,
					hasServer: resolvedValue?.server !== undefined,
					serverType: typeof resolvedValue?.server,
					serverConstructor: resolvedValue?.server?.constructor?.name,
					serverHasOn: typeof resolvedValue?.server?.on === "function",
					serverHasEmit: typeof resolvedValue?.server?.emit === "function"
				});
				runtime_deepWrapEventEmitters(resolvedValue, wrap);
				console.log("[DEBUG Promise] Deep EventEmitter scan completed");

				return wrap(resolvedValue);
			});

			cache.set(val, wrappedPromise);
			return wrappedPromise;
		}

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

				// Store the current context for potential EventEmitter auto-wrapping
				const enhancedContext = { ...ctx, _wrapFn: wrap };

				const result = als.run(enhancedContext, () => {
					// Set up automatic EventEmitter wrapping during this function call
					const eventEmitterHook = runtime_createEventEmitterHook(wrap);

					try {
						return Reflect.apply(target, thisArg, args);
					} finally {
						eventEmitterHook.cleanup();
					}
				});

				// Auto-wrap all return values recursively to catch class instances in nested objects
				// This ensures that objects like { server, port } get their server property wrapped
				console.log(`[DEBUG] Auto-wrapping function result:`, {
					functionName: target?.name || "anonymous",
					resultType: typeof result,
					resultConstructor: result?.constructor?.name,
					isClassInstance: runtime_isClassInstance(result),
					isEventEmitter: result && typeof result.on === "function" && typeof result.emit === "function"
				});

				// Special handling: if the result is an EventEmitter-like object, wrap it immediately
				// This ensures objects like net.createServer() are wrapped before .on() is called
				if (result && typeof result.on === "function" && typeof result.emit === "function" && runtime_isClassInstance(result)) {
					console.log(`[DEBUG] Auto-wrapping EventEmitter function result:`, {
						functionName: target?.name || "anonymous",
						resultConstructor: result?.constructor?.name
					});
					return wrap(result);
				}

				return wrap(result);
			},
			construct(target, args, newTarget) {
				// If callers "new" a function off the API, preserve context too
				const result = runWithCtx(ctx, Reflect.construct, undefined, [target, args, newTarget]);

				// Auto-wrap all constructed values recursively to catch class instances
				return wrap(result);
			},
			get(target, prop, receiver) {
				const value = Reflect.get(target, prop, receiver);

				// Debug EventEmitter detection for 'on' method calls
				if (prop === "on" && typeof value === "function") {
					console.log(`[DEBUG] Accessing 'on' method on:`, {
						targetType: typeof target,
						targetConstructor: target?.constructor?.name,
						hasOn: typeof target?.on === "function",
						hasEmit: typeof target?.emit === "function",
						valueType: typeof value
					});
				}

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

						// Auto-wrap EventEmitter objects immediately when they're returned from function calls
						// This ensures objects like net.createServer() are wrapped before .on() calls happen
						let processedResult = result;
						if (result && typeof result === "object" && typeof result.on === "function" && typeof result.emit === "function") {
							console.log(`[DEBUG EventEmitter] Auto-wrapping EventEmitter from function call:`, result.constructor?.name);
							processedResult = wrap(result);
						}

						// Recursively auto-wrap any EventEmitter objects in the result
						runtime_deepWrapEventEmitters(processedResult, wrap);

						// The result might be a new Promise that also needs context wrapping
						const wrappedResult = wrap(processedResult);

						// For Promise resolution, we need to wrap the resolved value when it becomes available
						if (wrappedResult && typeof wrappedResult.then === "function") {
							return wrappedResult.then((resolvedValue) => {
								console.log(`[DEBUG Promise] Wrapping resolved value:`, {
									valueType: typeof resolvedValue,
									valueConstructor: resolvedValue?.constructor?.name,
									hasServerProperty: resolvedValue?.server !== undefined
								});

								// Deep scan for EventEmitters in the resolved value
								console.log("[DEBUG Promise] Starting deep EventEmitter scan...");
								console.log("[DEBUG Promise] Resolved value details:", {
									type: typeof resolvedValue,
									constructor: resolvedValue?.constructor?.name,
									hasServer: resolvedValue?.server !== undefined,
									serverType: typeof resolvedValue?.server,
									serverConstructor: resolvedValue?.server?.constructor?.name,
									serverHasOn: typeof resolvedValue?.server?.on === "function",
									serverHasEmit: typeof resolvedValue?.server?.emit === "function"
								});
								runtime_deepWrapEventEmitters(resolvedValue, wrap);
								console.log("[DEBUG Promise] Deep EventEmitter scan completed");

								return wrap(resolvedValue);
							});
						}

						return wrappedResult;
					};

					targetMethodCache.set(prop, wrappedMethod);
					return wrappedMethod;
				}

				// Special handling for EventEmitter methods to preserve context in event callbacks
				// Detect EventEmitter instances by checking for 'on' and 'emit' methods
				const isEventEmitterMethod = typeof value === "function" && EVENTEMITTER_METHODS.has(prop);
				const hasOnMethod = typeof target?.on === "function";
				const hasEmitMethod = typeof target?.emit === "function";
				const isEventEmitter = hasOnMethod && hasEmitMethod;

				// Debug EventEmitter detection for ALL methods
				if (prop === "on" || isEventEmitterMethod) {
					console.log(`[DEBUG] EventEmitter detection for '${prop}':`, {
						isEventEmitterMethod,
						hasOnMethod,
						hasEmitMethod,
						isEventEmitter,
						valueType: typeof value,
						targetConstructor: target?.constructor?.name,
						eventemitterMethodsHasProp: EVENTEMITTER_METHODS.has(prop)
					});
				}

				if (isEventEmitterMethod && isEventEmitter) {
					// Check if this method accepts a callback at a known position
					const callbackPosition = EVENTEMITTER_CALLBACK_POSITIONS.get(prop);

					if (callbackPosition !== undefined) {
						/**
						 * @function runtime_eventEmitterMethodWrapper
						 * @internal
						 * @private
						 * @param {...any} args - Arguments passed to the EventEmitter method
						 * @returns {any} Result from the original EventEmitter method
						 *
						 * @description
						 * Wrapper for EventEmitter methods that automatically preserves AsyncLocalStorage
						 * context in event handler callbacks without requiring consumer changes.
						 */
						const runtime_eventEmitterMethodWrapper = function (...args) {
							// Clone args array to avoid mutating the original
							const wrappedArgs = [...args];

							// Wrap the callback function at the specified position if it exists and is a function
							if (args.length > callbackPosition && typeof args[callbackPosition] === "function") {
								const originalCallback = args[callbackPosition];
								wrappedArgs[callbackPosition] = function (...callbackArgs) {
									// Debug: Log callback argument wrapping
									console.log(`[DEBUG] EventEmitter callback for ${prop} - wrapping ${callbackArgs.length} arguments`);
									callbackArgs.forEach((arg, index) => {
										console.log(
											`  Arg ${index}: type=${typeof arg}, constructor=${arg?.constructor?.name}, needsWrap=${arg != null && (typeof arg === "object" || typeof arg === "function")}`
										);
									});

									// Also wrap the callback arguments (like socket instances) to preserve context in nested callbacks
									const wrappedCallbackArgs = callbackArgs.map((arg, index) => {
										const wrapped = wrap(arg);
										console.log(`  Wrapped arg ${index}: same=${wrapped === arg}, isProxy=${wrapped.toString().includes("Proxy")}`);
										return wrapped;
									});
									return runWithCtx(ctx, originalCallback, this, wrappedCallbackArgs);
								};
							}

							// Use Reflect.apply for cross-realm safety
							const result = Reflect.apply(value, target, wrappedArgs);
							// Return the result (usually the EventEmitter instance for chaining)
							return wrap(result);
						};

						return runtime_eventEmitterMethodWrapper;
					}
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

	// Auto-wrap EventEmitters created by common Node.js functions during API execution
	runtime_interceptEventEmitterConstructors(ctx, wrap);

	return wrap;
};

/**
 * @function runtime_interceptEventEmitterConstructors
 * @internal
 * @private
 * @param {object} ctx - The AsyncLocalStorage context
 * @param {Function} wrapFn - The wrapper function
 *
 * @description
 * Intercepts Node.js EventEmitter constructor functions to automatically wrap
 * their results when called from within slothlet API execution context.
 */
function runtime_interceptEventEmitterConstructors(_) {
	// Only patch if we're in Node.js environment
	if (typeof globalThis.process === "undefined" || !globalThis.process.versions?.node) {
		return;
	}

	// Track if we've already patched to avoid double-patching
	if (globalThis._slothletIntercepted) {
		return;
	}
	globalThis._slothletIntercepted = true;
}

/**
 * @function runtime_deepWrapEventEmitters
 * @internal
 * @private
 * @param {any} obj - Object to scan for EventEmitter instances
 * @param {Function} wrapFn - The wrapper function
 *
 * @description
 * Recursively scans an object for EventEmitter instances and wraps them.
 * This catches EventEmitter objects regardless of how they were created.
 */
function runtime_deepWrapEventEmitters(obj, wrapFn) {
	// Avoid infinite recursion and only process objects
	if (!obj || typeof obj !== "object" || obj._slothletScanned) {
		return;
	}

	// Mark as scanned to avoid cycles
	try {
		Object.defineProperty(obj, "_slothletScanned", {
			value: true,
			writable: false,
			enumerable: false,
			configurable: true
		});
	} catch (_) {
		// Ignore if we can't mark it (some objects are sealed)
		return;
	}

	// Check if this object is an EventEmitter (but not a lazy proxy)
	if (typeof obj.on === "function" && typeof obj.emit === "function") {
		// Additional check: lazy proxies have __materialized property, real EventEmitters don't
		if (obj.__materialized !== undefined || obj._materialize !== undefined) {
			// This is a lazy proxy, not a real EventEmitter - skip it
			return;
		}

		// Found an EventEmitter! We need to wrap it in place

		// Store original methods
		const originalOn = obj.on;
		const originalOnce = obj.once;
		const originalEmit = obj.emit;

		// Replace the emit method to wrap callback arguments dynamically
		obj.emit = function runtime_wrappedEmit(event, ...args) {
			// Wrap any EventEmitter arguments passed to the event
			const wrappedArgs = args.map((arg) => {
				if (arg && typeof arg === "object" && typeof arg.on === "function" && typeof arg.emit === "function") {
					return wrapFn(arg);
				}
				return arg;
			});

			return originalEmit.call(this, event, ...wrappedArgs);
		};

		// Replace EventEmitter registration methods with wrapped versions for future listeners
		if (typeof originalOn === "function") {
			obj.on = function runtime_wrappedOn(event, callback) {
				if (typeof callback === "function") {
					// Wrap the callback to preserve context and auto-wrap arguments
					const wrappedCallback = function runtime_eventCallback(...args) {
						console.log(`[DEBUG DeepWrap] EventEmitter callback for '${event}' called with ${args.length} args`);

						// Auto-wrap any EventEmitter arguments (like socket)
						const wrappedArgs = args.map((arg, index) => {
							if (arg && typeof arg === "object" && typeof arg.on === "function" && typeof arg.emit === "function") {
								console.log(`[DEBUG DeepWrap] Auto-wrapping EventEmitter callback argument ${index}:`, arg.constructor?.name);
								return wrapFn(arg);
							}
							return arg;
						});

						// Execute callback in preserved context
						const currentStore = als.getStore();
						if (currentStore) {
							return als.run(currentStore, callback, ...wrappedArgs);
						}
						return callback(...wrappedArgs);
					};

					return originalOn.call(this, event, wrappedCallback);
				}
				return originalOn.call(this, event, callback);
			};
		}

		// Similar for once and addListener
		if (typeof originalOnce === "function") {
			obj.once = function runtime_wrappedOnce(event, callback) {
				if (typeof callback === "function") {
					const wrappedCallback = function runtime_eventOnceCallback(...args) {
						const wrappedArgs = args.map((arg) => {
							if (arg && typeof arg === "object" && typeof arg.on === "function" && typeof arg.emit === "function") {
								console.log(`[DEBUG DeepWrap] Auto-wrapping EventEmitter once callback argument:`, arg.constructor?.name);
								return wrapFn(arg);
							}
							return arg;
						});

						const currentStore = als.getStore();
						if (currentStore) {
							return als.run(currentStore, callback, ...wrappedArgs);
						}
						return callback(...wrappedArgs);
					};

					return originalOnce.call(this, event, wrappedCallback);
				}
				return originalOnce.call(this, event, callback);
			};
		}

		if (typeof originalAddListener === "function") {
			obj.addListener = obj.on; // addListener is typically an alias for on
		}
	}

	// Recursively scan object properties for nested EventEmitters
	try {
		for (const key in obj) {
			if (Object.prototype.hasOwnProperty.call(obj, key)) {
				runtime_deepWrapEventEmitters(obj[key], wrapFn);
			}
		}
	} catch (_) {
		// Ignore errors when scanning (some objects may have getters that throw)
	}
}

/**
 * @function runtime_mutateLiveBinding

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
		for (const key of Object.keys(target)) {
			if (key !== "_impl") delete target[key];
		}
		for (const [key, value] of Object.entries(source)) {
			target[key] = value;
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
 * const selfBinding = runtime_createLiveBinding('self');
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
				 * @param {string} hint - Primitive conversion hint ('string', 'number', or 'default')
				 * @returns {any} Converted primitive value
				 *
				 * @description
				 * Handler for primitive conversion operations.
				 *
				 * @example
				 * // Primitive conversion handler
				 * const primitive = runtime_toPrimitiveHandler('string');
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
			return Object.getOwnPropertyDescriptor(target, prop);
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
 * @function bindContext
 * @memberof module:@cldmv/slothlet/runtime
 * @export module:@cldmv/slothlet/runtime
 * @public
 * @param {Function} callback - The callback function to bind with current AsyncLocalStorage context
 * @returns {Function} A new function that preserves the AsyncLocalStorage context when called
 * @throws {TypeError} When callback is not a function
 *
 * @description
 * Binds the current AsyncLocalStorage context to a callback function, ensuring that
 * slothlet runtime imports (self, context, reference) remain accessible within the
 * callback even when it's executed in a different async execution context (such as
 * Node.js socket event handlers, timers, or other async operations).
 *
 * This is essential for preserving slothlet context across async boundaries where
 * AsyncLocalStorage context would normally be lost, such as:
 * - Socket event handlers (socket.on('data', callback))
 * - Timer callbacks (setTimeout, setInterval)
 * - EventEmitter listeners
 * - Promise executors and callbacks
 * - Stream handlers
 *
 * @example // ESM usage (socket event handler)
 * import { bindContext, self } from '@cldmv/slothlet/runtime';
 * import net from 'net';
 *
 * // Without bindContext - self would be empty in the callback
 * socket.on('data', (data) => {
 *   console.log(self); // {} - empty, context lost
 * });
 *
 * // With bindContext - self maintains the API context
 * socket.on('data', bindContext((data) => {
 *   console.log(self.tcp.handlers); // Available! Context preserved
 *   const response = await self.tcp.handlers.config.get('setting');
 * }));
 *
 * @example // ESM usage (timer callback)
 * import { bindContext, self, context } from '@cldmv/slothlet/runtime';
 *
 * setTimeout(bindContext(() => {
 *   console.log('API available:', !!self.api);
 *   console.log('User context:', context.user);
 * }), 1000);
 *
 * @example // CJS usage (socket event handler)
 * const { bindContext, self } = require('@cldmv/slothlet/runtime');
 * const net = require('net');
 *
 * socket.on('data', bindContext(async (data) => {
 *   const command = JSON.parse(data);
 *   const response = await self.tcp.handlers[command.type].handle(command);
 *   socket.write(JSON.stringify(response));
 * }));
 *
 * @example // CJS usage (EventEmitter)
 * const { bindContext, self, context } = require('@cldmv/slothlet/runtime');
 *
 * emitter.on('event', bindContext((eventData) => {
 *   self.logger.info('Event received', { eventData, user: context.user });
 * }));
 */
export function bindContext(callback) {
	if (typeof callback !== "function") {
		throw new TypeError("bindContext expects a function as the first argument");
	}

	// Capture the current AsyncLocalStorage context
	const currentContext = getCtx();

	if (!currentContext) {
		// If no context is available, return the original callback
		// This allows bindContext to be used safely even outside slothlet context
		return callback;
	}

	/**
	 * @function runtime_contextBoundCallback
	 * @internal
	 * @private
	 * @param {...any} args - Arguments passed to the original callback
	 * @returns {any} Result from the original callback execution
	 *
	 * @description
	 * Wrapper function that executes the original callback within the captured
	 * AsyncLocalStorage context, ensuring slothlet runtime imports remain accessible.
	 */
	const runtime_contextBoundCallback = function (...args) {
		return runWithCtx(currentContext, callback, this, args);
	};

	return runtime_contextBoundCallback;
}
