/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_null_default/reader.mjs
 *	@Date: 2026-11-15T00:00:00-08:00 (1794729600)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-15T00:00:00-08:00 (1794729600)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Reads, awaits and lists the api through `self`.
 * @module api_test_null_default/reader
 */

import { self } from "@cldmv/slothlet/runtime";

/**
 * The node at a dotted path, from `self`.
 * @param {string} path - The path; empty for the root.
 * @returns {*} The node.
 */
function at(path) {
	let node = self;
	for (const segment of path ? path.split(".") : []) node = node[segment];
	return node;
}

/**
 * A value as a comparable description: null, undefined and the other primitives as themselves, an object or a
 * function by its kind.
 * @param {*} value - The value.
 * @returns {*} Its description.
 */
function described(value) {
	if (value === undefined) return { undefined: true };
	if (value === null || typeof value !== "object") return typeof value === "function" ? { function: true } : value;
	return { object: true };
}

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
 * Read the member at a path.
 * @param {string} path - The path.
 * @returns {*} Its description, or `{ threw }`.
 */
export function read(path) {
	return answer(() => described(at(path)));
}

/**
 * Await the member at a path.
 * @param {string} path - The path.
 * @returns {Promise<*>} What awaiting it gave, or `{ threw }`.
 */
export async function settle(path) {
	try {
		return described(await at(path));
	} catch (error) {
		return { threw: error?.code ?? error?.name ?? "threw" };
	}
}

/**
 * How a node lists, tests and describes one of its members.
 * @param {string} path - The node's path; empty for the root.
 * @param {string} name - The member.
 * @returns {{keys: boolean, has: boolean, described: *}} Whether `Object.keys` lists it, whether `in` finds it, and its
 * descriptor's value (or `{ none: true }`).
 */
export function member(path, name) {
	return answer(() => {
		const node = at(path);
		const descriptor = Object.getOwnPropertyDescriptor(node, name);
		return {
			keys: Object.keys(node).includes(name),
			has: name in node,
			described: descriptor === undefined ? { none: true } : described(descriptor.value)
		};
	});
}
