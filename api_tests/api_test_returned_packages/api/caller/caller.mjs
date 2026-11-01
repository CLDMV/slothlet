/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_returned_packages/api/caller/caller.mjs
 *	@Date: 2026-10-27T07:00:18-07:00 (1793109618)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-27T07:00:18-07:00 (1793109618)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Fixture (#597): a module calling a plugin with a callback, so the plugin's call is read for code the
 * caller handed it.
 * @module api_test_returned_packages.caller
 */
import { self } from "@cldmv/slothlet/runtime";

/**
 * Have the plugin read the vault's secret, handing it a callback it does not run.
 * @returns {Promise<*>} The secret, or the error code the read was refused with.
 */
export async function viaPlugin() {
	try {
		return await self.plug2.leaf.read(() => "unused");
	} catch (error) {
		return error.code ?? error.message;
	}
}
