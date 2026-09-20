/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_events/emitter.mjs
 *	@Date: 2026-09-17 00:00:00 -07:00
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-09-17 00:00:00 -07:00
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

import { self } from "@cldmv/slothlet/runtime";

/**
 * Emit an event from inside a module (module-side emit — ungated).
 * @param {string} eventName - Event to emit.
 * @param {*} [payload] - Domain payload.
 * @returns {Promise<void>} Resolves once all listeners have settled.
 */
export async function fire(eventName, payload) {
	await self.slothlet.event.emit(eventName, payload);
}
