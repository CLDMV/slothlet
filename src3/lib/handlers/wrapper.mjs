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
	 */
	constructor(contextManager) {
		this.context = contextManager;
	}

	/**
	 * Wrap entire API object recursively
	 * @param {Object} api - API object to wrap
	 * @param {string} instanceId - Instance ID for context
	 * @param {string} [currentPath=""] - Current API path
	 * @param {WeakSet} [visited=new WeakSet()] - Visited objects tracker
	 * @returns {Object} Wrapped API object
	 * @public
	 */
	wrapAPI(api, instanceId, currentPath = "", visited = new WeakSet()) {
		if (!api || typeof api !== "object") return api;
		if (visited.has(api)) return api; // Prevent circular refs
		visited.add(api);

		const wrapped = Array.isArray(api) ? [] : {};

		// At root level, check for builtins using Object.getOwnPropertyDescriptors
		// to catch non-enumerable properties
		const keys = currentPath === "" ? Object.getOwnPropertyNames(api) : Object.keys(api);

		for (const key of keys) {
			const value = api[key];
			const apiPath = currentPath ? `${currentPath}.${key}` : key;

			// Skip wrapping built-in properties at root level (already bound)
			const isBuiltin =
				currentPath === "" && (key === "slothlet" || key === "shutdown" || key === "destroy" || key === "__slothletInstance");

			if (isBuiltin) {
				wrapped[key] = value; // Use as-is, already bound
			} else if (typeof value === "function") {
				wrapped[key] = this.wrapFunction(value, instanceId, apiPath);
			} else if (value && typeof value === "object") {
				wrapped[key] = this.wrapAPI(value, instanceId, apiPath, visited);
			} else {
				wrapped[key] = value;
			}
		}

		// Preserve function properties if original was callable
		if (typeof api === "function") {
			const wrappedFn = this.wrapFunction(api, instanceId, currentPath);
			Object.setPrototypeOf(wrapped, Object.getPrototypeOf(wrappedFn));
			for (const key of Object.keys(wrapped)) {
				wrappedFn[key] = wrapped[key];
			}
			return wrappedFn;
		}

		return wrapped;
	}

	/**
	 * Wrap single function with context
	 * @param {Function} fn - Function to wrap
	 * @param {string} instanceId - Instance ID for context
	 * @param {string} apiPath - API path for this function
	 * @returns {Function} Wrapped function
	 * @public
	 */
	wrapFunction(fn, instanceId, apiPath) {
		const self = this;

		const wrapped = function slothlet_wrapped(...args) {
			return self.context.runInContext(instanceId, fn, this, args);
		};

		// Preserve metadata
		Object.defineProperty(wrapped, "name", {
			value: fn.name || "anonymous",
			configurable: true
		});

		wrapped.__slothletPath = apiPath;
		wrapped.__slothletOriginal = fn;
		wrapped.__slothletInstanceId = instanceId;

		// Copy function properties
		for (const key of Object.keys(fn)) {
			if (key !== "name" && key !== "length") {
				wrapped[key] = fn[key];
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
