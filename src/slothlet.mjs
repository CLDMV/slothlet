/**
 * @fileoverview Main Slothlet orchestrator
 * @module @cldmv/slothlet
 */
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { getContextManager } from "@cldmv/slothlet/factories/context";
import { SlothletError, SlothletWarning } from "@cldmv/slothlet/errors";
import { transformConfig } from "@cldmv/slothlet/helpers/config";

/**
 * Slothlet instance - clean architecture prototype
 * @private
 */
class Slothlet {
	constructor() {
		// Expose error classes to components (no imports needed)
		this.SlothletError = SlothletError;
		this.SlothletWarning = SlothletWarning;

		// Instance properties
		this.instanceID = null;
		this.config = null;
		this.api = null;
		this.boundApi = null;
		this.ownership = null;
		this.contextManager = null;
		this.isLoaded = false;
		this.reference = null;
		this.context = null;

		// Component namespaces (populated by _initializeComponents)
		this.helpers = {};
		this.handlers = {};
		this.builders = {};
		this.processors = {};
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

		const categories = ["helpers", "handlers", "builders", "processors"];
		const baseDir = join(import.meta.dirname, "lib");

		for (const category of categories) {
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
							console.log(`[INIT] ${ClassExport.name} → this.${category}.${propName}`);
						}
					}
				} catch (error) {
					// Skip files that fail to import
					// Only error if a component with slothletProperty can't be loaded
					if (this.config?.debug?.initialization) {
						console.warn(`[INIT] Skipped ${file}: ${error.message}`);
					}
				}
			}
		}

		// Special case: contextManager is set during load based on runtime
		this.contextManager = null;

		// Backwards compatibility: expose commonly-used components at root level
		this.utilities = this.helpers.utilities;
		this.apiManager = this.handlers.apiManager;
		this.ownership = this.handlers.ownership;
		this.metadata = this.handlers.metadata;
		this.builder = this.builders.builder;
		this.apiBuilder = this.builders.apiBuilder;
		this.apiAssignment = this.builders.apiAssignment;
		this.modesProcessor = this.builders.modesProcessor;
		this.loader = this.processors.loader;
		this.flatten = this.processors.flatten;
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
		this.config = transformConfig(config);

		// Generate instance ID using utilities component
		this.instanceID = this.utilities.generateId();

		// Store reference and context from config
		this.reference = this.config.reference;
		this.context = this.config.context;

		// Get appropriate context manager based on runtime
		this.contextManager = getContextManager(this.config.runtime);

		// Initialize context
		const store = this.contextManager.initialize(this.instanceID, this.config);

		// Note: ownership manager already initialized via auto-discovery

		// Build raw API (with context manager and instance ID for unified wrapper)
		// UnifiedWrapper handles context binding internally - no separate wrapper needed!
		this.api = await this.builder.buildAPI({
			dir: this.config.dir,
			mode: this.config.mode
		});

		// Build final API with builtins attached
		const apiWithBuiltins = await this.buildFinalAPI(this.api);

		// Register all API paths with ownership manager AFTER building final API
		// This ensures builtins (slothlet, shutdown, destroy) are also registered
		if (this.ownership) {
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
		if (this.ownership) {
			this.ownership.clear();
		}

		// Clear references
		this.api = null;
		this.boundApi = null;
		this.ownership = null;
		this.isLoaded = false;
	}

	/**
	 * Recursively register API structure with ownership manager
	 * @param {Object} api - API object or value
	 * @param {string} moduleId - Module identifier (owner)
	 * @param {string} path - Current API path
	 * @private
	 */
	registerAPIWithOwnership(api, moduleId, path) {
		if (!api || typeof api !== "object") return;

		// Register this level
		if (path) {
			this.ownership.register({
				moduleId,
				apiPath: path,
				value: api,
				source: "core",
				collisionMode: "merge"
			});
		}

		// Recursively register children
		for (const [key, value] of Object.entries(api)) {
			const childPath = path ? `${path}.${key}` : key;
			if (typeof value === "function" || (value && typeof value === "object")) {
				this.ownership.register({
					moduleId,
					apiPath: childPath,
					value,
					source: "core",
					collisionMode: "merge"
				});

				// Recurse for objects (but not functions with properties - handle separately if needed)
				if (typeof value === "object" && !Array.isArray(value)) {
					this.registerAPIWithOwnership(value, moduleId, childPath);
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
			ownership: this.ownership?.getDiagnostics() || null
		};
	}

	/**
	 * Get ownership information
	 * @returns {Object} Ownership data
	 * @public
	 */
	getOwnership() {
		if (!this.ownership) {
			return null;
		}
		return this.ownership.getDiagnostics();
	}

	/**
	 * Build final API with built-in methods attached
	 * @param {Object} userApi - Raw user API from load()
	 * @returns {Object} Final API with built-ins
	 * @private
	 */
	buildFinalAPI(userApi) {
		return this.apiBuilder.buildFinalAPI(userApi);
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
