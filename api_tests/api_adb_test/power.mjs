/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_adb_test/power.mjs
 *	@Date: 2025-10-27T11:28:27-07:00 (1761589707)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-08 22:06:50 -07:00 (1773032810)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Power management API module for Android TV Remote - Dummy implementation for testing.
 * @module api_adb_test.power
 * @memberof module:api_adb_test
 */
/**
 * @namespace power
 * @memberof module:api_adb_test
 * @alias module:api_adb_test.power
 */

import { self, context } from "@cldmv/slothlet/runtime";
/**
 * sleep.
 * @returns {Promise.<*>}
 * @example // ESM usage via slothlet API
 * import slothlet from "@cldmv/slothlet";
 * const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 * await api_adb_test.power.sleep();
 *
 * @example // ESM usage via slothlet API (inside async function)
 * async function example() {
 *   const { default: slothlet } = await import("@cldmv/slothlet");
 *   const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 *   await api_adb_test.power.sleep();
 * }
 *
 * @example // CJS usage via slothlet API (top-level)
 * let slothlet;
 * (async () => {
 *   ({ slothlet } = await import("@cldmv/slothlet"));
 *   const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 *   await api_adb_test.power.sleep();
 * })();
 *
 * @example // CJS usage via slothlet API (inside async function)
 * const slothlet = require("@cldmv/slothlet");
 * const api_adb_test = await slothlet({ dir: './api_tests/api_adb_test' });
 * await api_adb_test.power.sleep();
 */
export async function sleep() {
	await self.connection.ensureConnected();

	if (!context.quiet) context.emitLog("info", "Putting device to sleep...", "power.sleep");

	// Send sleep/standby command
	await self.connection.shell("input keyevent 223"); // KEYCODE_SLEEP
}
