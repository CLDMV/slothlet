/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_live_caller_identity/svc/svc.mjs
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
 * @fileoverview A service that accepts a callback; an around hook pins it.
 * @module api_test_live_caller_identity.svc
 */

/**
 * Hand the callback back as received.
 * @param {Function} cb - Callback.
 * @returns {{cb: Function}} The callback, as the service was given it.
 */
export function take(cb) {
	return { cb };
}
