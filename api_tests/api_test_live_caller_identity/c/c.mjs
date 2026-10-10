/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_live_caller_identity/c/c.mjs
 *	@Date: 2026-10-09T18:00:00-07:00 (1791594000)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-09T18:00:00-07:00 (1791594000)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Reports who called it, directly and through a `lockCaller.caller` pin.
 * @module api_test_live_caller_identity.c
 */
import { self } from "@cldmv/slothlet/runtime";

/**
 * The api path of this leaf's caller.
 * @returns {string|null} `metadata.caller()`'s api path, or null for the host.
 */
export function probe() {
	return self.slothlet.metadata.caller()?.apiPath ?? null;
}

/**
 * Pin a callback to this leaf's caller and report who the callback runs as.
 * @returns {string|null} The api path the pinned callback runs as, or null for the host.
 */
export function pinCaller() {
	const pinned = self.slothlet.lockCaller.caller(() => self.slothlet.metadata.self()?.apiPath ?? null);
	try {
		return pinned();
	} catch (error) {
		return error.code;
	}
}
