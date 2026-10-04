/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_lifecycle_gate/shutdown.mjs
 *	@Date: 2026-09-28T22:30:00-07:00 (1790659800)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-03 20:02:44 -07:00 (1791082964)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Fixture for #529: the user's own root `shutdown` (a contribution to the default
 * `shutdown` routine), run by the root `api.shutdown()` teardown.
 * @module api_test_lifecycle_gate.shutdown
 */

/**
 * Record that the user's shutdown ran.
 * @returns {void}
 */
export default function shutdown() {
	(globalThis.__slothletLifecycleGateLog ??= []).push("user:shutdown");
}
