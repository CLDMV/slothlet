/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_routines_auth1/initialize.mjs
 *	@Date: 2026-09-08T00:00:00-07:00 (1788850800)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-03T22:28:01-07:00 (1791091681)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview First of two independently-mounted "auth" contributors (#341) — both this and
 * `api_test_routines_auth2` mount at the same `["auth"]` namespace and both export `initialize`,
 * validating that a shared-slug collision stacks every contributor instead of dropping all but one.
 * @module api_test_routines_auth1.initialize
 * @memberof module:api_test_routines_auth1
 */

/**
 * @function initialize
 * @memberof module:api_test_routines_auth1
 * @returns {void}
 */
export default function initialize() {
	(globalThis.__slothletRoutineLog ??= []).push("auth1:initialize");
}
