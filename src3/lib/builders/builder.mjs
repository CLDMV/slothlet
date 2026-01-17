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
 * @param {Object} [options.config={}] - Configuration
 * @returns {Promise<Object>} Raw API object (unwrapped)
 * @public
 */
export async function buildAPI(options) {
	const { dir, mode = "eager", ownership, config = {} } = options;

	// Validate inputs
	if (!dir || typeof dir !== "string") {
		throw await SlothletError.create("INVALID_CONFIG_DIR_INVALID", {
			value: dir
		});
	}

	if (mode !== "eager" && mode !== "lazy") {
		throw await SlothletError.create("INVALID_CONFIG_MODE_INVALID", {
			value: mode
		});
	}

	// Build based on mode - each mode handles its own scanning and flattening
	let rawAPI;
	if (mode === "eager") {
		rawAPI = await buildEagerAPI({ dir, ownership, config });
	} else if (mode === "lazy") {
		rawAPI = await buildLazyAPI({ dir, ownership, config });
	} else {
		throw await SlothletError.create("INVALID_CONFIG_MODE_UNKNOWN", {
			mode
		});
	}

	return rawAPI;
}
