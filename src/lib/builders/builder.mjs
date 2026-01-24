/**
 * @fileoverview API building orchestration (mode-agnostic)
 * @module @cldmv/slothlet/builder
 */
import { ComponentBase } from "@cldmv/slothlet/factories/component-base";
import { buildEagerAPI } from "@cldmv/slothlet/modes/eager";
import { buildLazyAPI } from "@cldmv/slothlet/modes/lazy";

/**
 * API builder class for orchestrating mode-based API construction.
 * @class Builder
 * @extends ComponentBase
 * @package
 *
 * @description
 * Orchestrates API building by delegating to mode-specific builders (eager/lazy).
 * Extends ComponentBase for access to Slothlet configuration and error classes.
 *
 * @example
 * const builder = new Builder(slothlet);
 * const api = await builder.buildAPI({ dir: "./api" });
 */
export class Builder extends ComponentBase {
	/**
	 * Create Builder instance.
	 * @param {object} slothlet - Slothlet orchestrator instance.
	 * @package
	 *
	 * @description
	 * Stores Slothlet reference for accessing configuration and components.
	 *
	 * @example
	 * const builder = new Builder(slothlet);
	 */
	constructor(slothlet) {
		super(slothlet);
	}

	/**
	 * Get ownership manager from Slothlet.
	 * @returns {object} Ownership manager instance.
	 * @private
	 */
	get ownership() {
		return this.slothlet.ownership;
	}

	/**
	 * Get context manager from Slothlet.
	 * @returns {object} Context manager instance.
	 * @private
	 */
	get contextManager() {
		return this.slothlet.contextManager;
	}

	/**
	 * Build API from directory.
	 * @param {Object} options - Build options
	 * @param {string} options.dir - Directory to build from
	 * @param {string} [options.mode="eager"] - Loading mode (eager or lazy)
	 * @param {Object} [options.ownership] - Ownership manager (uses slothlet's if not provided)
	 * @param {Object} [options.contextManager] - Context manager (uses slothlet's if not provided)
	 * @param {string} [options.instanceID] - Instance ID (uses slothlet's if not provided)
	 * @param {Object} [options.config] - Configuration (uses slothlet's if not provided)
	 * @param {string} [options.apiPathPrefix=""] - Prefix for API paths (for api.add support)
	 * @param {string} [options.collisionContext="initial"] - Collision context
	 * @returns {Promise<Object>} Raw API object (unwrapped)
	 * @public
	 *
	 * @description
	 * Validates inputs and delegates to mode-specific builder (buildEagerAPI or buildLazyAPI).
	 *
	 * @example
	 * const api = await builder.buildAPI({ dir: "./api_tests/api_test", mode: "eager" });
	 */
	async buildAPI(options) {
		const {
			dir,
			mode = "eager",
			ownership = this.ownership,
			contextManager = this.contextManager,
			instanceID = this.instanceID,
			config = this.config,
			apiPathPrefix = "",
			collisionContext = "initial"
		} = options;

		// Validate inputs
		if (!dir || typeof dir !== "string") {
			throw new this.SlothletError(
				"INVALID_CONFIG_DIR_INVALID",
				{
					dir: dir
				},
				null,
				{ validationError: true }
			);
		}

		if (mode !== "eager" && mode !== "lazy") {
			throw new this.SlothletError(
				"INVALID_CONFIG_MODE_INVALID",
				{
					value: mode
				},
				null,
				{ validationError: true }
			);
		}

		// Build based on mode - each mode handles its own scanning and flattening
		let rawAPI;
		if (mode === "eager") {
			rawAPI = await buildEagerAPI({
				dir,
				ownership,
				contextManager,
				instanceID,
				config,
				apiPathPrefix,
				collisionContext,
				modesProcessor: this.slothlet.modesProcessor,
				loader: this.slothlet.loader,
				flatten: this.slothlet.flatten
			});
		} else if (mode === "lazy") {
			rawAPI = await buildLazyAPI({
				dir,
				ownership,
				contextManager,
				instanceID,
				config,
				apiPathPrefix,
				collisionContext,
				modesProcessor: this.slothlet.modesProcessor,
				loader: this.slothlet.loader,
				flatten: this.slothlet.flatten
			});
		} else {
			throw new this.SlothletError(
				"INVALID_CONFIG_MODE_UNKNOWN",
				{
					mode
				},
				null,
				{ validationError: true }
			);
		}

		return rawAPI;
	}
}
