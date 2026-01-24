/**
 * @fileoverview Main Slothlet orchestrator
 * @module @cldmv/slothlet
 */
import { getContextManager } from "@cldmv/slothlet/factories/context";
import { OwnershipManager } from "@cldmv/slothlet/handlers/ownership";
import { ApiManager } from "@cldmv/slothlet/handlers/api-manager";
import { Builder } from "@cldmv/slothlet/builders/builder";
import { ApiBuilder } from "@cldmv/slothlet/builders/api_builder";
import { ApiAssignment } from "@cldmv/slothlet/builders/api-assignment";
import { ModesProcessor } from "@cldmv/slothlet/builders/modes-processor";
import { SlothletError, SlothletWarning } from "@cldmv/slothlet/errors";
import { generateId } from "@cldmv/slothlet/helpers/utilities";
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

		// Instantiate component classes
		this.apiManager = new ApiManager(this);
		this.builder = new Builder(this);
		this.apiBuilder = new ApiBuilder(this);
		this.apiAssignment = new ApiAssignment(this);
		this.modesProcessor = new ModesProcessor(this);
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
		// Transform and validate config
		this.config = transformConfig(config);

		// Generate instance ID
		this.instanceID = generateId();

		// Store reference and context from config
		this.reference = this.config.reference;
		this.context = this.config.context;

		// Get appropriate context manager based on runtime
		this.contextManager = getContextManager(this.config.runtime);

		// Initialize context
		const store = this.contextManager.initialize(this.instanceID, this.config);

		// Initialize ownership manager
		this.ownership = new OwnershipManager();

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
