/**
 * @fileoverview Universal function wrapper system with context isolation
 * @module @cldmv/slothlet/wrapper
 */

/**
 * Wraps API functions with context isolation and metadata
 * @public
 */
export class WrapperManager {
	/**
	 * Create wrapper manager
	 * @param {Object} contextManager - Context manager instance
	 * @param {Object} instance - Slothlet instance for ownership lookups
	 */
	constructor(contextManager, instance = null) {
		this.context = contextManager;
		this.instance = instance;
	}

	/**
	 * Create proxy-based wrapper for API with dynamic ownership lookups
	 * @param {Object} api - API object to wrap
	 * @param {string} instanceID - Instance ID for context
	 * @param {string} [currentPath=""] - Current API path
	 * @returns {Proxy} Proxied API object
	 * @public
	 */
	wrapAPI(api, instanceID, currentPath = "") {
		const self = this;
		const ownership = this.instance?.ownership;

		// Create proxy that intercepts property access
		return new Proxy(api, {
			get(target, prop, receiver) {
				// Skip internal/special properties
				if (
					prop === "__slothletInstance" ||
					prop === "userHooks" ||
					typeof prop === "symbol" ||
					prop === "constructor" ||
					prop === "prototype"
				) {
					return Reflect.get(target, prop, receiver);
				}

				// Build full API path
				const apiPath = currentPath ? `${currentPath}.${prop}` : prop;

				// Check ownership first for dynamic updates (future add/remove API)
				let value = ownership?.getCurrentValue(apiPath);

				// Fall back to target if ownership doesn't have it
				if (value === undefined) {
					value = target[prop];
				}

				// Return undefined if property doesn't exist
				if (value === undefined) {
					return undefined;
				}

				// Built-in properties at root level - return as-is (already bound)
				if (currentPath === "" && (prop === "slothlet" || prop === "shutdown" || prop === "destroy")) {
					return value;
				}

				// Don't wrap thenables (lazy mode materialization proxies)
				if (value && typeof value === "object" && value.__slothletThenable) {
					return value;
				}

				// Wrap functions with context
				if (typeof value === "function") {
					return self.wrapFunction(value, instanceID, apiPath);
				}

				// Create nested proxy for objects
				if (value && typeof value === "object" && !Array.isArray(value)) {
					return self.wrapAPI(value, instanceID, apiPath);
				}

				// Return primitives and arrays as-is
				return value;
			},

			// Handle callable APIs (when API itself is a function)
			apply(target, thisArg, args) {
				// Check ownership for current path function
				let fn = ownership?.getCurrentValue(currentPath);
				if (!fn || typeof fn !== "function") {
					fn = target;
				}

				if (typeof fn === "function") {
					return self.context.runInContext(instanceID, fn, thisArg, args);
				}

				throw new TypeError(`${currentPath || "api"} is not a function`);
			}
		});
	}

	/**
	 * Wrap single function with context
	 * @param {Function} fn - Function to wrap
	 * @param {string} instanceID - Instance ID for context
	 * @param {string} apiPath - API path for this function
	 * @returns {Function} Wrapped function
	 * @public
	 */
	wrapFunction(fn, instanceID, apiPath) {
		const self = this;

		const wrapped = function slothlet_wrapped(...args) {
			return self.context.runInContext(instanceID, fn, this, args);
		};

		// Preserve metadata
		Object.defineProperty(wrapped, "name", {
			value: fn.name || "anonymous",
			configurable: true
		});

		wrapped.__slothletPath = apiPath;
		wrapped.__slothletOriginal = fn;
		wrapped.__slothletInstanceId = instanceID;

		// Copy function properties (for functions with methods)
		for (const key of Object.keys(fn)) {
			if (key !== "name" && key !== "length") {
				const desc = Object.getOwnPropertyDescriptor(fn, key);
				if (desc && typeof fn[key] === "function") {
					// Wrap nested functions
					wrapped[key] = self.wrapFunction(fn[key], instanceID, `${apiPath}.${key}`);
				} else {
					// Copy non-function properties
					wrapped[key] = fn[key];
				}
			}
		}

		return wrapped;
	}

	/**
	 * Check if function is already wrapped
	 * @param {Function} fn - Function to check
	 * @returns {boolean} True if wrapped
	 * @public
	 */
	isWrapped(fn) {
		return typeof fn === "function" && "__slothletOriginal" in fn;
	}

	/**
	 * Unwrap function to get original
	 * @param {Function} fn - Function to unwrap
	 * @returns {Function} Original unwrapped function
	 * @public
	 */
	unwrap(fn) {
		if (this.isWrapped(fn)) {
			return fn.__slothletOriginal;
		}
		return fn;
	}
}
