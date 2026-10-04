/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_restart/factory/widget.mjs
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
 * @fileoverview restart() fixture (#504): a constructible default export stamped with the emitter
 * generation of the import that defined it.
 * @module api_test_restart.factory.widget
 */

const state = (globalThis.__slothletRestartFixture ??= { imports: 0, shutdowns: [] });

/**
 * A constructor function whose instances record the conn generation current at construction.
 * @returns {void}
 */
export default function Widget() {
	this.generation = state.imports;
}
