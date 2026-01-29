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
					// Check if add mutation is allowed
					if (!config.api?.mutations?.add) {
						throw new slothlet.SlothletError("INVALID_CONFIG_MUTATIONS_DISABLED", {
							operation: "api.add",
							hint: "API mutation 'add' is disabled by configuration. Set api.mutations.add: true to enable.",
							validationError: true
						});
					}
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
					// Check if remove mutation is allowed
					if (!config.api?.mutations?.remove) {
						throw new slothlet.SlothletError("INVALID_CONFIG_MUTATIONS_DISABLED", {
							operation: "api.remove",
							hint: "API mutation 'remove' is disabled by configuration. Set api.mutations.remove: true to enable.",
							validationError: true
						});
					}
					if (typeof pathOrModuleId !== "string") {
						throw new slothlet.SlothletError("INVALID_ARGUMENT", {
							argument: "pathOrModuleId",
							expected: "string",
							received: typeof pathOrModuleId,
							validationError: true
						});
					}
					return slothlet.handlers.apiManager.removeApiComponent(pathOrModuleId);
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
			 * Context API for per-request context isolation.
			 * @type {object}
			 */
			context: {
				/**
				 * Get context value or full context object.
				 * @param {string} [key] - Optional key to get specific value
				 * @returns {*} Context value if key provided, full context object if no key
				 * @public
				 */
				get: (key) => {
					// For live mode, directly get THIS instance's context
					// Don't use tryGetContext() which returns the CURRENT instance
					if (slothlet.contextManager.constructor.name === "LiveContextManager") {
						const store = slothlet.contextManager.instances.get(slothlet.instanceID);
						if (!store) {
							const baseContext = slothlet.context || {};
							return key ? baseContext[key] : { ...baseContext };
						}
						return key ? store.context[key] : { ...store.context };
					}

					// For async mode, search the parent context chain
					let ctx;
					try {
						ctx = slothlet.contextManager.tryGetContext();
					} catch (error) {
						ctx = null;
					}

					// Search for THIS instance's context in the parent chain
					// When multiple instances nest .run() calls, each instance should find its own context
					let targetCtx = ctx;
					while (targetCtx && targetCtx.instanceID !== slothlet.instanceID) {
						targetCtx = targetCtx.parentContext;
					}

					// If we found this instance's context in the chain, use it
					if (targetCtx && targetCtx.instanceID === slothlet.instanceID) {
						return key ? targetCtx.context[key] : { ...targetCtx.context };
					}

					// Otherwise fall back to base instance context from instances Map
					const baseStore = slothlet.contextManager.instances.get(slothlet.instanceID);
					const baseContext = baseStore?.context || {};
					return key ? baseContext[key] : { ...baseContext };
				},

				/**
				 * Get diagnostics about context retrieval (for testing/debugging).
				 * Shows how context is retrieved by instance ID in both async and live modes.
				 * @returns {object} Diagnostic information
				 * @internal
				 */
				diagnostics: () => {
					const managerType = slothlet.contextManager.constructor.name;
					const result = {
						instanceID: slothlet.instanceID,
						managerType,
						instancesMapSize: slothlet.contextManager.instances.size,
						instancesMapKeys: Array.from(slothlet.contextManager.instances.keys()),
						baseContext: slothlet.context
					};

					// Get store for THIS instance from instances Map
					const store = slothlet.contextManager.instances.get(slothlet.instanceID);
					result.storeFromInstancesMap = store
						? {
								instanceID: store.instanceID,
								context: store.context,
								createdAt: store.createdAt
							}
						: null;

					// For async mode, also show current ALS context
					if (managerType === "AsyncContextManager") {
						try {
							const currentCtx = slothlet.contextManager.tryGetContext();
							result.currentALSContext = currentCtx
								? {
										instanceID: currentCtx.instanceID,
										context: currentCtx.context,
										hasParent: !!currentCtx.parentContext
									}
								: null;
						} catch (error) {
							result.currentALSContext = null;
						}
					}

					// For live mode, show currentInstanceID tracking
					if (managerType === "LiveContextManager") {
						result.currentInstanceID = slothlet.contextManager.currentInstanceID;
					}

					return result;
				},

				/**
				 * Execute a callback with isolated context data.
				 * @param {Object} contextData - Context data to merge
				 * @param {Function} callback - Function to execute
				 * @param {...*} args - Additional arguments to pass to callback
				 * @returns {Promise<*>} Result of callback execution
				 * @public
				 */
				run: this.createRunFunction(),

				/**
				 * Execute a function with isolated context using structured options.
				 * @param {Object} options - Scope options
				 * @param {Object} options.context - Context data to merge
				 * @param {Function} options.fn - Function to execute
				 * @param {Array} [options.args] - Arguments array for the function
				 * @param {string} [options.merge] - Merge strategy: "shallow" or "deep"
				 * @returns {Promise<*>} Result of function execution
				 * @public
				 */
				scope: this.createScopeFunction()
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
					if (!slothlet.handlers?.metadata) {
						throw new slothlet.SlothletError("METADATA_NOT_AVAILABLE", {
							hint: "Metadata handler not initialized - this is a bug"
						});
					}
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
					if (!slothlet.handlers?.metadata) {
						throw new slothlet.SlothletError("METADATA_NOT_AVAILABLE", {
							hint: "Metadata handler not initialized - this is a bug",
							handlersKeys: slothlet.handlers ? Object.keys(slothlet.handlers) : "handlers undefined"
						});
					}
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
				// Check if reload mutation is allowed
				if (!config.api?.mutations?.reload) {
					throw new slothlet.SlothletError("INVALID_CONFIG_MUTATIONS_DISABLED", {
						operation: "reload",
						hint: "API mutation 'reload' is disabled by configuration. Set api.mutations.reload: true to enable.",
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
			},

			/**
			 * Ownership management namespace
			 * @type {object}
			 */
			owner: {
				/**
				 * Get ownership info for a specific API path
				 * @param {string} apiPath - API path to check
				 * @returns {Set<string>|null} Set of moduleIds that own this path, or null if path not found
				 */
				get: (apiPath) => {
					if (slothlet.handlers?.ownership) {
						return slothlet.handlers.ownership.getPathOwnership(apiPath);
					}
					return null;
				}
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
				},

				/**
				 * Ownership management namespace
				 * @type {object}
				 */
				owner: {
					/**
					 * Get ownership info for a specific API path
					 * @param {string} apiPath - API path to check
					 * @returns {Set<string>|null} Set of moduleIds that own this path, or null if path not found
					 */
					get: (apiPath) => {
						if (slothlet.handlers?.ownership) {
							return slothlet.handlers.ownership.getPathOwnership(apiPath);
						}
						return null;
					}
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
	 * Create root-level run function (per-request context isolation)
	 * @returns {Function} Run function that executes callbacks with isolated context
	 * @private
	 */
	createRunFunction() {
		const slothlet = this.slothlet;
		const runFunction = {
			run: async (contextData, callback, ...args) => {
				// Check if per-request context is disabled
				if (slothlet.config.scope === false) {
					throw new Error("Per-request context isolation is disabled. Set scope: {} in config to enable.");
				}

				// Validate parameters
				if (!contextData || typeof contextData !== "object") {
					throw new Error("Context data must be an object");
				}
				if (typeof callback !== "function") {
					throw new Error("Callback must be a function");
				}

				// Get current context manager
				const contextManager = slothlet.contextManager;
				if (!contextManager) {
					throw new slothlet.SlothletError("NO_CONTEXT_MANAGER", {}, null, { validationError: true });
				}

				// Get default merge strategy from config
				const mergeStrategy = slothlet.config.scope?.merge || "shallow";

				// Helper for deep merge
				const deepMerge = (target, source) => {
					const result = { ...target };
					for (const key in source) {
						if (source[key] && typeof source[key] === "object" && !Array.isArray(source[key])) {
							result[key] = deepMerge(target[key] || {}, source[key]);
						} else {
							result[key] = source[key];
						}
					}
					return result;
				};

				// For live binding mode, temporarily merge context
				if (contextManager.constructor.name === "LiveContextManager") {
					// CRITICAL: Get the store for THIS instance, not the currently active instance
					const store = contextManager.instances.get(slothlet.instanceID);
					if (!store) {
						throw new slothlet.SlothletError("CONTEXT_NOT_FOUND", { instanceID: slothlet.instanceID });
					}

					const originalContext = { ...store.context };
					const previousInstanceID = contextManager.currentInstanceID;

					try {
						// Apply merge strategy
						if (mergeStrategy === "deep") {
							store.context = deepMerge(originalContext, contextData);
						} else {
							// Shallow merge (default)
							Object.assign(store.context, contextData);
						}

						// Set as current instance for the duration of the callback
						contextManager.currentInstanceID = slothlet.instanceID;

						// Execute callback
						return await callback(...args);
					} finally {
						// Restore original context and instance ID
						store.context = originalContext;
						contextManager.currentInstanceID = previousInstanceID;
					}
				}

				// For async mode, use nested ALS run
				if (contextManager.constructor.name === "AsyncContextManager") {
					// Try to get current store, or use base store if not in active context
					let currentStore = contextManager.tryGetContext();
					const activeStore = currentStore; // Save for parentContext

					if (!currentStore || currentStore.instanceID !== slothlet.instanceID) {
						// Not in active context for THIS instance - get base store
						const baseStore = contextManager.instances.get(slothlet.instanceID);
						if (!baseStore) {
							throw new slothlet.SlothletError("CONTEXT_NOT_FOUND", { instanceID: slothlet.instanceID });
						}
						currentStore = baseStore;
					}

					// Create new store with merged context
					const mergedContext =
						mergeStrategy === "deep" ? deepMerge(currentStore.context, contextData) : { ...currentStore.context, ...contextData };

					const mergedStore = {
						instanceID: slothlet.instanceID, // CRITICAL: Must be THIS instance's ID
						context: mergedContext,
						self: currentStore.self,
						config: currentStore.config,
						createdAt: currentStore.createdAt
					};

					// CRITICAL: Set parentContext when switching from a different instance
					// This allows api.slothlet.context.get() to search up the parent chain
					if (activeStore && activeStore.instanceID !== slothlet.instanceID) {
						mergedStore.parentContext = activeStore;
					}

					// Run callback in new ALS context
					return await contextManager.als.run(mergedStore, async () => {
						return await callback(...args);
					});
				}

				throw new slothlet.SlothletError("UNSUPPORTED_CONTEXT_MANAGER", { manager: contextManager.constructor.name }, null, {
					validationError: true
				});
			}
		}.run;
		return runFunction;
	}

	/**
	 * Create root-level scope function (structured per-request context with options)
	 * @returns {Function} Scope function that executes functions with isolated context
	 * @private
	 */
	createScopeFunction() {
		const slothlet = this.slothlet;
		const scopeFunction = {
			scope: async (options) => {
				// Check if per-request context is disabled
				if (slothlet.config.scope === false) {
					throw new Error("Per-request context isolation is disabled. Set scope: {} in config to enable.");
				}

				// Validate parameters
				if (!options || typeof options !== "object") {
					throw new Error("Options must be an object");
				}
				if (!options.fn || typeof options.fn !== "function") {
					throw new Error("fn must be a function");
				}
				if (!options.context || typeof options.context !== "object") {
					throw new Error("context must be an object");
				}

				const { context: contextData, fn, args = [], merge = "shallow" } = options;

				// Validate merge strategy
				if (merge !== "shallow" && merge !== "deep") {
					throw new Error(`Invalid merge strategy: "${merge}". Must be "shallow" or "deep".`);
				}

				// Get current context manager
				const contextManager = slothlet.contextManager;
				if (!contextManager) {
					throw new slothlet.SlothletError("NO_CONTEXT_MANAGER", {}, null, { validationError: true });
				}

				// Helper for deep merge
				const deepMerge = (target, source) => {
					const result = { ...target };
					for (const key in source) {
						if (source[key] && typeof source[key] === "object" && !Array.isArray(source[key])) {
							result[key] = deepMerge(target[key] || {}, source[key]);
						} else {
							result[key] = source[key];
						}
					}
					return result;
				};

				// For live binding mode, temporarily merge context
				if (contextManager.constructor.name === "LiveContextManager") {
					let store;
					try {
						store = contextManager.getContext();
					} catch (error) {
						// No active context - get instance store directly
						store = contextManager.instances.get(slothlet.instanceID);
						if (!store) {
							throw new slothlet.SlothletError("CONTEXT_NOT_FOUND", { instanceID: slothlet.instanceID });
						}
					}

					const originalContext = { ...store.context };
					const previousInstanceID = contextManager.currentInstanceID;

					try {
						// Apply merge strategy
						if (merge === "deep") {
							store.context = deepMerge(originalContext, contextData);
						} else {
							// Shallow merge (default)
							Object.assign(store.context, contextData);
						}

						// Set as current instance for the duration of the callback
						contextManager.currentInstanceID = slothlet.instanceID;

						// Execute callback
						return await fn(...args);
					} finally {
						// Restore original context and instance ID
						store.context = originalContext;
						contextManager.currentInstanceID = previousInstanceID;
					}
				}

				// For async mode, use nested ALS run
				if (contextManager.constructor.name === "AsyncContextManager") {
					// Try to get current store, or use base store if not in active context
					let currentStore = contextManager.tryGetContext();
					if (!currentStore) {
						// Not in active context - create base store from instance config
						currentStore = {
							instanceID: slothlet.instanceID,
							context: { ...(slothlet.context || {}) },
							self: {} // Will be populated when actual API function is called
						};
					}

					// Create new store with merged context
					const mergedContext =
						merge === "deep" ? deepMerge(currentStore.context, contextData) : { ...currentStore.context, ...contextData };

					const mergedStore = {
						...currentStore,
						context: mergedContext
					};

					// Run callback in new ALS context
					return await contextManager.als.run(mergedStore, async () => {
						return await fn(...args);
					});
				}

				throw new slothlet.SlothletError("UNSUPPORTED_CONTEXT_MANAGER", { manager: contextManager.constructor.name }, null, {
					validationError: true
				});
			}
		}.scope;
		return scopeFunction;
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
