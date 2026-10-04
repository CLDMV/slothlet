/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_restart/shutdown.mjs
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
 * @fileoverview restart() fixture (#504): the user's own root `shutdown`, which a restart's teardown
 * must run — also when the restart was triggered by a module.
 * @module api_test_restart.shutdown
 */

/**
 * Record that the user's root shutdown ran.
 * @returns {void}
 */
export default function shutdown() {
	const state = (globalThis.__slothletRestartFixture ??= { imports: 0, shutdowns: [] });
	(state.userShutdowns ??= []).push(state.imports);
}
