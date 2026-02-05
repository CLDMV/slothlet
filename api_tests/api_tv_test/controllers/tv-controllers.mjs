/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_tv_test/controllers/tv-controllers.mjs
 *	@Date: 2025-11-04T20:54:38-08:00 (1762318478)
 *	@Author: Nate Hyson <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Hyson <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-02-04 20:40:15 -08:00 (1770266415)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
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
export function getControllerCount() {
	return 4;
}

/**
 * Helper function to validate TV ID.
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

