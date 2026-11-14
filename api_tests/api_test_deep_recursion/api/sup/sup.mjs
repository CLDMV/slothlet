/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_deep_recursion/api/sup/sup.mjs
 *	@Date: 2026-11-12T23:07:50-08:00 (1794553670)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-12T23:23:15-08:00 (1794554595)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A module that calls the vault from the bottom of a deep recursion after an `await`.
 * @module api_test_deep_recursion.sup
 * @memberof module:api_test_deep_recursion
 */
import { self } from "@cldmv/slothlet/runtime";
import { descend } from "deep-walker";

/**
 * Recurse in this file's own code.
 * @param {number} depth - How many times to recurse first.
 * @param {Function} callback - What to call at the bottom.
 * @returns {*} What the callback returns.
 */
function descendHere(depth, callback) {
	return depth > 0 ? descendHere(depth - 1, callback) : callback();
}

/**
 * Give back what a function returns, or the code of the error it threw.
 * @param {Function} run - The function.
 * @returns {*} The outcome.
 */
function attempt(run) {
	try {
		return run();
	} catch (error) {
		return error.code ?? error.name;
	}
}

/**
 * After an `await`, have the package call the vault's node from `depth` frames of its own.
 * @param {number} depth - How deep the package recurses.
 * @returns {Promise<string>} The vault's value, or the error's code.
 * @example
 * await api.sup.viaPackage(60);
 */
export async function viaPackage(depth) {
	await null;
	return attempt(() => descend(depth, self.vault.get));
}

/**
 * After an `await`, call the vault's node from `depth` frames of this file's own.
 * @param {number} depth - How deep to recurse.
 * @returns {Promise<string>} The vault's value, or the error's code.
 * @example
 * await api.sup.own(60);
 */
export async function own(depth) {
	await null;
	return attempt(() => descendHere(depth, self.vault.get));
}

/**
 * Wait for a promise the caller holds, so this call is waiting while the caller does something else.
 * @param {Promise<*>} gate - What to wait for.
 * @returns {Promise<string>} `"done"`.
 * @example
 * await api.sup.wait(gate);
 */
export async function wait(gate) {
	await gate;
	return "done";
}
