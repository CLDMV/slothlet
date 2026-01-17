/**
 * @fileoverview API builder - attaches built-in methods under slothlet namespace
 * @module @cldmv/slothlet/api_builder
 */
import { SlothletError } from "@cldmv/slothlet/errors";
import { t } from "@cldmv/slothlet/i18n";

/**
 * Build final API with built-in methods attached
 * @param {Object} options - Build options
 * @param {Object} options.userApi - User API object from mode builder
 * @param {Object} options.instance - Slothlet instance
 * @param {Object} options.config - Configuration
 * @returns {Object} Final API with built-ins attached
 * @public
 */
export function buildFinalAPI(options) {
	const { userApi, instance, config } = options;

	// Check for conflicts with reserved names
	const conflicts = {
		slothlet: userApi.slothlet,
		shutdown: userApi.shutdown,
		destroy: userApi.destroy
	};

	if (conflicts.slothlet || conflicts.shutdown || conflicts.destroy) {
		const properties = Object.entries(conflicts)
			.filter(([_, hasConflict]) => hasConflict)
			.map(([name]) => name)
			.join(", ");

		console.warn(t("WARNING_RESERVED_PROPERTY_CONFLICT", { properties }));
	}

	// Create slothlet namespace with all built-in methods
	const slothletNamespace = createSlothletNamespace(instance, config, userApi);

	// Create root-level convenience methods
	const shutdownFn = createShutdownFunction(instance);

	// Attach built-ins to user API (except destroy which needs api reference)
	attachBuiltins(userApi, {
		slothlet: slothletNamespace,
		shutdown: shutdownFn,
		destroy: null
	});

	// Now create destroy with api reference so it can call api.shutdown()
	const destroyWithApi = createDestroyFunction(instance, userApi);
	Object.defineProperty(userApi, "destroy", {
		value: destroyWithApi,
		enumerable: true,
		writable: false,
		configurable: false
	});

	// Store instance reference (non-enumerable for internal use)
	Object.defineProperty(userApi, "__slothletInstance", {
		value: instance,
		enumerable: false,
		writable: false,
		configurable: false
	});

	return userApi;
}

/**
 * Create slothlet namespace with all built-in methods
 * @param {Object} instance - Slothlet instance
 * @param {Object} config - Configuration
 * @param {Object} userApi - User API object (for reference diagnostic)
 * @returns {Object} Slothlet namespace object
 * @private
 */
function createSlothletNamespace(instance, config, userApi) {
	const namespace = {
		/**
		 * API control object for hot reload operations
		 */
		api: {
			/**
			 * Add new API module at runtime
			 * @param {Object} ___options - Add options
			 * @returns {Promise<void>}
			 */
			add: async (___options) => {
				throw new SlothletError("INVALID_CONFIG", {
					option: "slothlet.api.add",
					value: "not implemented",
					expected: "implemented in future iteration",
					hint: "Hot reload features deferred to next prototype iteration"
				});
			},

			/**
			 * Remove API module
			 * @param {Object} ___options - Remove options
			 * @returns {Promise<void>}
			 */
			remove: async (___options) => {
				throw new SlothletError("INVALID_CONFIG", {
					option: "slothlet.api.remove",
					value: "not implemented",
					expected: "implemented in future iteration",
					hint: "Hot reload features deferred to next prototype iteration"
				});
			},

			/**
			 * Reload specific API module (preserves references)
			 * @param {Object} ___options - Reload options
			 * @returns {Promise<void>}
			 */
			reload: async (___options) => {
				throw new SlothletError("INVALID_CONFIG", {
					option: "slothlet.api.reload",
					value: "not implemented",
					expected: "implemented in future iteration",
					hint: "Hot reload features deferred to next prototype iteration"
				});
			}
		},

		/**
		 * Create per-request scope with custom context
		 * @param {Function} fn - Function to run in scope
		 * @param {Object} context - Custom context
		 * @returns {*} Result of fn
		 */
		scope: (fn, context) => {
			if (typeof fn !== "function") {
				throw new SlothletError("INVALID_CONFIG", {
					option: "slothlet.scope",
					value: typeof fn,
					expected: "function",
					hint: "First argument must be a function to execute in scope"
				});
			}

			return instance.contextManager.runInContext(instance.instanceId, () => {
				const ctx = instance.contextManager.getContext();
				if (context && typeof context === "object") {
					Object.assign(ctx.context, context);
				}
				return fn(ctx.self);
			});
		},

		/**
		 * Run function with specific context
		 * @param {Function} fn - Function to run
		 * @param {Object} context - Context to use
		 * @returns {*} Result of fn
		 */
		run: (fn, context = {}) => {
			if (config.runtime === "async") {
				// Async mode: run with provided context
				return instance.contextManager.runInContext(instance.instanceId, () => {
					const ctx = instance.contextManager.getContext();
					Object.assign(ctx.context, context);
					return fn(ctx.self);
				});
			} else {
				// Live mode: run with live binding
				const ctx = instance.contextManager.tryGetContext();
				if (ctx) {
					Object.assign(ctx.context, context);
					return fn(ctx.self);
				}
				throw new SlothletError("CONTEXT_NOT_FOUND", {
					instanceId: instance.instanceId,
					hint: "No active context in live mode"
				});
			}
		},

		/**
		 * Reload entire instance (creates new references)
		 * @returns {Promise<void>}
		 */
		reload: async () => {
			return instance.reload();
		},

		/**
		 * Shutdown instance and cleanup resources
		 * @returns {Promise<void>}
		 */
		shutdown: async () => {
			return instance.shutdown();
		}
	};

	// Add diagnostics if enabled
	if (config.diagnostics === true) {
		namespace.diag = {
			/**
			 * Describe API structure (like v2)
			 * @param {boolean} [showAll=false] - If true, returns full API object; if false, returns top-level keys
			 * @returns {Array|Object}
			 */
			describe: (showAll = false) => {
				if (showAll) {
					// Return full API structure (like v2 eager mode)
					return { ...userApi };
				}
				// Return top-level keys (like v2)
				return Reflect.ownKeys(userApi);
			},

			/**
			 * Get reference object passed to slothlet initialization
			 * @returns {Object|null}
			 */
			reference: () => {
				return instance.reference;
			},

			/**
			 * Get context object
			 * @returns {Object}
			 */
			context: () => {
				return instance.contextManager.tryGetContext();
			},

			/**
			 * Inspect instance state
			 * @returns {Object}
			 */
			inspect: () => {
				return instance.getDiagnostics();
			}
		};
	}

	return namespace;
}

/**
 * Create root-level shutdown function (convenience)
 * @param {Object} instance - Slothlet instance
 * @returns {Function} Shutdown function
 * @private
 */
function createShutdownFunction(instance) {
	return async () => {
		return instance.shutdown();
	};
}

/**
 * Create root-level destroy function (permanent destruction)
 * @param {Object} instance - Slothlet instance
 * @param {Object} api - Full API object (with user's shutdown hook if present)
 * @returns {Function} Destroy function
 * @private
 */
function createDestroyFunction(instance, api) {
	return async () => {
		// First shutdown cleanly using api.shutdown() to trigger user's hook
		if (api && typeof api.shutdown === "function") {
			await api.shutdown();
		} else {
			// Fallback if api.shutdown not available
			await instance.shutdown();
		}

		// Then try to destroy the API object itself
		// Note: This can't truly delete properties from the returned object
		// but we can mark it as destroyed and prevent further use
		instance.isDestroyed = true;

		// Clear all references we can from both api and instance.api
		const objectsToClear = [api, instance.api].filter((obj) => obj && typeof obj === "object");

		for (const obj of objectsToClear) {
			const keys = Object.keys(obj);
			for (const key of keys) {
				try {
					delete obj[key];
				} catch (_) {
					// Some properties may not be deletable
				}
			}
		}

		// Clear instance.api reference
		instance.api = null;
	};
}

/**
 * Attach built-in methods to user API
 * @param {Object} userApi - User API object
 * @param {Object} builtins - Built-in methods to attach
 * @private
 */
function attachBuiltins(userApi, builtins) {
	// Attach slothlet namespace
	Object.defineProperty(userApi, "slothlet", {
		value: builtins.slothlet,
		enumerable: true,
		writable: false,
		configurable: false
	});

	// Attach root-level shutdown (convenience)
	Object.defineProperty(userApi, "shutdown", {
		value: builtins.shutdown,
		enumerable: true,
		writable: false,
		configurable: false
	});

	// Note: destroy will be attached separately after api is built
	// (it needs api reference to call api.shutdown())
	if (builtins.destroy !== null) {
		Object.defineProperty(userApi, "destroy", {
			value: builtins.destroy,
			enumerable: true,
			writable: false,
			configurable: false
		});
	}
}
