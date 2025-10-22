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
export async function autoWrapEventEmitters(nodeModule) {
	// Only wrap if we're in a slothlet API context
	try {
		const { self } = await import("@cldmv/slothlet/runtime");
		if (!self?.__ctx) {
			// Not in slothlet context, return original module
			return nodeModule;
		}

		const { makeWrapper } = await import("../runtime/runtime.mjs");
		const wrapper = makeWrapper(self.__ctx);

		// Create wrapped version of the module
		const wrappedModule = { ...nodeModule };

		// Wrap specific EventEmitter constructors
		if (typeof nodeModule.createServer === "function") {
			const originalCreateServer = nodeModule.createServer;
			wrappedModule.createServer = function (...args) {
				const server = originalCreateServer.apply(this, args);
				return wrapper(server);
			};
		}

		return wrappedModule;
	} catch (_) {
		// If anything fails, return original module
		return nodeModule;
	}
}

/**
 * Lazily get the pre-wrapped net module for convenient use in API modules.
 * @function getNet
 * @package
 * @returns {Promise<NetModule>} Promise resolving to the wrapped net module
 * @example
 * const net = await getNet();
 */
export async function getNet() {
	const originalNet = await import("node:net");
	return autoWrapEventEmitters(originalNet.default || originalNet);
}

/**
 * @typedef {object} NetModule
 */
