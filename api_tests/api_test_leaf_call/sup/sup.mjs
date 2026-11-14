/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_leaf_call/sup/sup.mjs
 *	@Date: 2026-11-11T22:59:51-08:00 (1794466791)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-12T01:56:53-08:00 (1794477413)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A module that uses the service each way.
 * @module api_test_leaf_call.sup
 * @memberof module:api_test_leaf_call
 */
import { self } from "@cldmv/slothlet/runtime";

/**
 * Run code and report a refusal by its code.
 * @param {function(): *} run - The code.
 * @returns {Promise<*>} What it returned, or the code of the error it threw.
 */
async function attempt(run) {
	try {
		return await run();
	} catch (error) {
		return error.code ?? error.name;
	}
}

/**
 * Use the service each way.
 * @function probe
 * @memberof module:api_test_leaf_call.sup
 * @returns {Promise<{node: string, leafRef: string, boundLeaf: string, inData: string, closure: string}>} What each
 *   way answered, or the code of its refusal.
 * @example
 * await api.sup.probe();
 */
export async function probe() {
	return {
		node: await attempt(() => self.bag.viaLeaf()),
		leafRef: await attempt(async () => (await self.bag.leafRef())()),
		boundLeaf: await attempt(async () => (await self.bag.boundLeaf())()),
		inData: await attempt(async () => (await self.bag.inData()).run()),
		closure: await attempt(async () => (await self.bag.closure())())
	};
}
