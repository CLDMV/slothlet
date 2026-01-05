/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /src/lib/helpers/utilities.mjs
 *	@Date: 2025-12-30 08:44:44 -08:00 (1767113084)
 *	@Author: Nate Hyson <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Hyson <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2025-12-30 08:54:56 -08:00 (1767113696)
 *	-----
 *	@Copyright: Copyright (c) 2013-2025 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Utility functions for property manipulation and object operations.
 * @module @cldmv/slothlet/lib/helpers/utilities
 * @memberof module:@cldmv/slothlet.lib.helpers
 * @internal
 * @private
 *
 * @description
 * Provides general-purpose utility functions for safe property definition, deep object merging,
 * and live-binding variable mutation. These utilities are used throughout slothlet for
 * object manipulation, property management, and live-binding operations.
 *
 * Exported Functions:
 * - safeDefine: Safe property definition handling non-configurable properties
 * - deepMerge: Recursive deep merge for object combining
 * - mutateLiveBindingFunction: Live-binding variable mutation preserving references
 *
 * @example
 * // Internal usage in slothlet
 * import { safeDefine, deepMerge, mutateLiveBindingFunction } from "./utilities.mjs";
 *
 * safeDefine(api, "shutdown", shutdownFunction, false);
 * const merged = deepMerge(target, source);
 * mutateLiveBindingFunction(boundapi, newApi);
 */

/**
 * Safely defines a property on an object, handling non-configurable properties.
 *
 * @function safeDefine
 * @memberof module:@cldmv/slothlet.lib.helpers.utilities
 * @param {object} obj - Target object
 * @param {string} key - Property key
 * @param {*} value - Property value
 * @param {boolean} [enumerable=false] - Whether the property should be enumerable (default: false for management methods)
 * @param {object} [config=null] - Optional configuration object with debug flag
 * @package
 *
 * @description
 * Attempts to define a property on an object with the specified configuration.
 * Handles cases where the property is non-configurable by logging a warning
 * instead of throwing an error. Used for safely attaching management methods
 * like shutdown, addApi, and describe to API objects.
 *
 * @example
 * // Internal usage
 * import { safeDefine } from "./utilities.mjs";
 *
 * safeDefine(api, "shutdown", shutdownFunction, false, { debug: true });
 */
export function safeDefine(obj, key, value, enumerable = false, config = null) {
	const desc = Object.getOwnPropertyDescriptor(obj, key);
	if (!desc) {
		Object.defineProperty(obj, key, {
			value,
			writable: true,
			configurable: true,
			enumerable
		});
	} else if (desc.configurable) {
		Object.defineProperty(obj, key, {
			value,
			writable: true,
			configurable: true,
			enumerable
		});
	} else if (config && config.debug) {
		console.warn(`Could not redefine boundApi.${key}: not configurable`);
	}
}

/**
 * Deep merge two objects recursively.
 *
 * @function deepMerge
 * @memberof module:@cldmv/slothlet.lib.helpers.utilities
 * @param {object} target - Target object to merge into
 * @param {object} source - Source object to merge from
 * @returns {object} Merged object (mutates target)
 * @package
 *
 * @description
 * Performs a recursive deep merge of two objects, combining nested structures.
 * Arrays are treated as primitive values and replaced rather than merged.
 * Used for context merging in scope operations.
 *
 * **Security Note**: This function explicitly blocks the `__proto__`, `prototype`, and
 * `constructor` keys to prevent prototype pollution attacks. Any attempt to merge
 * these dangerous keys will be silently ignored.
 *
 * @example
 * // Internal usage
 * import { deepMerge } from "./utilities.mjs";
 *
 * const target = { a: 1, b: { c: 2 } };
 * const source = { b: { d: 3 }, e: 4 };
 * const merged = deepMerge(target, source);
 * // Result: { a: 1, b: { c: 2, d: 3 }, e: 4 }
 */
export function deepMerge(target, source) {
	if (!source || typeof source !== "object" || Array.isArray(source)) {
		return source;
	}

	for (const key in source) {
		if (!Object.prototype.hasOwnProperty.call(source, key)) {
			continue;
		}

		// Prevent prototype pollution by blocking dangerous keys
		if (key === "__proto__" || key === "prototype" || key === "constructor") {
			continue;
		}

		const sourceValue = source[key];
		const targetValue = target[key];

		if (sourceValue && typeof sourceValue === "object" && !Array.isArray(sourceValue)) {
			target[key] = deepMerge(
				targetValue && typeof targetValue === "object" && !Array.isArray(targetValue) ? targetValue : {},
				sourceValue
			);
		} else {
			target[key] = sourceValue;
		}
	}

	return target;
}

/**
 * Mutates a live-binding variable (object or function) to match a new value, preserving reference.
 *
 * @function mutateLiveBindingFunction
 * @memberof module:@cldmv/slothlet.lib.helpers.utilities
 * @param {function|object} target - The variable to mutate (object or function)
 * @param {function|object} source - The new value to copy from (object or function)
 * @package
 *
 * @description
 * Mutates an existing live-binding variable to match a new structure while
 * preserving the original reference. This is critical for maintaining live
 * bindings in modules that have imported self, context, or reference.
 *
 * For functions: Sets _impl to call source, removes old properties (except _impl and __ctx),
 * and attaches new properties from source.
 *
 * For objects: Removes old properties (except _impl and __ctx), attaches new properties,
 * and manually copies management methods (shutdown, addApi, describe).
 *
 * @example
 * // Internal usage
 * import { mutateLiveBindingFunction } from "./utilities.mjs";
 *
 * mutateLiveBindingFunction(self, newSelf);
 * mutateLiveBindingFunction(boundapi, newApi);
 */
export function mutateLiveBindingFunction(target, source) {
	if (typeof source === "function") {
		target._impl = (...args) => source(...args);
		// Remove old methods except _impl and __ctx
		for (const key of Object.keys(target)) {
			if (key !== "_impl" && key !== "__ctx") delete target[key];
		}
		// Attach new methods using defineProperty to handle non-writable properties
		for (const key of Object.getOwnPropertyNames(source)) {
			if (key !== "length" && key !== "name" && key !== "prototype" && key !== "_impl" && key !== "__ctx") {
				const desc = Object.getOwnPropertyDescriptor(source, key);
				if (desc) {
					try {
						Object.defineProperty(target, key, desc);
					} catch {
						// ignore non-configurable properties
					}
				}
			}
		}
	} else if (typeof source === "object" && source !== null) {
		// Remove old methods except _impl and __ctx
		for (const key of Object.keys(target)) {
			if (key !== "_impl" && key !== "__ctx") delete target[key];
		}
		// Attach new properties/methods (enumerable API endpoints)
		for (const [key, value] of Object.entries(source)) {
			if (key !== "__ctx") {
				target[key] = value;
			}
		}
		// Manually copy management methods (may be non-enumerable)
		const managementMethods = ["shutdown", "addApi", "removeApi", "reload", "describe", "run", "instanceId", "scope"];
		for (const method of managementMethods) {
			const desc = Object.getOwnPropertyDescriptor(source, method);
			if (desc) {
				try {
					Object.defineProperty(target, method, desc);
				} catch {
					// ignore
				}
			}
		}
		// Optionally, set _impl to a default method if present
		if (typeof source._impl === "function") {
			target._impl = source._impl;
		}
	}
}
