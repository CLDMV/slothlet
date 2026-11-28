/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: api_tests/api_test_plain_node_named_compile/api/late/probe.mjs
 *	@Date: 2026-11-17T08:00:00-08:00 (1794931200)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:29:10-08:00 (1795868950)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A module file that, while the test's gate is set, publishes the name it loads under (tagged with the
 * instance's id) and stays loading until the test has tried its compiles under that name.
 * @module api_test_plain_node_named_compile.api.late.probe
 */
const gate = globalThis[Symbol.for("slothlet.test.plainNamedCompile")];
if (gate) {
	gate.name = import.meta.url;
	gate.loading();
	await gate.done;
}

/**
 * Whether the file finished loading.
 * @returns {boolean} True.
 * @public
 * @example
 * api.again.probe.loaded(); // true
 */
export function loaded() {
	return true;
}
