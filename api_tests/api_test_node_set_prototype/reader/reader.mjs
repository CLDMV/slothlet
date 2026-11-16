/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_node_set_prototype/reader/reader.mjs
 *	@Date: 2026-11-15T11:54:55-08:00 (1794772495)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-16T00:41:12-08:00 (1794818472)
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
 * The prototype a node reports to this module, any number of links up.
 * @param {string} path - The node's path.
 * @param {number} [links=1] - How many links up.
 * @returns {object|null} The prototype.
 */
function prototypeOf(path, links = 1) {
	let value = at(path);
	for (let i = 0; i < links; i++) value = Object.getPrototypeOf(value);
	return value;
}

/**
 * Read a member through a node, as this leaf.
 * @param {string} path - The node's path.
 * @param {string} name - The member's name.
 * @param {number} [links=0] - Read it from the prototype the node reports, this many links up, rather than the node.
 * @returns {*} The member, or `{ threw: code }` when the read was refused.
 */
export function read(path, name, links = 0) {
	try {
		return prototypeOf(path, links)[name];
	} catch (error) {
		return { threw: error?.code ?? error?.name ?? "threw" };
	}
}

/**
 * Read a member through a node, as another leaf of the same module.
 * @param {string} path - The node's path.
 * @param {string} name - The member's name.
 * @param {number} [links=0] - Read it from the prototype the node reports, this many links up, rather than the node.
 * @returns {*} The member, or `{ threw: code }` when the read was refused.
 */
export function peek(path, name, links = 0) {
	try {
		return prototypeOf(path, links)[name];
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

/**
 * How a read of a member is refused: through the node, or from the prototype the node reports.
 * @param {string} path - The node's path.
 * @param {string} name - The member's name.
 * @param {number} links - `0` for the node, or how many links up its prototypes.
 * @returns {{code: string, message: string}|{read: *}} The refusal, or what was read.
 */
export function refusal(path, name, links) {
	try {
		return { read: prototypeOf(path, links)[name] };
	} catch (error) {
		return { code: error?.code ?? error?.name, message: String(error?.message) };
	}
}

/**
 * What the prototype a node reports to this module lists, and whether it is the given object.
 * @param {string} path - The node's path.
 * @param {object} prototype - The object the node was given.
 * @param {string[]} names - Names to ask for one by one.
 * @returns {object} What it shows.
 */
export function listed(path, prototype, names) {
	try {
		const node = at(path);
		const view = Object.getPrototypeOf(node);
		const own = Object.keys(node);
		const forIn = [];
		for (const name in node) if (!own.includes(name)) forIn.push(name);
		const viewForIn = [];
		for (const name in view) viewForIn.push(name);
		return {
			same: view === prototype,
			stable: view === Object.getPrototypeOf(node) && view === node.__proto__,
			keys: Object.keys(view),
			ownKeys: Reflect.ownKeys(view).filter((key) => typeof key === "string"),
			forIn,
			viewForIn,
			spread: Object.keys({ ...view }),
			json: JSON.stringify(view),
			has: names.map((name) => name in view),
			described: names.map((name) => Object.getOwnPropertyDescriptor(view, name) !== undefined)
		};
	} catch (error) {
		return { threw: error?.code ?? error?.name ?? "threw", message: String(error?.message) };
	}
}

/**
 * Write a member onto the prototype a node reports to this module.
 * @param {string} path - The node's path.
 * @param {string} name - The member's name.
 * @param {*} value - Its value.
 * @returns {string} `"done"`, or the code or name of what it threw.
 */
export function write(path, name, value) {
	try {
		Object.getPrototypeOf(at(path))[name] = value;
		return "done";
	} catch (error) {
		return error?.code ?? error?.name ?? "threw";
	}
}

/**
 * The names the prototype a node reports to this module lists as its own.
 * @param {string} path - The node's path.
 * @returns {string[]|{threw: string}} The names.
 */
export function viewKeys(path) {
	try {
		return Object.keys(Object.getPrototypeOf(at(path)));
	} catch (error) {
		return { threw: error?.code ?? error?.name ?? "threw" };
	}
}

/**
 * What this module lists of the object members a node holds and inherits: `nothing` and `partly` from the prototype the
 * node reports, `ownNothing` and `ownPartly` from the node itself.
 * @param {string} path - The node's path.
 * @returns {object} What it lists, or `{ threw }`.
 */
export function objectListing(path) {
	try {
		const node = at(path);
		const view = Object.getPrototypeOf(node);
		const own = Object.keys(node);
		const forIn = [];
		for (const name in node) if (!own.includes(name)) forIn.push(name);
		const viewForIn = [];
		for (const name in view) viewForIn.push(name);
		return {
			own: own.filter((name) => name.startsWith("own")),
			keys: Object.keys(view),
			ownKeys: Reflect.ownKeys(view).filter((key) => typeof key === "string"),
			forIn,
			viewForIn,
			spread: Object.keys({ ...view }),
			json: JSON.stringify(view),
			has: ["nothing" in view, "partly" in view, "nothing" in node],
			partly: [view.partly.a, Object.keys(view.partly)]
		};
	} catch (error) {
		return { threw: error?.code ?? error?.name ?? "threw", message: String(error?.message) };
	}
}
