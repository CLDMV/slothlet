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

import { self, context } from "@cldmv/slothlet/runtime";
export async function sleep() {
	await self.connection.ensureConnected();

	if (!context.quiet) context.emitLog("info", "Putting device to sleep...", "power.sleep");

	// Send sleep/standby command
	await self.connection.shell("input keyevent 223"); // KEYCODE_SLEEP
}
