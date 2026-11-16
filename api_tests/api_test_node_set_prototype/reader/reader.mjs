/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_node_set_prototype/reader/reader.mjs
 *	@Date: 2026-11-15T11:54:55-08:00 (1794772495)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-15T20:55:17-08:00 (1794804917)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A module that tries to give another module's nodes a prototype through `self`.
 * @module api_test_node_set_prototype/reader
 */

import { self } from "@cldmv/slothlet/runtime";

/**
 * Give one of the base's nodes a prototype.
 * @param {string} which - `"em"`, `"inst"`, `"leaf"`, `"grp"`, `"lay"` or `"ns"`.
 * @returns {string} `"done"`, `"refused"` when it answered false, or the code or name of what it threw.
 */
export function change(which) {
	const nodes = {
		em: () => self.ev.em,
		inst: () => self.ev.inst,
		leaf: () => self.leaf.only,
		grp: () => self.grp,
		lay: () => self.sub.lay,
		ns: () => self.ev
	};
	try {
		return Reflect.setPrototypeOf(nodes[which](), { theirs: true }) ? "done" : "refused";
	} catch (error) {
		return error?.code ?? error?.name ?? "threw";
	}
}

/**
 * The node at a dotted path of `self`.
 * @param {string} path - The path.
 * @returns {*} The node.
 */
const at = (path) => path.split(".").reduce((node, key) => node[key], self);

/**
 * Read a member through a node, as this leaf.
 * @param {string} path - The node's path.
 * @param {string} name - The member's name.
 * @returns {*} The member, or `{ threw: code }` when the read was refused.
 */
export function read(path, name) {
	try {
		return at(path)[name];
	} catch (error) {
		return { threw: error?.code ?? error?.name ?? "threw" };
	}
}

/**
 * Read a member through a node, as another leaf of the same module.
 * @param {string} path - The node's path.
 * @param {string} name - The member's name.
 * @returns {*} The member, or `{ threw: code }` when the read was refused.
 */
export function peek(path, name) {
	try {
		return at(path)[name];
	} catch (error) {
		return { threw: error?.code ?? error?.name ?? "threw" };
	}
}

/**
 * Call a member through a node.
 * @param {string} path - The node's path.
 * @param {string} name - The member's name.
 * @returns {*} What it answered, or `{ threw: code }`.
 */
export function call(path, name) {
	try {
		return at(path)[name]();
	} catch (error) {
		return { threw: error?.code ?? error?.name ?? "threw" };
	}
}

/**
 * What a node shows this module of a member: whether it is `in` the node, among its own keys, and whether the node
 * reports the given prototype.
 * @param {string} path - The node's path.
 * @param {string} name - The member's name.
 * @param {object|null} prototype - The prototype to compare with.
 * @returns {{has: boolean, own: boolean, same: boolean}|{threw: string}} What it shows.
 */
export function shown(path, name, prototype) {
	try {
		const node = at(path);
		return { has: name in node, own: Reflect.ownKeys(node).includes(name), same: Object.getPrototypeOf(node) === prototype };
	} catch (error) {
		return { threw: error?.code ?? error?.name ?? "threw" };
	}
}
