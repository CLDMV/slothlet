/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_node_type_read/reader.mjs
 *	@Date: 2026-11-15T10:33:27-08:00 (1794767607)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-15T12:40:53-08:00 (1794775253)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

import { self } from "@cldmv/slothlet/runtime";

/** What this module read before `d` loaded, by path. */
const held = {};

/**
 * Walk a dotted path through `self`.
 * @param {string} path - The path.
 * @returns {*} What the walk reads.
 */
function walk(path) {
	return path.split(".").reduce((node, key) => node[key], self);
}

/**
 * Read a node through `self` and keep it, without reading its type.
 * @param {string} path - The node's path.
 * @returns {boolean} True.
 */
export function take(path) {
	held[path] = walk(path);
	return true;
}

/**
 * The `__type` of a node, read fresh or off the node kept earlier.
 * @param {string} path - The node's path.
 * @param {boolean} [kept=false] - Read the node kept by `take` instead.
 * @returns {string|{threw: string}} The type, or the code it was refused with.
 */
export function type(path, kept = false) {
	try {
		const answer = (kept ? held[path] : walk(path)).__type;
		return typeof answer === "symbol" ? answer.description : answer;
	} catch (error) {
		return { threw: error?.code ?? error?.name ?? "threw" };
	}
}
