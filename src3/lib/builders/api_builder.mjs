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
 * @returns {Promise<Object>} Final API with built-ins attached
 * @public
 */
export async function buildFinalAPI(options) {
	const { userApi, instance, config } = options;

	if (config.debug?.api) {
		console.log("DEBUG buildFinalAPI: called with config.diagnostics =", config.diagnostics);
		console.log("DEBUG buildFinalAPI: userApi keys before =", Object.keys(userApi));
	}

	// CRITICAL: Clone the API object to prevent cross-instance pollution from module cache
	// The API modules are cached by Node.js and shared across instances
	// We must create a new object before mutating it with builtins
	const clonedApi =
		typeof userApi === "function"
			? Object.assign(function (...args) {
					return userApi(...args);
				}, userApi)
			: Object.assign({}, userApi);

	if (config.debug?.api) {
		console.log("DEBUG buildFinalAPI: clonedApi keys =", Object.keys(clonedApi));
	}

	// Save user's shutdown/destroy functions if they exist (to call them during lifecycle)
	// Store these on the instance so they can be updated during add/remove API operations
	instance.userHooks = {
		shutdown: typeof clonedApi.shutdown === "function" ? clonedApi.shutdown : null,
		destroy: typeof clonedApi.destroy === "function" ? clonedApi.destroy : null
	};

	// Warn if user has 'slothlet' property (reserved namespace)
	if (clonedApi.slothlet) {
		console.warn(t("WARNING_RESERVED_PROPERTY_CONFLICT", { properties: "slothlet" }));
	}

	// Create slothlet namespace with all built-in methods
	const slothletNamespace = await createSlothletNamespace(instance, config, clonedApi);

	if (config.debug?.api) {
		console.log("DEBUG buildFinalAPI: slothletNamespace keys =", Object.keys(slothletNamespace));
		console.log("DEBUG buildFinalAPI: slothletNamespace.diag exists =", !!slothletNamespace.diag);
	}

	// Create root-level convenience methods (use getters for dynamic user hooks)
	const shutdownFn = createShutdownFunction(instance);

	// Attach built-ins to cloned API (except destroy which needs api reference)
	attachBuiltins(clonedApi, {
		slothlet: slothletNamespace,
		shutdown: shutdownFn,
		destroy: null
	});

	if (config.debug?.api) {
		console.log("DEBUG buildFinalAPI: clonedApi keys after attachBuiltins =", Object.keys(clonedApi));
		console.log("DEBUG buildFinalAPI: clonedApi.slothlet exists =", !!clonedApi.slothlet);
		console.log("DEBUG buildFinalAPI: clonedApi.slothlet.diag exists =", !!clonedApi.slothlet?.diag);
	}

	// Now create destroy with dynamic user hooks
	const destroyWithApi = createDestroyFunction(instance, clonedApi);
	Object.defineProperty(clonedApi, "destroy", {
		value: destroyWithApi,
		enumerable: true,
		writable: false,
		configurable: true
	});

	// Store instance reference (non-enumerable for internal use)
	Object.defineProperty(clonedApi, "__slothletInstance", {
		value: instance,
		enumerable: false,
		writable: false,
		configurable: true
	});

	return clonedApi;
}

/**
 * Create slothlet namespace with all built-in methods
 * @param {Object} instance - Slothlet instance
 * @param {Object} config - Configuration
 * @param {Object} userApi - User API object (for reference diagnostic)
 * @returns {Promise<Object>} Slothlet namespace object
 * @private
 */
async function createSlothletNamespace(instance, config, userApi) {
	// Read version from package.json
	let version = "unknown";
	try {
		const pkgPath = new URL("../../../package.json", import.meta.url);
		const { readFile } = await import("node:fs/promises");
		const pkgContent = await readFile(pkgPath, "utf-8");
		const pkg = JSON.parse(pkgContent);
		version = pkg.version || "unknown";
	} catch {
		// Ignore - version will remain "unknown"
	}

	const namespace = {
		/**
		 * Slothlet version from package.json
		 * @type {string}
		 */
		version,

		/**
		 * Unique instance ID for this slothlet instance
		 * @type {string}
		 */
		instanceID: instance.instanceID,

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
				throw new SlothletError("NOT_IMPLEMENTED", {
					feature: "slothlet.api.add",
					hint: "Hot reload features deferred to next prototype iteration",
					stub: true
				});
			},

			/**
			 * Remove API module
			 * @param {Object} ___options - Remove options
			 * @returns {Promise<void>}
			 */
			remove: async (___options) => {
				throw new SlothletError("NOT_IMPLEMENTED", {
					feature: "slothlet.api.remove",
					hint: "Hot reload features deferred to next prototype iteration",
					stub: true
				});
			},

			/**
			 * Reload specific API module (preserves references)
			 * @param {Object} ___options - Reload options
			 * @returns {Promise<void>}
			 */
			reload: async (___options) => {
				throw new SlothletError("NOT_IMPLEMENTED", {
					feature: "slothlet.api.reload",
					hint: "Hot reload features deferred to next prototype iteration",
					stub: true
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
					hint: "First argument must be a function to execute in scope",
					validationError: true
				});
			}

			return instance.contextManager.runInContext(instance.instanceID, () => {
				const ctx = instance.contextManager.getContext();
				return fn(ctx.self);
			});
		},

		/**
		 * Run function with specific context
		 * @param {Function} fn - Function to run
		 * @param {Object} context - Context to use
		 * @returns {*} Result of fn
		 */
		run: async (fn, context = {}) => {
			if (config.runtime === "async") {
				// Async mode: run with provided context
				return instance.contextManager.runInContext(instance.instanceID, () => {
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
				throw new SlothletError(
					"CONTEXT_NOT_FOUND",
					{
						instanceID: instance.instanceID,
						availableInstances: "none"
					},
					null,
					{ validationError: true }
				);
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
			 * Reference object passed to slothlet initialization (merged into API)
			 * @type {Object|null}
			 */
			reference: instance.reference || null,

			/**
			 * Context object (user-provided context from config)
			 * @type {Object}
			 */
			context: instance.context || {},

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
 * @param {Object} instance - Slothlet instance with userHooks property
 * @returns {Function} Shutdown function that dynamically calls user hooks
 * @private
 */
function createShutdownFunction(instance) {
	return async () => {
		// Call user's shutdown hook first if they provided one (check dynamically)
		if (instance.userHooks?.shutdown && typeof instance.userHooks.shutdown === "function") {
			await instance.userHooks.shutdown();
		}
		return instance.shutdown();
	};
}

/**
 * Create root-level destroy function (permanent destruction)
 * @param {Object} instance - Slothlet instance with userHooks property
 * @param {Object} api - Full API object
 * @returns {Function} Destroy function that dynamically calls user hooks
 * @private
 */
function createDestroyFunction(instance, api) {
	return async () => {
		// Call user's destroy hook first if they provided one (check dynamically)
		if (instance.userHooks?.destroy && typeof instance.userHooks.destroy === "function") {
			await instance.userHooks.destroy();
		}

		// Then shutdown cleanly using wrapped api.shutdown() (which calls user's shutdown hook)
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
	// Note: Using configurable: true for vitest compatibility (worker reuse)
	Object.defineProperty(userApi, "slothlet", {
		value: builtins.slothlet,
		enumerable: true,
		writable: false,
		configurable: true
	});

	// Attach root-level shutdown (convenience)
	Object.defineProperty(userApi, "shutdown", {
		value: builtins.shutdown,
		enumerable: true,
		writable: false,
		configurable: true
	});

	// Note: destroy will be attached separately after api is built
	// (it needs api reference to call api.shutdown())
	if (builtins.destroy !== null) {
		Object.defineProperty(userApi, "destroy", {
			value: builtins.destroy,
			enumerable: true,
			writable: false,
			configurable: true
		});
	}
}
