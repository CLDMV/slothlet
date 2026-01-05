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
export function safeDefine(obj: object, key: string, value: any, enumerable?: boolean, config?: object): void;
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
export function deepMerge(target: object, source: object): object;
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
export function mutateLiveBindingFunction(target: Function | object, source: Function | object): void;
//# sourceMappingURL=utilities.d.mts.map