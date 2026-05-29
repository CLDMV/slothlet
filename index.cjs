/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /index.cjs
 *	@Date: 2025-11-09 11:15:17 -08:00 (1762715717)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-01 20:21:36 -08:00 (1772425296)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview CommonJS entry point for @cldmv/slothlet - imports ESM implementation for single source of truth.
 * @module @cldmv/slothlet
 */

/**
 * CommonJS entry that dynamically imports the ESM implementation.
 * This ensures single source of truth in index.mjs while maintaining CJS compatibility.
 * Eliminates code duplication between entry points and ensures consistent behavior.
 * @public
 * @async
 * @param {import("./src/slothlet.mjs").SlothletOptions} [options={}] - Configuration options for the slothlet instance. See {@link SlothletOptions} for the full set.
 * @returns {Promise<import("./src/slothlet.mjs").SlothletAPI>} The bound API object with management methods
 *
 * @example // CJS usage
 * const slothlet = require("@cldmv/slothlet");
 * const api = await slothlet({ base: "./api", context: { user: "alice" } });
 * console.log(api.config.username); // Access configuration
 *
 * @example // CJS usage with runtime selection
 * const slothlet = require("@cldmv/slothlet");
 * const api = await slothlet({ base: "./api", runtime: "live" });
 *
 * @example // CJS named destructuring
 * const { slothlet } = require("@cldmv/slothlet");
 * const api = await slothlet({ base: "./api" });
 */
async function slothlet(options = {}) {
	// Dynamic import of ESM entry point - single source of truth
	const { default: esmSlothlet } = await import("./index.mjs");
	return esmSlothlet(options);
}

/**
 * CommonJS default export of the slothlet function.
 * @public
 */
module.exports = slothlet;

/**
 * Named export alias for the slothlet function.
 * Provides the same functionality as the default export.
 * @public
 * @type {Function}
 *
 * @example // CJS named destructuring
 * const { slothlet } = require("@cldmv/slothlet");
 * const api = await slothlet({ dir: "./api" });
 */
module.exports.slothlet = slothlet; // optional named alias
