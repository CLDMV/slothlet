/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_restart/initialize.mjs
 *	@Date: 2026-09-21T01:27:16+00:00 (1789954036)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-03 20:03:08 -07:00 (1791082988)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview restart() fixture (#504): the user's own root `initialize` (default startup routine).
 * @module api_test_restart.initialize
 */

/**
 * Record that the user's root initialize ran.
 * @returns {void}
 */
export default function initialize() {
	const state = (globalThis.__slothletRestartFixture ??= { imports: 0, shutdowns: [] });
	(state.userInitializes ??= []).push(state.imports);
}
