/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /index.cjs
 *	@Date: 2025-11-09T11:15:17-08:00 (1762715717)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-03T22:14:50-07:00 (1791090890)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview CommonJS entry point for @cldmv/slothlet - a thin wrapper that loads the ESM entry (index.mjs) for a single source of truth.
 * @module @cldmv/slothlet
 */
"use strict";

// index.cjs is a thin wrapper: it loads index.mjs through Node's synchronous require(esm).
// Node.js versions without require(esm) would fail with a bare ERR_REQUIRE_ESM, so fail
// early with a message that says what to do instead.
if (!process.features?.require_module) {
	const error = new Error(
		`@cldmv/slothlet: require() needs Node.js ^20.19.0 or >=22.12.0 (this is ${process.version}). On older Node.js, load the package with import() instead.`
	);
	error.code = "ERR_REQUIRE_ESM";
	throw error;
}

const esm = require("./index.mjs");

/**
 * CommonJS default export: the same `slothlet` function the ESM entry exports as its default.
 * It creates a slothlet API instance; `slothlet.defaults` (#341) is available synchronously,
 * right after `require()` returns.
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
 *
 * @example // Defaults, available synchronously
 * const { defaults } = require("@cldmv/slothlet");
 * console.log(defaults.routines);
 */
module.exports = esm.default;

/**
 * Named export alias for the slothlet function.
 * Provides the same functionality as the default export.
 * @public
 * @type {Function}
 *
 * @example // CJS named destructuring
 * const { slothlet } = require("@cldmv/slothlet");
 * const api = await slothlet({ base: "./api" });
 */
module.exports.slothlet = esm.slothlet;
