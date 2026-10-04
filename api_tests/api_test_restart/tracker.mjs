/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_restart/tracker.mjs
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
 * @fileoverview restart() fixture (#504): a shutdown routine contributor that records which import
 * generation was torn down.
 * @module api_test_restart.tracker
 */

const state = (globalThis.__slothletRestartFixture ??= { imports: 0, shutdowns: [] });
const generation = (state.trackerImports = (state.trackerImports ?? 0) + 1);

/**
 * Shutdown routine: record this module's generation.
 * @returns {void}
 */
export function shutdown() {
	state.shutdowns.push(generation);
	if (state.throwOnShutdown) throw new Error("tracker shutdown failure");
}
