/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_closed_listing/lister/lister.mjs
 *	@Date: 2026-11-16T00:57:15-08:00 (1794819435)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-16T01:10:43-08:00 (1794820243)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A module listing another module's closed nodes and the closed api root through `self`.
 * @module api_test_closed_listing/lister
 */

import { self } from "@cldmv/slothlet/runtime";

/**
 * Run a read, answering what it gave or the code of what it threw.
 * @param {function(): *} read - The read.
 * @returns {*} What it gave, or `{ threw: code }`.
 */
const attempt = (read) => {
	try {
		return read();
	} catch (error) {
		return { threw: error?.code ?? error?.name ?? "threw" };
	}
};

/**
 * The node at a dotted path of `self`, or of the api the host handed in; the root itself for an empty path.
 * @param {string} path - The path.
 * @param {object} [given] - The api the host handed in, read instead of `self`.
 * @returns {*} The node.
 */
const at = (path, given) => (path ? path.split(".") : []).reduce((node, key) => node[key], given ?? self);

/**
 * What this module lists of a node: each listing, kept to the names asked about.
 * @param {string} path - The node's path; empty for the root.
 * @param {string[]} names - The names to keep.
 * @param {object} [given] - The api the host handed in, read instead of `self`.
 * @returns {object} Each listing, or `{ threw }` where it threw.
 */
export function listing(path, names, given) {
	const node = at(path, given);
	const pick = (keys) => keys.filter((key) => names.includes(key));
	return {
		keys: attempt(() => pick(Object.keys(node))),
		forIn: attempt(() => {
			const found = [];
			for (const name in node) found.push(name);
			return pick(found);
		}),
		ownKeys: attempt(() => pick(Reflect.ownKeys(node))),
		closed: attempt(() => [Object.isExtensible(node), Object.isSealed(node), Object.isFrozen(node)])
	};
}

/**
 * What this module is described of a member, and what reading it gives.
 * @param {string} path - The node's path; empty for the root.
 * @param {string} name - The member's name.
 * @param {object} [given] - The api the host handed in, read instead of `self`.
 * @returns {{described: *, read: *}} The description's kind and value kind, and the read.
 */
export function member(path, name, given) {
	const node = at(path, given);
	return {
		described: attempt(() => {
			const descriptor = Object.getOwnPropertyDescriptor(node, name);
			return descriptor === undefined ? undefined : { enumerable: descriptor.enumerable, value: typeof descriptor.value };
		}),
		read: attempt(() => {
			const value = node[name];
			return value === null || (typeof value !== "object" && typeof value !== "function") ? value : typeof value;
		})
	};
}

/**
 * Read a member of what a closed function node describes as its `prototype`.
 * @param {string} path - The node's path.
 * @param {string} name - The member to read.
 * @param {object} [given] - The api the host handed in, read instead of `self`.
 * @returns {*} Its kind, or `{ threw }`.
 */
export function describedPrototypeMember(path, name, given) {
	return attempt(() => typeof Object.getOwnPropertyDescriptor(at(path, given), "prototype").value[name]);
}
