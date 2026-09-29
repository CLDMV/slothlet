/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_events/strategist.mjs
 *	@Date: 2026-09-28T21:34:06-07:00 (1790656446)
 *	@Author: Shinrai <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Shinrai <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-09-28 21:34:06 -07:00 (1790656446)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

import { self } from "@cldmv/slothlet/runtime";

/**
 * Attempt the host-only `event.strategy` from a MODULE context. Returns the outcome instead of throwing.
 * @returns {{ ok: boolean, code?: string }} `ok:true` if permitted (it should not be); otherwise the error code.
 */
export function attemptStrategy() {
	try {
		self.slothlet.event.strategy(null);
		return { ok: true };
	} catch (error) {
		return { ok: false, code: error.code || error.name };
	}
}

/**
 * Attempt the host-only `event.deliver` from a MODULE context. Returns the outcome instead of throwing.
 * @returns {Promise<{ ok: boolean, code?: string }>} `ok:true` if permitted (it should not be); otherwise the error code.
 */
export async function attemptDeliver() {
	try {
		await self.slothlet.event.deliver({}, "x");
		return { ok: true };
	} catch (error) {
		return { ok: false, code: error.code || error.name };
	}
}
