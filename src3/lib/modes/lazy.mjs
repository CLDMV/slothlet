/**
 * @fileoverview Lazy mode implementation - deferred loading with proxies
 * @module @cldmv/slothlet/modes/lazy
 */
import { SlothletError } from "@cldmv/slothlet/errors";
import { loadModule, hasValidExports, extractExports } from "@cldmv/slothlet/helpers/loader";
import { sanitizePropertyName } from "@cldmv/slothlet/helpers/sanitize";

/**
 * Build API in lazy mode (proxy-based deferred loading)
 * @param {Object} structure - Directory structure from scanDirectory
 * @param {Map} decisions - Flattening decisions from analyzeStructure
 * @param {Object} ownership - Ownership manager
 * @param {Object} ___config - Configuration
 * @returns {Promise<Object>} Built API object with lazy proxies
 * @public
 */
export async function buildLazyAPI(structure, decisions, ownership, ___config = {}) {
	const api = {};

	// Load root files immediately (like eager mode)
	for (const file of structure.files) {
		const module = await loadModule(file.path);

		if (!hasValidExports(module)) {
			throw new SlothletError("MODULE_NO_EXPORTS", {
				modulePath: file.path,
				moduleId: file.moduleId,
				hint: "Ensure module exports at least one function or object"
			});
		}

		const exports = extractExports(module);
		const decision = decisions.get(file.moduleId);
		const apiPath = decision?.targetPath || file.name;

		// Register ownership
		if (ownership) {
			ownership.register({
				moduleId: file.moduleId,
				apiPath,
				source: "core"
			});
		}

		// Merge exports into API
		mergeExportsIntoAPI(api, exports, apiPath, file.name);
	}

	// Create lazy proxies for directories
	for (const dir of structure.directories) {
		const propName = sanitizePropertyName(dir.name);
		api[propName] = createLazyProxy(dir, decisions, ownership, dir.name);
	}

	return api;
}

/**
 * Create lazy proxy for directory
 * @param {Object} dir - Directory structure
 * @param {Map} decisions - Flattening decisions
 * @param {Object} ownership - Ownership manager
 * @param {string} apiPath - Current API path
 * @returns {Proxy} Lazy proxy that loads on first access
 * @private
 */
function createLazyProxy(dir, decisions, ownership, apiPath) {
	const state = {
		materialized: null,
		inFlight: null
	};

	// Create target function (proxy must have callable target)
	const target = function lazyFolder() {
		throw new SlothletError("INVALID_CONFIG", {
			option: "lazy proxy call",
			value: "called before materialization",
			expected: "access properties to trigger materialization",
			hint: `Access a property on '${apiPath}' to load the module`
		});
	};

	// Create proxy with materialization logic
	const proxy = new Proxy(target, {
		/**
		 * Property access - materialize on first access
		 */
		get(___target, prop, ___receiver) {
			// Special properties - don't materialize
			if (prop === "__slothletPath") {
				return apiPath;
			}
			if (prop === "then") {
				return undefined; // Not a thenable
			}
			if (prop === "constructor") {
				return target.constructor;
			}

			// Materialize if needed
			if (!state.materialized) {
				materialize(dir, decisions, ownership, apiPath, state);
			}

			// Return property from materialized object
			return state.materialized ? state.materialized[prop] : undefined;
		},

		/**
		 * Function call - not supported before materialization
		 */
		apply(___target, ___thisArg, ___args) {
			throw new SlothletError("INVALID_CONFIG", {
				option: "lazy proxy call",
				value: "called before materialization",
				expected: "access properties to trigger materialization",
				hint: `Access a property on '${apiPath}' to load the module`
			});
		},

		/**
		 * Property existence check
		 */
		has(___target, prop) {
			if (!state.materialized) {
				materialize(dir, decisions, ownership, apiPath, state);
			}
			return state.materialized ? prop in state.materialized : false;
		},

		/**
		 * Property enumeration
		 */
		ownKeys(___target) {
			if (!state.materialized) {
				materialize(dir, decisions, ownership, apiPath, state);
			}
			return state.materialized ? Object.keys(state.materialized) : [];
		}
	});

	return proxy;
}

/**
 * Materialize lazy proxy by loading directory contents
 * @param {Object} dir - Directory structure
 * @param {Map} decisions - Flattening decisions
 * @param {Object} ownership - Ownership manager
 * @param {string} apiPath - API path
 * @param {Object} state - Materialization state
 * @private
 */
function materialize(dir, decisions, ownership, apiPath, state) {
	// Prevent concurrent materialization
	if (state.inFlight) {
		throw new SlothletError("INTERNAL_INVALID_STATE", {
			message: "Concurrent materialization detected",
			state: { apiPath, inFlight: true }
		});
	}

	state.inFlight = true;

	try {
		const materialized = {};

		// Load files in directory synchronously (blocking)
		for (const file of dir.children.files) {
			// Use dynamic import with then() to make it synchronous-ish
			// This is a limitation - proper lazy mode needs async materialization
			throw new SlothletError("INVALID_CONFIG", {
				option: "lazy mode",
				value: "synchronous materialization not supported",
				expected: "async materialization",
				hint: "Lazy mode requires async operations - use eager mode for now or implement async getter pattern"
			});
		}

		state.materialized = materialized;
		state.inFlight = false;
	} catch (error) {
		state.inFlight = false;
		throw error;
	}
}

/**
 * Merge exports into API object
 * @param {Object} api - API object
 * @param {Object} exports - Module exports
 * @param {string} apiPath - API path
 * @param {string} fileName - Original file name
 * @private
 */
function mergeExportsIntoAPI(api, exports, apiPath, fileName) {
	const propName = sanitizePropertyName(fileName);

	if (exports.default && Object.keys(exports).length === 1) {
		// Only default export
		api[propName] = exports.default;
	} else if (!exports.default && Object.keys(exports).length > 0) {
		// Only named exports - create namespace
		api[propName] = {};
		for (const [key, value] of Object.entries(exports)) {
			if (key !== "default") {
				api[propName][key] = value;
			}
		}
	} else if (exports.default && Object.keys(exports).length > 1) {
		// Mixed exports - default is callable, named are properties
		const callable = exports.default;
		for (const [key, value] of Object.entries(exports)) {
			if (key !== "default") {
				callable[key] = value;
			}
		}
		api[propName] = callable;
	}
}
