/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_tv_test/proxy-test.mjs
 *	@Date: 2025-11-04T20:54:38-08:00 (1762318478)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-01 20:21:18 -08:00 (1772425278)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Proxy test module for TV Remote testing — tests class instance wrapping.
 * @module api_tv_test.proxyTest
 * @memberof module:api_tv_test
 */

class TVController {
	constructor(tvId) {
		this.tvId = tvId;
		console.log(`📺 TVController created for ${tvId}`);
	}

	powerOn() {
		console.log(`🟢 ${this.tvId} powered on`);
		return `${this.tvId} is now ON`;
	}

	powerOff() {
		console.log(`🔴 ${this.tvId} powered off`);
		return `${this.tvId} is now OFF`;
	}

	getStatus() {
		return `${this.tvId} status: active`;
	}
}

/**
 * LG TV Controllers proxy object that provides dynamic TV controller access.
 * This is the ONLY export to test pure proxy behavior.
 */
const LGTVControllers = new Proxy(
	{},
	{
		get(target, prop) {
			if (process.env.DEBUG_PROXY === "1" || process.env.DEBUG_PROXY === "true")
				console.log(`🔍 Proxy get called with prop: "${String(prop)}" (type: ${typeof prop})`);
			// Handle numeric indices (0, 1, 2, 3 -> tv1, tv2, tv3, tv4)
			if (typeof prop === "string" && /^\d+$/.test(prop)) {
				const index = parseInt(prop);
				const tvId = `tv${index + 1}`; // Convert 0->tv1, 1->tv2, etc.
				return new TVController(tvId);
			}

			// Handle direct TV IDs (tv1, tv2, etc.)
			if (typeof prop === "string" && prop.startsWith("tv")) {
				return new TVController(prop);
			}

			// Return undefined for invalid properties
			return undefined;
		}
	}
);

if (process.env.DEBUG_PROXY === "1" || process.env.DEBUG_PROXY === "true")
	console.log("🏗️ LGTVControllers proxy created during module initialization");

/**
 * Default export of LGTVControllers proxy for pure proxy testing.
 * @default
 */
export default LGTVControllers;

