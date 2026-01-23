/**
 * @fileoverview API building orchestration (mode-agnostic)
 * @module @cldmv/slothlet/builder
 */
import { buildEagerAPI } from "@cldmv/slothlet/modes/eager";
import { buildLazyAPI } from "@cldmv/slothlet/modes/lazy";
import { SlothletError } from "@cldmv/slothlet/errors";

/**
 * Build API from directory
 * @param {Object} options - Build options
 * @param {string} options.dir - Directory to build from
 * @param {string} [options.mode="eager"] - Loading mode (eager or lazy)
 * @param {Object} options.ownership - Ownership manager
 * @param {Object} options.contextManager - Context manager for binding
 * @param {string} options.instanceID - Slothlet instance ID
 * @param {Object} [options.config={}] - Configuration
 * @param {string} [options.apiPathPrefix=""] - Prefix for API paths (for api.add support)
 * @returns {Promise<Object>} Raw API object (unwrapped)
 * @public
 */
export async function buildAPI(options) {
	const {
		dir,
		mode = "eager",
		ownership,
		contextManager,
		instanceID,
		config = {},
		apiPathPrefix = "",
		collisionContext = "initial"
	} = options;

	// Validate inputs
	if (!dir || typeof dir !== "string") {
		throw new SlothletError(
			"INVALID_CONFIG_DIR_INVALID",
			{
				dir: dir
			},
			null,
			{ validationError: true }
		);
	}

	if (mode !== "eager" && mode !== "lazy") {
		throw new SlothletError(
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
		rawAPI = await buildEagerAPI({ dir, ownership, contextManager, instanceID, config, apiPathPrefix, collisionContext });
	} else if (mode === "lazy") {
		rawAPI = await buildLazyAPI({ dir, ownership, contextManager, instanceID, config, apiPathPrefix, collisionContext });
	} else {
		throw new SlothletError(
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
