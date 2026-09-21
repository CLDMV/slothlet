/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_events/probe.mjs
 *	@Date: 2026-09-20 00:00:00 -07:00
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-09-20 00:00:00 -07:00
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

import { self } from "@cldmv/slothlet/runtime";

/**
 * Attempt the host-only `event.resolveLevel` from a MODULE context, so a test can assert a module
 * caller is REFUSED (host-only) rather than answered. Returns the outcome instead of throwing.
 * @param {string|null} subscriberPath - Identity to resolve for.
 * @param {string} eventName - Event name.
 * @returns {{ ok: boolean, level?: string, code?: string }} `ok:true` + the level if permitted (it
 *   should not be for a module caller); otherwise `ok:false` + the error code.
 */
export function attempt(subscriberPath, eventName) {
	try {
		return { ok: true, level: self.slothlet.event.resolveLevel(subscriberPath, eventName) };
	} catch (error) {
		return { ok: false, code: error.code || error.name };
	}
}
