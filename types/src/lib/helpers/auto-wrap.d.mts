/**
 * @fileoverview Helper for automatically wrapping Node.js EventEmitter instances within API modules.
 * Internal file (not exported in package.json).
 * @module @cldmv/slothlet/src/lib/helpers/auto-wrap
 */
/**
 * Automatically wrap Node.js EventEmitter constructors when called within slothlet API context.
 * This ensures that EventEmitter instances created inside API modules preserve AsyncLocalStorage context.
 * @function autoWrapEventEmitters
 * @package
 * @param {object} nodeModule - The Node.js module to wrap (e.g., require('node:net'))
 * @returns {object} Wrapped module with auto-wrapping constructors
 *
 * @description
 * Wraps Node.js module functions that return EventEmitter instances so they automatically
 * return wrapped instances when called within slothlet API context.
 *
 * @example
 * // Usage in API modules:
 * import { autoWrapEventEmitters } from '@cldmv/slothlet/src/lib/helpers/auto-wrap';
 * import originalNet from 'node:net';
 * const net = autoWrapEventEmitters(originalNet);
 * // Now net.createServer() returns wrapped instances automatically
 */
export function autoWrapEventEmitters(nodeModule: object): object;
/**
 * Lazily get the pre-wrapped net module for convenient use in API modules.
 * @function getNet
 * @package
 * @returns {Promise<NetModule>} Promise resolving to the wrapped net module
 * @example
 * const net = await getNet();
 */
export function getNet(): Promise<NetModule>;
export type NetModule = object;
//# sourceMappingURL=auto-wrap.d.mts.map