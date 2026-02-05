/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_adb_test/power.mjs
 *	@Date: 2025-10-27T11:28:27-07:00 (1761589707)
 *	@Author: Nate Hyson <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Hyson <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-02-04 20:40:02 -08:00 (1770266402)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

export async function sleep() {
	await self.connection.ensureConnected();

	if (!context.quiet) context.emitLog("info", "Putting device to sleep...", "power.sleep");

	// Send sleep/standby command
	await self.connection.shell("input keyevent 223"); // KEYCODE_SLEEP
}
