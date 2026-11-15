/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_lazy_unloaded_listing/reader.mjs
 *	@Date: 2026-11-15T10:00:00-08:00 (1794765600)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-15T10:00:00-08:00 (1794765600)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

import { self } from "@cldmv/slothlet/runtime";

/**
 * Read a dotted path off `self`.
 * @param {string} path - The path; empty for the root.
 * @returns {*} What is there.
 */
function at(path) {
	let node = self;
	for (const key of path ? path.split(".") : []) node = node[key];
	return node;
}

/**
 * The names a node lists, and which of `names` it says it holds.
 * @param {string} path - The node's path; empty for the root.
 * @param {string[]} names - Names to ask `in` about.
 * @returns {{keys: string[], has: boolean[]}} The listing.
 */
export function list(path, names) {
	const node = at(path);
	return { keys: Object.keys(node).sort(), has: names.map((name) => name in node) };
}
