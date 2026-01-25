/**
 * @fileoverview Builds the final API object and attaches the slothlet built-in namespace.
 * @module @cldmv/slothlet/builders/api_builder
 * @package
 *
 * @description
 * Clones the user API, attaches built-in helpers, and wires lifecycle utilities for
 * each Slothlet instance.
 *
 * @example
 * const builder = new ApiBuilder(slothlet);
 * const api = await builder.buildFinalAPI(userApi);
 */
import { ComponentBase } from "@cldmv/slothlet/factories/component-base";
import { TYPE_STATES } from "@cldmv/slothlet/handlers/unified-wrapper";

/**
 * Builds final API with built-in methods attached
 * @class ApiBuilder
 * @extends ComponentBase
 * @package
 *
 * @description
 * Class-based builder for final API construction with built-in namespace attachment.
 * Extends ComponentBase for common Slothlet property access.
 *
 * @example
 * const builder = new ApiBuilder(slothlet);
 * const api = await builder.buildFinalAPI(userApi);
 */
export class ApiBuilder extends ComponentBase {
	static slothletProperty = "apiBuilder";

	/**
	 * Create an ApiBuilder instance.
	 * @param {object} slothlet - Slothlet class instance.
	 * @package
	 *
	 * @description
	 * Creates ApiBuilder with ComponentBase support for config, debug, instanceID access.
	 */
	constructor(slothlet) {
		super(slothlet);
	}

	/**
	 * Build final API with built-in methods attached
	 * @param {Object} userApi - User API object from mode builder
	 * @returns {Promise<Object>} Final API with built-ins attached
	 * @public
	 */
	async buildFinalAPI(userApi) {
		this.slothlet.debug("api", {
			message: "buildFinalAPI called",
			diagnostics: this.config.diagnostics,
			userApiKeys: Object.keys(userApi)
		});

		// CRITICAL: Clone the API object to prevent cross-instance pollution from module cache
		// The API modules are cached by Node.js and shared across instances
		// We must create a new object before mutating it with builtins
		const clonedApi =
			typeof userApi === "function"
				? Object.assign(function (...args) {
						return userApi(...args);
					}, userApi)
				: Object.assign({}, userApi);

		this.slothlet.debug("api", {
			message: "API cloned",
			clonedApiKeys: Object.keys(clonedApi)
		});

		// Save user's shutdown/destroy functions if they exist (to call them during lifecycle)
		// Store these on the instance so they can be updated during add/remove API operations
		this.slothlet.userHooks = {
			shutdown: typeof clonedApi.shutdown === "function" ? clonedApi.shutdown : null,
			destroy: typeof clonedApi.destroy === "function" ? clonedApi.destroy : null
		};

		// Warn if user has 'slothlet' property (reserved namespace)
		if (clonedApi.slothlet) {
			new this.SlothletWarning("WARNING_RESERVED_PROPERTY_CONFLICT", { properties: "slothlet" });
		}

		// Create slothlet namespace with all built-in methods
		const slothletNamespace = await this.createSlothletNamespace(clonedApi);

		this.slothlet.debug("api", {
			message: "Slothlet namespace created",
			namespaceKeys: Object.keys(slothletNamespace),
			hasDiag: !!slothletNamespace.diag
		});

		// Create root-level convenience methods (use getters for dynamic user hooks)
		const shutdownFn = this.createShutdownFunction();

		// Attach built-ins to cloned API (except destroy which needs api reference)
		this.attachBuiltins(clonedApi, {
			slothlet: slothletNamespace,
			shutdown: shutdownFn,
			destroy: null
		});

		this.slothlet.debug("api", {
			message: "Built-ins attached",
			clonedApiKeys: Object.keys(clonedApi),
			hasSlothlet: !!clonedApi.slothlet,
			hasDiag: !!clonedApi.slothlet?.diag
		});

		// Now create destroy with dynamic user hooks
		const destroyWithApi = this.createDestroyFunction(clonedApi);
		Object.defineProperty(clonedApi, "destroy", {
			value: destroyWithApi,
			enumerable: true,
			writable: false,
			configurable: true
		});

		// Store instance reference (non-enumerable for internal use)
		Object.defineProperty(clonedApi, "__slothletInstance", {
			value: this.slothlet,
			enumerable: false,
			writable: false,
			configurable: true
		});

		return clonedApi;
	}

	/**
	 * @param {object} userApi - User API object (for diagnostics).
	 * @returns {Promise<object>} Slothlet namespace object.
	 * @private
	 *
	 * @description
	 * Builds the slothlet namespace with version metadata, API controls, and lifecycle
	 * helpers for the current instance.
	 *
	 * @example
	 * const namespace = await this.createSlothletNamespace(api);
	 */
	async createSlothletNamespace(userApi) {
		const slothlet = this.slothlet;
		const config = this.config;

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
			instanceID: slothlet.instanceID,

			/**
			 * Type state symbols for checking __type property values
			 * @type {Object}
			 * @property {symbol} UNMATERIALIZED - Module not loaded yet
			 * @property {symbol} IN_FLIGHT - Materialization in progress
			 * @public
			 *
			 * @example
			 * if (api.math.__type === api.slothlet.types.IN_FLIGHT) {
			 *   console.log("Math module is loading...");
			 * }
			 */
			types: TYPE_STATES,

			/**
			 * API control object for hot reload operations
			 */
			api: {
				/**
				 * @param {string} apiPath - API path to add modules to.
				 * @param {string} folderPath - Folder path containing modules.
				 * @param {Record<string, unknown>} [metadata={}] - Metadata object.
				 * @param {Record<string, unknown>} [options={}] - Add options (metadata goes here).
				 * @returns {Promise<void>}
				 * @public
				 *
				 * @description
				 * Adds API modules from a folder into the current instance at runtime.
				 *
				 * @example
				 * await api.slothlet.api.add("plugins", "./plugins");
				 */
				add: async function slothlet_api_add(apiPath, folderPath, metadata = {}, options = {}) {
					// Filter out internal options that shouldn't be user-controllable
					const { recordHistory, ...filteredOptions } = options;
					return slothlet.handlers.apiManager.addApiComponent({
						apiPath,
						folderPath,
						options: { ...filteredOptions, metadata }
					});
				},

				/**
				 * @param {string} pathOrModuleId - API path or module ID to remove.
				 * @returns {Promise<void>}
				 * @public
				 *
				 * @description
				 * Removes API modules by apiPath or moduleId from the current instance.
				 *
				 * @example
				 * await api.slothlet.api.remove("plugins.tools");
				 */
				remove: async function slothlet_api_remove(pathOrModuleId) {
					return slothlet.handlers.apiManager.removeApiComponent({ pathOrModuleId });
				},

				/**
				 * @param {string} pathOrModuleId - API path or module ID to reload.
				 * @returns {Promise<void>}
				 * @public
				 *
				 * @description
				 * Reloads API modules recorded through add operations, preserving references.
				 *
				 * @example
				 * await api.slothlet.api.reload("plugins");
				 */
				reload: async function slothlet_api_reload(pathOrModuleId) {
					return slothlet.handlers.apiManager.reloadApiComponent({ pathOrModuleId });
				}
			},

			/**
			 * Hooks API (stubbed until v3 hooks are implemented).
			 * @type {object}
			 */
			hooks: {
				/**
				 * @param {string} _tag - Hook tag.
				 * @param {string} _type - Hook type.
				 * @param {function} _handler - Hook handler.
				 * @param {Record<string, unknown>} [_options={}] - Hook options.
				 * @returns {never}
				 * @public
				 *
				 * @description
				 * Stub for hook registration until hooks are implemented in v3.
				 *
				 * @example
				 * api.slothlet.hooks.on("before", "before", () => undefined, { pattern: "**" });
				 */
				on: async function slothlet_hooks_on(_tag, _type, _handler, _options = {}) {
					throw new slothlet.SlothletError("NOT_IMPLEMENTED", {
						feature: "slothlet.hooks.on",
						hint: "Hooks system deferred to next prototype iteration",
						stub: true
					});
				},

				/**
				 * @param {string} _nameOrPattern - Hook name or pattern.
				 * @returns {never}
				 * @public
				 *
				 * @description
				 * Stub for hook removal until hooks are implemented in v3.
				 *
				 * @example
				 * api.slothlet.hooks.off("before");
				 */
				off: async function slothlet_hooks_off(_nameOrPattern) {
					throw new slothlet.SlothletError("NOT_IMPLEMENTED", {
						feature: "slothlet.hooks.off",
						hint: "Hooks system deferred to next prototype iteration",
						stub: true
					});
				},

				/**
				 * @param {string} [_pattern] - Optional enable pattern.
				 * @returns {never}
				 * @public
				 *
				 * @description
				 * Stub for hook enabling until hooks are implemented in v3.
				 *
				 * @example
				 * api.slothlet.hooks.enable("**");
				 */
				enable: async function slothlet_hooks_enable(_pattern) {
					throw new slothlet.SlothletError("NOT_IMPLEMENTED", {
						feature: "slothlet.hooks.enable",
						hint: "Hooks system deferred to next prototype iteration",
						stub: true
					});
				},

				/**
				 * @param {string} [_pattern] - Optional disable pattern.
				 * @returns {never}
				 * @public
				 *
				 * @description
				 * Stub for hook disabling until hooks are implemented in v3.
				 *
				 * @example
				 * api.slothlet.hooks.disable("**");
				 */
				disable: async function slothlet_hooks_disable(_pattern) {
					throw new slothlet.SlothletError("NOT_IMPLEMENTED", {
						feature: "slothlet.hooks.disable",
						hint: "Hooks system deferred to next prototype iteration",
						stub: true
					});
				},

				/**
				 * @param {string} [_type] - Optional hook type filter.
				 * @returns {never}
				 * @public
				 *
				 * @description
				 * Stub for hook clearing until hooks are implemented in v3.
				 *
				 * @example
				 * api.slothlet.hooks.clear("before");
				 */
				clear: async function slothlet_hooks_clear(_type) {
					throw new slothlet.SlothletError("NOT_IMPLEMENTED", {
						feature: "slothlet.hooks.clear",
						hint: "Hooks system deferred to next prototype iteration",
						stub: true
					});
				},

				/**
				 * @param {string} [_type] - Optional hook type filter.
				 * @returns {never}
				 * @public
				 *
				 * @description
				 * Stub for hook listing until hooks are implemented in v3.
				 *
				 * @example
				 * api.slothlet.hooks.list("before");
				 */
				list: async function slothlet_hooks_list(_type) {
					throw new slothlet.SlothletError("NOT_IMPLEMENTED", {
						feature: "slothlet.hooks.list",
						hint: "Hooks system deferred to next prototype iteration",
						stub: true
					});
				}
			},

			/**
			 * Metadata API for function introspection and tagging.
			 * @type {object}
			 */
			metadata: {
				/**
				 * @param {string} key - Metadata key.
				 * @param {unknown} value - Metadata value.
				 * @returns {void}
				 * @public
				 *
				 * @description
				 * Sets global metadata that applies to all functions in the instance.
				 * Global metadata has lower priority than per-function metadata.
				 *
				 * @example
				 * // Set global metadata for entire API
				 * api.slothlet.metadata.setGlobal("version", "1.0.0");
				 * api.slothlet.metadata.setGlobal("env", "production");
				 */
				setGlobal: function slothlet_metadata_setGlobal(key, value) {
					return slothlet.handlers.metadata.setGlobalMetadata(key, value);
				},

				/**
				 * @param {Function} fn - Target function to tag with metadata.
				 * @param {string} key - Metadata key.
				 * @param {unknown} value - Metadata value.
				 * @returns {void}
				 * @public
				 *
				 * @description
				 * Sets per-function user metadata. User metadata has higher priority than
				 * global metadata and is mutable (can be updated at runtime).
				 *
				 * @example
				 * // Tag a specific function with metadata
				 * api.slothlet.metadata.set(api.math.add, "description", "Adds two numbers");
				 * api.slothlet.metadata.set(api.math.add, "version", "2.0.0");
				 *
				 * @example
				 * // Tag multiple functions
				 * Object.values(api.math).forEach(fn => {
				 *   if (typeof fn === "function") {
				 *     api.slothlet.metadata.set(fn, "category", "math");
				 *   }
				 * });
				 */
				set: function slothlet_metadata_set(fn, key, value) {
					return slothlet.handlers.metadata.setUserMetadata(fn, key, value);
				},

				/**
				 * @param {Function} fn - Target function to remove metadata from.
				 * @param {string} [key] - Optional metadata key to remove (removes all if omitted).
				 * @returns {void}
				 * @public
				 *
				 * @description
				 * Removes user metadata from a function. If key is provided, removes only that
				 * key. If key is omitted, removes all user metadata for the function.
				 *
				 * @example
				 * // Remove specific metadata key
				 * api.slothlet.metadata.remove(api.math.add, "description");
				 *
				 * @example
				 * // Remove all user metadata from function
				 * api.slothlet.metadata.remove(api.math.add);
				 */
				remove: function slothlet_metadata_remove(fn, key) {
					return slothlet.handlers.metadata.removeUserMetadata(fn, key);
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
					throw new slothlet.SlothletError("INVALID_CONFIG", {
						option: "slothlet.scope",
						value: typeof fn,
						expected: "function",
						hint: "First argument must be a function to execute in scope",
						validationError: true
					});
				}

				return slothlet.contextManager.runInContext(slothlet.instanceID, () => {
					const ctx = slothlet.contextManager.getContext();
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
					return slothlet.contextManager.runInContext(slothlet.instanceID, () => {
						const ctx = slothlet.contextManager.getContext();
						Object.assign(ctx.context, context);
						return fn(ctx.self);
					});
				} else {
					// Live mode: run with live binding
					const ctx = slothlet.contextManager.tryGetContext();
					if (ctx) {
						Object.assign(ctx.context, context);
						return fn(ctx.self);
					}
					throw new slothlet.SlothletError(
						"CONTEXT_NOT_FOUND",
						{
							instanceID: slothlet.instanceID,
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
				if (!config.allowMutation) {
					throw new slothlet.SlothletError("INVALID_CONFIG_MUTATION_DISABLED", {
						operation: "reload",
						validationError: true
					});
				}
				return slothlet.reload();
			},

			/**
			 * Shutdown instance and cleanup resources
			 * @returns {Promise<void>}
			 */
			shutdown: async () => {
				return slothlet.shutdown();
			}
		};

		// Remove hooks namespace when hooks are disabled (unless diagnostics mode)
		// Note: Hooks are not yet implemented in v3, but the config option is ready
		if (!config.hooks && config.diagnostics !== true) {
			delete namespace.hooks;
		}

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
				reference: slothlet.reference || null,

				/**
				 * Context object (user-provided context from config)
				 * @type {Object}
				 */
				context: slothlet.context || {},

				/**
				 * Inspect instance state
				 * @returns {Object}
				 */
				inspect: () => {
					return slothlet.getDiagnostics();
				}
			};
		}

		return namespace;
	}

	/**
	 * Create root-level shutdown function (convenience)
	 * @returns {Function} Shutdown function that dynamically calls user hooks
	 * @private
	 */
	createShutdownFunction() {
		const slothlet = this.slothlet;
		const shutdownFunction = {
			shutdown: async () => {
				// Call user's shutdown hook first if they provided one (check dynamically)
				if (slothlet.userHooks?.shutdown && typeof slothlet.userHooks.shutdown === "function") {
					await slothlet.userHooks.shutdown();
				}
				return slothlet.shutdown();
			}
		}.shutdown;
		return shutdownFunction;
	}

	/**
	 * Create root-level destroy function (permanent destruction)
	 * @param {Object} api - Full API object
	 * @returns {Function} Destroy function that dynamically calls user hooks
	 * @private
	 */
	createDestroyFunction(api) {
		const slothlet = this.slothlet;
		const destroyFunction = {
			destroy: async () => {
				// Call user's destroy hook first if they provided one (check dynamically)
				if (slothlet.userHooks?.destroy && typeof slothlet.userHooks.destroy === "function") {
					await slothlet.userHooks.destroy();
				}

				// Then shutdown cleanly using wrapped api.shutdown() (which calls user's shutdown hook)
				if (api && typeof api.shutdown === "function") {
					await api.shutdown();
				} else {
					// Fallback if api.shutdown not available
					await slothlet.shutdown();
				}

				// Then try to destroy the API object itself
				// Note: This can't truly delete properties from the returned object
				// but we can mark it as destroyed and prevent further use
				slothlet.isDestroyed = true;

				// Clear all references we can from both api and slothlet.api
				const objectsToClear = [api, slothlet.api].filter((obj) => obj && typeof obj === "object");

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

				// Clear slothlet.api reference
				slothlet.api = null;
			}
		}.destroy;
		return destroyFunction;
	}

	/**
	 * Attach built-in methods to user API
	 * @param {Object} userApi - User API object
	 * @param {Object} builtins - Built-in methods to attach
	 * @private
	 */
	attachBuiltins(userApi, builtins) {
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
}
