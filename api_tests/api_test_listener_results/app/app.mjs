/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_listener_results/app/app.mjs
 *	@Date: 2026-11-08T15:47:43-08:00 (1794181663)
 *	@Author: Shinrai
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-09T21:02:19-08:00 (1794286939)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A module that emits events. The rules allow it to read the vault.
 */

import { self } from "@cldmv/slothlet/runtime";

/**
 * Emit an event from inside this module.
 * @param {string} eventName - Event to emit.
 * @returns {Promise<void>} Resolves once every listener has settled.
 */
export async function fire(eventName) {
	await self.slothlet.event.emit(eventName, { n: 1 });
}
