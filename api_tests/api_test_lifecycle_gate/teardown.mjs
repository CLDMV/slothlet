/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_lifecycle_gate/teardown.mjs
 *	@Date: 2026-09-28T22:30:00-07:00 (1790659800)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-09-28 22:30:00 -07:00 (1790659800)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Fixture for #529: a root contribution to a renamed `mode: "shutdown"` routine.
 * @module api_test_lifecycle_gate.teardown
 */

/**
 * Record that the renamed shutdown-mode routine ran.
 * @returns {void}
 */
export default function teardown() {
	(globalThis.__slothletLifecycleGateLog ??= []).push("user:teardown");
}
