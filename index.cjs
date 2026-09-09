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

/**
 * `slothlet.defaults` (#341), attached best-effort for CJS consumers.
 *
 * @description
 * The ESM entry (`index.mjs`) attaches `slothlet.defaults` via a static import, so it is set
 * before any `import`'s continuation runs. A CJS `require()` cannot await a promise before
 * returning, so this assignment resolves on the microtask queue shortly after `require()`
 * returns rather than synchronously within it — every realistic use (inside an async function,
 * after any `await`, or building a `routines` array to pass to a later `slothlet({...})` call)
 * observes it populated; only code reading `require("@cldmv/slothlet").defaults` in the same
 * synchronous tick as the `require()` call itself would see `undefined` first. Best-effort: a
 * failed re-import (an unsupported environment, a resolution error) is swallowed rather than left
 * as an unhandled rejection — `.defaults` simply stays unset in that case.
 */
import("./index.mjs")
	.then((mod) => {
		module.exports.defaults = mod.default.defaults;
	})
	.catch(() => {});
