/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /src/lib/helpers/class-instance-wrapper.mjs
 *	@Date: 2026-01-29 03:08:11 -08:00 (1738150091)
 *	@Author: Nate Hyson <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Hyson <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-02-04 00:00:00 -08:00 (1770192000)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Class instance context wrapping for AsyncLocalStorage preservation
 * @module @cldmv/slothlet/helpers/class-instance-wrapper
 * @package
 *
 * @description
 * Provides detection and wrapping logic for class instances to preserve AsyncLocalStorage
 * context when methods are called on returned instances. Adapted from V2.3.0 implementation.
 */

import { EventEmitter } from "node:events";

/**
 * Excluded constructors that should NOT be wrapped
 * @constant
 * @private
 */
const EXCLUDED_CONSTRUCTORS = new Set([Object, Array, Promise, Date, RegExp, Error]);

/**
 * Excluded instanceof classes that should NOT be wrapped
 * Note: EventEmitter has built-in AsyncLocalStorage context propagation in Node.js
 * and should not be wrapped to avoid interfering with native behavior.
 * @constant
 * @private
 */
const EXCLUDED_INSTANCEOF_CLASSES = [ArrayBuffer, Map, Set, WeakMap, WeakSet, EventEmitter];

/**
 * @function runtime_shouldWrapMethod
 * @package
 * @param {*} value - The value to check
 * @param {string|symbol} prop - The property name
 * @returns {boolean} True if the method should be wrapped
 *
 * @description
 * Determines if a method should be wrapped with context preservation.
 * Excludes constructors, Object.prototype methods, and internal methods.
 *
 * @example
 * runtime_shouldWrapMethod(myInstance.method, "method"); // true
 * runtime_shouldWrapMethod(myInstance.constructor, "constructor"); // false
 */
export function runtime_shouldWrapMethod(value, prop) {
	return (
		typeof value === "function" &&
		typeof prop === "string" &&
		prop !== "constructor" &&
		!(prop in Object.prototype) &&
		!prop.startsWith("__")
	);
}

/**
 * @function runtime_isClassInstance
 * @package
 * @param {*} val - The value to check
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
export function runtime_isClassInstance(val) {
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
 * @package
 * @param {object} instance - The class instance to wrap
 * @param {object} contextManager - The context manager (async or live)
 * @param {string} instanceID - The slothlet instance ID
 * @param {WeakMap} instanceCache - The cache for wrapped instances
 * @returns {Proxy} A proxied instance with context-aware method calls
 *
 * @description
 * Wraps a class instance so that all method calls maintain the AsyncLocalStorage context.
 * This ensures that calls to methods on returned class instances preserve the slothlet
 * context for runtime imports like `self` and `context`.
 *
 * V3 Adaptation: Uses contextManager.runInContext() instead of V2's runWithCtx().
 *
 * @example
 * // Wrap a class instance to preserve context
 * const wrappedInstance = runtime_wrapClassInstance(instance, contextManager, instanceID, instanceCache);
 */
export function runtime_wrapClassInstance(instance, contextManager, instanceID, instanceCache) {
	if (instanceCache.has(instance)) {
		return instanceCache.get(instance);
	}

	// DEBUG logging
	// if (process.env.DEBUG_CLASS_WRAP === "1") {
	// 	console.log("[CLASS_WRAP] Wrapping class instance:", instance.constructor?.name || "Unknown");
	// 	console.log("[CLASS_WRAP] Instance keys:", Object.keys(instance).slice(0, 10));
	// }

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
			// Exclude constructor, Object.prototype methods, and double-underscore methods
			if (runtime_shouldWrapMethod(value, prop)) {
				const runtime_contextPreservingMethod = function (...args) {
					// V3: Use contextManager.runInContext() to execute in context
					// Pass: instanceID, function, thisArg (the instance), args
					const result = contextManager.runInContext(instanceID, value, target, args);

					// Recursively wrap returned class instances
					if (result != null && runtime_isClassInstance(result)) {
						return runtime_wrapClassInstance(result, contextManager, instanceID, instanceCache);
					}

					return result;
				};

				// Cache the wrapped method for future access - prevents recreation on subsequent calls
				methodCache.set(prop, runtime_contextPreservingMethod);
				return runtime_contextPreservingMethod;
			}

			// For non-function properties, recursively wrap if it's a class instance
			if (value != null && runtime_isClassInstance(value)) {
				return runtime_wrapClassInstance(value, contextManager, instanceID, instanceCache);
			}

			return value;
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
