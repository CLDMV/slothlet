/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_deep_stack/sup/sup.mjs
 *	@Date: 2026-11-11T22:33:57-08:00 (1794465237)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-12T01:55:55-08:00 (1794477355)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A module that runs the function the bag hands out, and does the same inspection itself.
 * @module api_test_deep_stack.sup
 * @memberof module:api_test_deep_stack
 */
import util from "node:util";
import { self } from "@cldmv/slothlet/runtime";

/**
 * Run the function the bag hands out.
 * @function viaBag
 * @memberof module:api_test_deep_stack.sup
 * @param {number} depth - How many levels the bag nests.
 * @returns {Promise<string>} What the bag's inspection showed, or the code of an error it threw.
 * @example
 * await api.sup.viaBag(40); // "THREW" when the rules deny the bag the vault
 */
export async function viaBag(depth) {
	try {
		const run = await self.bag.deep(depth);
		return run();
	} catch (error) {
		return error.code ?? error.name;
	}
}

/**
 * The same inspection, written in this module.
 * @function own
 * @memberof module:api_test_deep_stack.sup
 * @param {number} depth - How many levels.
 * @returns {string} What the inspection showed.
 * @example
 * api.sup.own(40); // "SECRET" when the rules allow this module the vault
 */
export function own(depth) {
	const inner = {};
	Object.defineProperty(inner, "value", { get: self.vault.get, enumerable: true });
	let outer = inner;
	for (let level = 0; level < depth; level++) outer = { next: outer };
	const shown = util.inspect(outer, { depth: Infinity, getters: true, breakLength: Infinity });
	if (shown.includes("SECRET")) return "SECRET";
	return shown.includes("Inspection threw") ? "THREW" : "OTHER";
}
