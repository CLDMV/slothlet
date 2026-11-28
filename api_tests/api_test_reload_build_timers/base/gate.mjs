/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: api_tests/api_test_reload_build_timers/base/gate.mjs
 *	@Date: 2026-11-21T12:54:54-08:00 (1795294494)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:29:20-08:00 (1795868960)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Fixture: holds an eager build at this file's import while the test keeps the gate shut, so code
 * scheduled meanwhile runs while the build is still under way.
 * @module api_test_reload_build_timers.gate
 */

const gate = globalThis.__slothletReloadBuildGate;
if (gate?.shut) {
	gate.entered();
	await gate.opened;
}

/**
 * Whether the gate file loaded.
 * @returns {boolean} Always true.
 */
export function ready() {
	return true;
}
