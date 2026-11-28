/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_handout_identity_plugin/api/give.mjs
 *	@Date: 2026-11-27T20:30:27-08:00 (1795840227)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-27T20:31:31-08:00 (1795840291)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A leaf of a module added with `api.add()` that hands one of its own functions to a leaf of the root
 * module and compares what comes back (#1026).
 * @module api_test_handout_identity_plugin.give
 */
import { self } from "@cldmv/slothlet/runtime";

/**
 * The function handed out.
 * @returns {string} A marker.
 */
function mine() {
	return "plugin";
}

/**
 * What comes back of `mine` through the root module's `callee.ops.echo` and `callee.ops.pick`.
 * @returns {Promise<{echo: boolean, pick: boolean, runs: string}>} Whether each is `mine` itself, and what the one
 *   from `echo` returns when called.
 */
export async function roundTrip() {
	// Nested in data first: the case that used to come back as a stand-in, and keep `echo` from giving it back too.
	const picked = await self.callee.ops.pick({ inner: { cb: mine } });
	const echoed = await self.callee.ops.echo(mine);
	return { echo: echoed === mine, pick: picked === mine, runs: echoed() };
}

/**
 * The same round trip with a function that reads the vault, which only `callee` may call.
 * @returns {Promise<{echo: boolean, pick: boolean}>} Whether each is the function itself.
 */
export async function vaultTrip() {
	const own = () => self.vault.secret();
	const picked = await self.callee.ops.pick({ inner: { cb: own } });
	const echoed = await self.callee.ops.echo(own);
	return { echo: echoed === own, pick: picked === own };
}
