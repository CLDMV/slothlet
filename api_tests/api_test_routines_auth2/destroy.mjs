/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: api_tests/api_test_routines_auth2/destroy.mjs
 *	@Date: 2026-09-08T00:00:00-07:00 (1788850800)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:29:33-08:00 (1795868973)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview `destroy`-mode routine contributor for `api_test_routines_auth2` (#341).
 * @module api_test_routines_auth2.destroy
 * @memberof module:api_test_routines_auth2
 */

/**
 * @function destroy
 * @memberof module:api_test_routines_auth2
 * @returns {void}
 */
export default function destroy() {
	(globalThis.__slothletRoutineLog ??= []).push("auth2:destroy");
}
