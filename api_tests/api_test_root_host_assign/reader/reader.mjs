/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: api_tests/api_test_root_host_assign/reader/reader.mjs
 *	@Date: 2026-11-16T00:59:40-08:00 (1794819580)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:29:31-08:00 (1795868971)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Reads, lists, serializes, writes and calls what the host assigned on the api root and on a module's node.
 * @module api_test_root_host_assign/reader
 */

import { self } from "@cldmv/slothlet/runtime";

/**
 * Run a check, answering what it returned, or the code of what it threw.
 * @param {function(): *} check - The check.
 * @returns {*} Its answer, or `{ threw }`.
 */
function answer(check) {
	try {
		return check();
	} catch (error) {
		return { threw: error?.code ?? error?.name ?? "threw" };
	}
}

/**
 * Every route to the object at `self.<path>`.
 * @param {string} path - `ownNothing` or `nested.ownNothing`.
 * @returns {Record<string, *>} Each route's answer.
 */
export function routes(path) {
	const at = () => path.split(".").reduce((node, key) => node[key], self);
	return {
		read: answer(() => at().a),
		keys: answer(() => Object.keys(at())),
		forIn: answer(() => {
			const keys = [];
			for (const key in at()) keys.push(key);
			return keys;
		}),
		json: answer(() => JSON.stringify(at())),
		write: answer(() => {
			at().a = 9;
			return "wrote";
		})
	};
}

/**
 * Call the function the host assigned at `self.ownFn`.
 * @returns {*} What it returned, or `{ threw }`.
 */
export function callFn() {
	return answer(() => self.ownFn());
}
