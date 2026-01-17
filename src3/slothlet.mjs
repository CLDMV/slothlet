/**
 * @fileoverview Main Slothlet orchestrator
 * @module @cldmv/slothlet
 */
import { getContextManager } from "@cldmv/slothlet/handlers/context";
import { OwnershipManager } from "@cldmv/slothlet/handlers/ownership";
import { WrapperManager } from "@cldmv/slothlet/handlers/wrapper";
import { buildAPI } from "@cldmv/slothlet/builders/builder";
import { buildFinalAPI } from "@cldmv/slothlet/builders/api_builder";
import { SlothletError } from "@cldmv/slothlet/errors";
import { generateId } from "@cldmv/slothlet/helpers/utilities";
import { transformConfig } from "@cldmv/slothlet/helpers/config";

/**
 * Slothlet instance - clean architecture prototype
 * @private
 */
class Slothlet {
	constructor() {
		this.instanceId = null;
		this.config = null;
		this.api = null;
		this.boundApi = null;
		this.ownership = null;
		this.wrapper = null;
		this.contextManager = null;
		this.isLoaded = false;
		this.reference = null;
		this.context = null;
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
		this.instanceId = generateId();

		// Store reference and context from config
		this.reference = this.config.reference;
		this.context = this.config.context;

		// Get appropriate context manager based on runtime
		this.contextManager = getContextManager(this.config.runtime);

		// Initialize context
		const store = this.contextManager.initialize(this.instanceId, this.config);

		// Initialize ownership manager
		this.ownership = new OwnershipManager();

		// Build raw API
		this.api = await buildAPI({
			dir: this.config.dir,
			mode: this.config.mode,
			ownership: this.ownership,
			config: this.config
		});

		// Initialize wrapper manager with appropriate context manager
		this.wrapper = new WrapperManager(this.contextManager);

		// Wrap user API with context isolation FIRST
		const wrappedUserApi = this.wrapper.wrapAPI(this.api, this.instanceId);

		// Then attach builtins on top (they don't need wrapping - already bound to instance)
		this.boundApi = await this.buildFinalAPI(wrappedUserApi);

		// Set self and context in store
		store.self = this.boundApi;
		store.context = this.context || {}; // User-provided context from config

		// Merge reference object into API if provided
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
			throw await SlothletError.create("INVALID_CONFIG_NOT_LOADED", {
				operation: "reload"
			});
		}

		// TODO: Implement full reload
		throw await SlothletError.create("INVALID_CONFIG_RELOAD_NOT_IMPL");
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
		if (this.instanceId && this.contextManager) {
			this.contextManager.cleanup(this.instanceId);
		}

		// Clear ownership
		if (this.ownership) {
			this.ownership.clear();
		}

		// Clear references
		this.api = null;
		this.boundApi = null;
		this.ownership = null;
		this.wrapper = null;
		this.isLoaded = false;
	}

	/**
	 * Get current API
	 * @returns {Object} Bound API object
	 * @public
	 */
	getAPI() {
		if (!this.isLoaded) {
			throw new SlothletError("INVALID_CONFIG_NOT_LOADED", {
				operation: "getAPI"
			});
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
			instanceId: this.instanceId,
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
		return buildFinalAPI({
			userApi,
			instance: this,
			config: this.config
		});
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
