/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_tv_test/controllers/tv-controllers.mjs
 *	@Date: 2025-11-04T20:54:38-08:00 (1762318478)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-01 20:21:16 -08:00 (1772425276)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview TV controllers module for TV Remote testing.
 * @module api_tv_test.controllers.tvControllers
 * @memberof module:api_tv_test
 */
/**
 * @namespace controllers
 * @memberof module:api_tv_test
 * @alias module:api_tv_test.controllers
 */
/**
 * @namespace tvControllers
 * @memberof module:api_tv_test.controllers
 * @alias module:api_tv_test.controllers.tvControllers
 */

class SubfolderTVController {
	constructor(tvId) {
		this.tvId = tvId;
		console.log(`📺 SubfolderTVController created for ${tvId}`);
	}

	powerOn() {
		console.log(`🟢 Subfolder ${this.tvId} powered on`);
		return `Subfolder ${this.tvId} is now ON`;
	}

	powerOff() {
		console.log(`🔴 Subfolder ${this.tvId} powered off`);
		return `Subfolder ${this.tvId} is now OFF`;
	}

	getStatus() {
		return `Subfolder ${this.tvId} status: active`;
	}
}

/**
 * Helper function for subfolder controllers.
 */
/**
 * getControllerCount.
 * @returns {*}
 * @example // ESM usage via slothlet API
 * import slothlet from "@cldmv/slothlet";
 * const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
 * api_tv_test.controllers.tv-controllers.getControllerCount();
 *
 * @example // ESM usage via slothlet API (inside async function)
 * async function example() {
 *   const { default: slothlet } = await import("@cldmv/slothlet");
 *   const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
 *   api_tv_test.controllers.tv-controllers.getControllerCount();
 * }
 *
 * @example // CJS usage via slothlet API (top-level)
 * let slothlet;
 * (async () => {
 *   ({ slothlet } = await import("@cldmv/slothlet"));
 *   const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
 *   api_tv_test.controllers.tv-controllers.getControllerCount();
 * })();
 *
 * @example // CJS usage via slothlet API (inside async function)
 * const slothlet = require("@cldmv/slothlet");
 * const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
 * api_tv_test.controllers.tv-controllers.getControllerCount();
 */
export function getControllerCount() {
	return 4;
}

/**
 * Helper function to validate TV ID.
 */
/**
 * validateTvId.
 * @param {*} tvId - tvId.
 * @returns {*}
 * @example // ESM usage via slothlet API
 * import slothlet from "@cldmv/slothlet";
 * const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
 * api_tv_test.controllers.tv-controllers.validateTvId('item1');
 *
 * @example // ESM usage via slothlet API (inside async function)
 * async function example() {
 *   const { default: slothlet } = await import("@cldmv/slothlet");
 *   const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
 *   api_tv_test.controllers.tv-controllers.validateTvId('item1');
 * }
 *
 * @example // CJS usage via slothlet API (top-level)
 * let slothlet;
 * (async () => {
 *   ({ slothlet } = await import("@cldmv/slothlet"));
 *   const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
 *   api_tv_test.controllers.tv-controllers.validateTvId('item1');
 * })();
 *
 * @example // CJS usage via slothlet API (inside async function)
 * const slothlet = require("@cldmv/slothlet");
 * const api_tv_test = await slothlet({ dir: './api_tests/api_tv_test' });
 * api_tv_test.controllers.tv-controllers.validateTvId('item1');
 */
export function validateTvId(tvId) {
	return typeof tvId === "string" && tvId.startsWith("tv");
}

/**
 * Subfolder TV Controllers proxy - has both default export (proxy) and named exports.
 */
const SubfolderControllers = new Proxy(
	{},
	{
		get(target, prop) {
			if (process.env.DEBUG_PROXY === "1" || process.env.DEBUG_PROXY === "true")
				console.log(`🔍 Subfolder Proxy get called with prop: "${String(prop)}" (type: ${typeof prop})`);

			// First check if the property exists on the target (for attached named exports)
			if (prop in target) {
				return target[prop];
			}

			// Handle numeric indices (0, 1, 2, 3 -> tv1, tv2, tv3, tv4)
			if (typeof prop === "string" && /^\d+$/.test(prop)) {
				const index = parseInt(prop);
				const tvId = `tv${index + 1}`; // Convert 0->tv1, 1->tv2, etc.
				return new SubfolderTVController(tvId);
			}

			// Handle direct TV IDs (tv1, tv2, etc.)
			if (typeof prop === "string" && prop.startsWith("tv")) {
				return new SubfolderTVController(prop);
			}

			// Return undefined for invalid properties
			return undefined;
		}
	}
);

if (process.env.DEBUG_PROXY === "1" || process.env.DEBUG_PROXY === "true")
	console.log("🏗️ SubfolderControllers proxy created during module initialization");

/**
 * Default export of SubfolderControllers proxy.
 * @default
 */
export default SubfolderControllers;

