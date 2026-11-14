/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_fast_package_frame/api/sup/sup.mjs
 *	@Date: 2026-11-13T08:00:00-08:00 (1794585600)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-13T08:00:00-08:00 (1794585600)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A module that runs what the bag hands out, and has the package call the vault for its own code.
 * @module api_test_fast_package_frame.sup
 * @memberof module:api_test_fast_package_frame
 */
import { self } from "@cldmv/slothlet/runtime";
import { descend } from "callback-walker";

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
 * Run the bag's function that goes through the package.
 * @function runViaPackage
 * @memberof module:api_test_fast_package_frame.sup
 * @param {number} depth - How deep the package recurses.
 * @returns {Promise<string>} What it answered, or the code of the refusal.
 * @example
 * await api.sup.runViaPackage(5); // "SECRET"
 */
export const runViaPackage = (depth) => attempt(async () => (await self.bag.viaPackage(depth))());

/**
 * Run the bag's function that calls the vault itself.
 * @function runDirect
 * @memberof module:api_test_fast_package_frame.sup
 * @returns {Promise<string>} What it answered, or the code of the refusal.
 * @example
 * await api.sup.runDirect(); // "SECRET"
 */
export const runDirect = () => attempt(async () => (await self.bag.direct())());

/**
 * Have the package call the vault's node for this module's own code.
 * @function own
 * @memberof module:api_test_fast_package_frame.sup
 * @param {number} depth - How deep the package recurses.
 * @returns {Promise<string>} What it answered, or the code of the refusal.
 * @example
 * await api.sup.own(5); // "SECRET"
 */
export const own = (depth) => attempt(async () => descend(depth, self.vault.get));
