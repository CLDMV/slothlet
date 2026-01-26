/**
 * @fileoverview Main Slothlet orchestrator
 * @module @cldmv/slothlet
 */
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { getContextManager } from "@cldmv/slothlet/factories/context";
import { SlothletError, SlothletWarning, SlothletDebug } from "@cldmv/slothlet/errors";

/**
 * Slothlet instance - clean architecture prototype
 * @private
 */
class Slothlet {
	// Reserved root-level API keys that should be skipped by recursive functions
	// Only applies at the root level (path depth 0) - nested keys with same name are allowed
	static RESERVED_ROOT_KEYS = ["slothlet", "shutdown", "destroy"];

	constructor() {
		// Expose error classes to components (no imports needed)
		this.SlothletError = SlothletError;
		this.SlothletWarning = SlothletWarning;
		// Debug logger will be initialized in load() with config
		this.debugLogger = null;

		// Instance properties
		this.instanceID = null;
		this.config = null;
		this.api = null;
		this.boundApi = null;
		this.contextManager = null;
		this.isLoaded = false;
		this.reference = null;
		this.context = null;

		// Component categories
		this.componentCategories = ["helpers", "handlers", "builders", "processors"];

		// Component namespaces (populated by _initializeComponents)
		for (const category of this.componentCategories) {
			this[category] = {};
		}
	}

	/**
	 * Initialize all component class instances via auto-discovery
	 * Organizes components into namespaces: helpers.*, handlers.*, builders.*, processors.*
	 * @private
	 */
	async _initializeComponents() {
		// Auto-discover helpers, handlers, builders, processors
		// NOTE: Does NOT auto-discover:
		//   - errors/ (throw-able classes, not instance components)
		//   - runtime/ (context managers set manually during load)
		//   - modes/ (lazy/eager mode handlers, not instance components)
		//   - i18n/ (translation utilities, not instance components)

		const baseDir = join(import.meta.dirname, "lib");

		for (const category of this.componentCategories) {
			const categoryDir = join(baseDir, category);
			const files = readdirSync(categoryDir).filter((f) => f.endsWith(".mjs"));

			for (const file of files) {
				const filePath = join(categoryDir, file);

				try {
					const module = await import(pathToFileURL(filePath).href);

					// Find ALL exported classes with slothletProperty (supports multiple per file)
					const classExports = Object.values(module).filter((exp) => typeof exp === "function" && exp.slothletProperty);

					for (const ClassExport of classExports) {
						const propName = ClassExport.slothletProperty;
						// Organize into category namespace
						this[category][propName] = new ClassExport(this);

						if (this.config?.debug?.initialization) {
							this.debug("initialization", {
								message: `Component initialized: ${ClassExport.name} → this.${category}.${propName}`,
								component: ClassExport.name,
								category,
								propertyName: propName
							});
						}
					}
				} catch (error) {
					// Skip files that fail to import
					// Only error if a component with slothletProperty can't be loaded
					if (this.config?.debug?.initialization) {
						new this.SlothletWarning("WARNING_INIT_COMPONENT_SKIPPED", {
							file,
							error: error.message
						});
					}
				}
			}
		}

		// Special case: contextManager is set during load based on runtime
		this.contextManager = null;
	}

	/**
	 * Load API from directory
	 * @param {Object} config - Configuration options
	 * @param {string} config.dir - Directory to load API from
	 * @param {string} [config.mode="eager"] - Loading mode (eager or lazy)
	 * @param {string} [config.runtime="async"] - Runtime type (async or live)
	 * @returns {Promise<Object>} Bound API object
	 * @public
	 * @example
	 * const slothlet = new Slothlet();
	 * const api = await slothlet.load({
	 *   dir: "./api_tests/api_test",
	 *   mode: "eager",
	 *   runtime: "async"
	 * });
	 */
	async load(config = {}) {
		// Store raw config for components to access if needed
		this.config = config;

		// Initialize all components via auto-discovery BEFORE transforming config
		// This allows config helpers to be component classes
		await this._initializeComponents();

		// Transform and validate config using component classes
		this.config = this.helpers.config.transformConfig(config);

		// Initialize debug logger with config
		this.debugLogger = new SlothletDebug(this.config);

		// Generate instance ID using utilities component
		this.instanceID = this.helpers.utilities.generateId();

		// Store reference and context from config
		this.reference = this.config.reference;
		this.context = this.config.context;

		// Get appropriate context manager based on runtime
		this.contextManager = getContextManager(this.config.runtime);

		// Initialize context
		const store = this.contextManager.initialize(this.instanceID, this.config);

		// Note: ownership manager already initialized via auto-discovery

		// Generate base moduleId for ownership tracking
		const baseModuleId = `base_${this.helpers.utilities.generateId().substring(0, 8)}`;

		// Build raw API (with context manager and instance ID for unified wrapper)
		// UnifiedWrapper handles context binding internally - no separate wrapper needed!
		this.api = await this.builders.builder.buildAPI({
			dir: this.config.dir,
			mode: this.config.mode,
			moduleId: baseModuleId
		});

		// Build final API with builtins attached
		const apiWithBuiltins = await this.buildFinalAPI(this.api);

		// Inject runtime-aware metadata functions that have proper context access
		this.injectRuntimeMetadataFunctions(apiWithBuiltins);

		// Apply init metadata if provided in config
		if (this.config.metadata && typeof this.config.metadata === "object") {
			// Set as global metadata so it's inherited by all future api.add() calls
			for (const [key, value] of Object.entries(this.config.metadata)) {
				this.handlers.metadata.setGlobalMetadata(key, value);
			}

			// Register user metadata for base moduleID
			this.handlers.metadata.registerUserMetadata(baseModuleId, "", this.config.metadata);
		}

		// Register all API paths with ownership manager AFTER building final API
		// This ensures builtins (slothlet, shutdown, destroy) are also registered
		if (this.handlers.ownership) {
			this.registerAPIWithOwnership(apiWithBuiltins, "base", "");
		}

		// UnifiedWrapper already handles context binding, so no additional wrapping needed
		this.boundApi = apiWithBuiltins;

		// Set self and context in store
		store.self = this.boundApi;
		store.context = this.context || {}; // User-provided context from config

		// TODO: Merge reference object using add API system for ownership tracking
		// For now, directly assign to boundApi (will be replaced with proper add API)
		if (this.reference && typeof this.reference === "object") {
			Object.assign(this.boundApi, this.reference);
		}

		this.isLoaded = true;

		return this.boundApi;
	}

	/**
	 * Reload entire instance (creates new references)
	 * @public
	 */
	async reload() {
		if (!this.isLoaded) {
			throw new SlothletError("INVALID_CONFIG_NOT_LOADED", {
				operation: "reload",
				validationError: true
			});
		}

		// TODO: Implement full reload
		throw new SlothletError("INVALID_CONFIG_RELOAD_NOT_IMPL", {}, null, { validationError: true });
	}

	/**
	 * Inject runtime-aware metadata functions into api.slothlet.metadata
	 * These functions use the context manager to access current execution context
	 * @param {Object} api - API object with slothlet namespace
	 * @private
	 */
	injectRuntimeMetadataFunctions(api) {
		if (!api.slothlet?.metadata) {
			return;
		}

		const contextManager = this.contextManager;
		const metadataHandler = this.handlers.metadata;
		const apiRoot = api; // Use the api parameter passed in (apiWithBuiltins)

		// Add get() - Get metadata by API path string
		api.slothlet.metadata.get = async function slothlet_metadata_get_runtime(path) {
			if (typeof path !== "string") {
				throw new SlothletError("INVALID_ARGUMENT", {
					argument: "path",
					expected: "string",
					received: typeof path,
					hint: "Path must be a dot-notation string (e.g., 'math.add')"
				});
			}

			const ctx = contextManager.tryGetContext();
			if (!ctx || !ctx.self) {
				throw new SlothletError("RUNTIME_NO_ACTIVE_CONTEXT_SELF", {}, null, {
					validationError: true,
					hint: "metadata.get() must be called from within a slothlet API function"
				});
			}

			// Traverse the path from API root (not from current module's self)
			const parts = path.split(".");
			let target = apiRoot;

			for (const part of parts) {
				// Allow traversal through both objects AND functions (functions can have properties)
				if (!target || (typeof target !== "object" && typeof target !== "function")) {
					console.log("[metadata.get] Traversal failed at part:", part, "target type:", typeof target);
					return null;
				}
				target = target[part];
			}

			console.log("[metadata.get] Traversal complete for path:", path, {
				targetType: typeof target,
				isFunction: typeof target === "function",
				hasImpl: target && target._impl,
				hasMaterialize: target && typeof target.__materialize === "function"
			});

			// If target is a lazy proxy (has __materialize), materialize it first
			if (target && typeof target.__materialize === "function") {
				console.log("[metadata.get] Materializing lazy proxy");
				await target.__materialize();
			}

			// Get metadata for the resolved function
			if (typeof target === "function" || (target && target._impl)) {
				console.log("[metadata.get] Calling getMetadata on target");
				return metadataHandler.getMetadata(target);
			}

			console.log("[metadata.get] Target is not a function or wrapper, returning null");
			return null;
		};

		// Add self() - Get metadata for currently executing function
		api.slothlet.metadata.self = function slothlet_metadata_self_runtime() {
			const ctx = contextManager.tryGetContext();
			if (!ctx || !ctx.currentWrapper) {
				throw new SlothletError("RUNTIME_NO_ACTIVE_CONTEXT", {}, null, {
					validationError: true,
					hint: "metadata.self() must be called from within a slothlet API function"
				});
			}

			return metadataHandler.getMetadata(ctx.currentWrapper);
		};

		// Add caller() - Get metadata for calling function
		api.slothlet.metadata.caller = function slothlet_metadata_caller_runtime() {
			const ctx = contextManager.tryGetContext();
			if (!ctx || !ctx.callerWrapper) {
				// No caller in context (e.g., called from outside API)
				return null;
			}

			return metadataHandler.getMetadata(ctx.callerWrapper);
		};
	}

	/**
	 * Shutdown instance and cleanup resources
	 * @public
	 */
	async shutdown() {
		if (!this.isLoaded) {
			return;
		}

		// Cleanup context
		if (this.instanceID && this.contextManager) {
			this.contextManager.cleanup(this.instanceID);
		}

		// Clear ownership
		if (this.handlers.ownership) {
			this.handlers.ownership.clear();
		}

		// Clear references
		this.api = null;
		this.boundApi = null;
		this.isLoaded = false;
	}

	/**
	 * Log debug message if debug flag is enabled
	 * @param {string} code - Debug code/category
	 * @param {Object} context - Debug context
	 * @public
	 *
	 * @example
	 * this.slothlet.debug("wrapper", { apiPath: "math", action: "materialized" });
	 */
	debug(code, context = {}) {
		if (this.debugLogger) {
			this.debugLogger.log(code, context);
		}
	}

	/**
	 * Recursively register API structure with ownership manager
	 * @param {Object} api - API object or value
	 * @param {string} moduleId - Module identifier (owner)
	 * @param {string} path - Current API path
	 * @param {WeakSet} [visited] - WeakSet to track visited objects (prevents circular refs)
	 * @param {string[]} [pathStack] - Path stack to track current depth
	 * @private
	 */
	registerAPIWithOwnership(api, moduleId, path, visited = new WeakSet(), pathStack = []) {
		if (!api || typeof api !== "object") return;

		// Prevent infinite recursion on circular references
		if (visited.has(api)) {
			return;
		}
		visited.add(api);

		// Register this level
		if (path) {
			this.handlers.ownership.register({
				moduleId,
				apiPath: path,
				value: api,
				source: "core",
				collisionMode: "merge",
				filePath: null
			});
		}

		// Recursively register children
		for (const [key, value] of Object.entries(api)) {
			// Skip reserved root-level keys ONLY at depth 0
			const isRootLevel = pathStack.length === 0;
			const isReservedKey = Slothlet.RESERVED_ROOT_KEYS.includes(key);
			if (isRootLevel && isReservedKey) {
				continue;
			}

			const childPath = path ? `${path}.${key}` : key;
			if (typeof value === "function" || (value && typeof value === "object")) {
				this.handlers.ownership.register({
					moduleId,
					apiPath: childPath,
					value,
					source: "core",
					collisionMode: "merge",
					filePath: null
				});

				// Recurse for objects (but not functions with properties - handle separately if needed)
				if (typeof value === "object" && !Array.isArray(value)) {
					this.registerAPIWithOwnership(value, moduleId, childPath, visited, [...pathStack, key]);
				}
			}
		}
	}

	/**
	 * Get current API
	 * @returns {Object} Bound API object
	 * @public
	 */
	getAPI() {
		if (!this.isLoaded) {
			throw new SlothletError(
				"INVALID_CONFIG_NOT_LOADED",
				{
					operation: "getAPI"
				},
				null,
				{ validationError: true }
			);
		}
		return this.boundApi;
	}

	/**
	 * Get diagnostic information
	 * @returns {Object} Diagnostic data
	 * @public
	 */
	getDiagnostics() {
		return {
			instanceID: this.instanceID,
			isLoaded: this.isLoaded,
			config: this.config,
			context: this.contextManager?.getDiagnostics() || null,
			ownership: this.handlers.ownership?.getDiagnostics() || null
		};
	}

	/**
	 * Get ownership information
	 * @returns {Object} Ownership data
	 * @public
	 */
	getOwnership() {
		if (!this.handlers.ownership) {
			return null;
		}
		return this.handlers.ownership.getDiagnostics();
	}

	/**
	 * Build final API with built-in methods attached
	 * @param {Object} userApi - Raw user API from load()
	 * @returns {Object} Final API with built-ins
	 * @private
	 */
	buildFinalAPI(userApi) {
		return this.builders.apiBuilder.buildFinalAPI(userApi);
	}
}

/**
 * Create new Slothlet instance and load API
 * Middleware function that delegates to Slothlet class
 * @param {Object} config - Configuration options
 * @returns {Promise<Object>} Bound API object with control methods
 * @public
 * @example
 * const api = await slothlet({ dir: "./api_tests/api_test" });
 * // Use API
 * const result = api.math.add(2, 3);
 * // Hot reload
 * await api.api.reload();
 * // Full reload
 * await api.reload();
 * // Shutdown when done
 * await api.api.shutdown();
 */
export async function slothlet(config) {
	const instance = new Slothlet();
	const api = await instance.load(config);

	// API already has builtins attached from load()
	return api;
}

export default slothlet;
