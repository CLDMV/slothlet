/**
 * @fileoverview Outer proxy helper - stable reference pattern for both lazy and eager modes
 * @module @cldmv/slothlet/helpers/proxy
 */
import { SlothletError } from "@cldmv/slothlet/errors";

/**
 * Create outer getter proxy with __impl pattern (supports reload)
 * @param {string} apiPath - API path for this proxy
 * @param {Object|null} initialImpl - Initial implementation (null for lazy mode)
 * @param {Function|null} materializeFunc - Optional materialization function for lazy mode
 * @returns {Proxy} Outer proxy (not wrapped object)
 * @public
 */
export function createOuterProxy(apiPath, initialImpl = null, materializeFunc = null) {
	const state = {
		path: apiPath,
		materialized: initialImpl !== null,
		inFlight: false
	};

	// __impl holds the actual implementation
	let __impl = initialImpl;

	// Outer getter proxy - the stable reference that never changes
	const getterTarget = function outerGetter() {};

	const getterProxy = new Proxy(getterTarget, {
		get(___target, prop, ___receiver) {
			// Special properties
			if (prop === "__impl") {
				return __impl;
			}
			if (prop === "__state") {
				return state;
			}
			if (prop === "__slothletPath") {
				return apiPath;
			}
			if (prop === "then") {
				return undefined; // Not a thenable
			}
			if (prop === "constructor") {
				return getterTarget.constructor;
			}

			// If materialized, access property directly on __impl
			if (state.materialized && __impl) {
				return __impl[prop];
			}

			// Not materialized - trigger lazy materialization if available
			if (materializeFunc && !state.inFlight) {
				materializeFunc(
					__impl,
					(impl) => {
						__impl = impl;
						state.materialized = true;
						state.inFlight = false;
					},
					() => state
				);
			}

			// Return undefined or thenable depending on state
			return undefined;
		},

		apply(___target, ___thisArg, args) {
			// If materialized and __impl is callable, call it
			if (state.materialized && __impl && typeof __impl === "function") {
				return __impl(...args);
			}

			throw new SlothletError(
				"INVALID_CONFIG_NOT_READY",
				{
					apiPath,
					materialized: state.materialized,
					implType: typeof __impl
				},
				null,
				{ validationError: true }
			);
		},

		has(___target, prop) {
			if (!state.materialized || !__impl) return false;
			return prop in __impl;
		},

		ownKeys(___target) {
			const implKeys = state.materialized && __impl ? Object.keys(__impl) : [];
			const targetKeys = Reflect.ownKeys(getterTarget);
			return [...new Set([...implKeys, ...targetKeys])];
		}
	});

	// Expose methods for external use (lazy mode materialization, reload)
	// Make them non-enumerable so they don't get wrapped, but configurable for proxy compatibility
	Object.defineProperty(getterProxy, "__setImpl", {
		value: (impl) => {
			__impl = impl;
			state.materialized = true;
			state.inFlight = false;
		},
		enumerable: false,
		configurable: true,
		writable: true
	});
	Object.defineProperty(getterProxy, "__getState", {
		value: () => state,
		enumerable: false,
		configurable: true,
		writable: true
	});
	Object.defineProperty(getterProxy, "__getImpl", {
		value: () => __impl,
		enumerable: false,
		configurable: true,
		writable: true
	});

	return getterProxy;
}
