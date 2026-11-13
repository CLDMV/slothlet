/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_api_node_default_data/writer/writer.mjs
 *	@Date: 2026-11-13T12:00:00-08:00 (1794600000)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-13T12:00:00-08:00 (1794600000)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Reads and changes another module's built-in data through `self`. The rules give it write rights on the modules it reads.
 * @module api_test_api_node_default_data/writer
 */

import { self } from "@cldmv/slothlet/runtime";

/**
 * Run a check, answering what it returned, or the code (or name) of what it threw.
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
 * Each way of reaching the object a collection holds, by the collection's kind.
 * @type {Record<string, Record<string, function(*): object>>}
 */
const ROUTES = {
	map: {
		get: (node) => node.get("one"),
		values: (node) => node.values().next().value,
		entries: (node) => node.entries().next().value[1],
		iterate: (node) => [...node][0][1],
		forOf: (node) => {
			for (const [, value] of node) return value;
		},
		forEach: (node) => {
			let found;
			node.forEach((value) => (found = value));
			return found;
		}
	},
	set: {
		values: (node) => node.values().next().value,
		entries: (node) => node.entries().next().value[1],
		iterate: (node) => [...node][0],
		forEach: (node) => {
			let found;
			node.forEach((value) => (found = value));
			return found;
		}
	},
	list: {
		index: (node) => node[0],
		at: (node) => node.at(0),
		iterate: (node) => [...node][0],
		forEach: (node) => {
			let found;
			node.forEach((value) => (found = value));
			return found;
		},
		find: (node) => node.find(() => true)
	},
	object: {
		member: (node) => node.one,
		values: (node) => Object.values(node)[0]
	}
};

/**
 * Write `n` of the object a collection of another module holds, reached one way.
 * @param {string} module - The module's api name.
 * @param {string} key - The collection's key.
 * @param {string} kind - The collection's kind: `map`, `set`, `list` or `object`.
 * @param {string} route - How the object is reached.
 * @param {number} value - The value written.
 * @returns {*} `{ ok: n read back }`, or `{ threw }`.
 */
export const write = (module, key, kind, route, value) =>
	answer(() => {
		const held = ROUTES[kind][route](self[module][key]);
		held.n = value;
		return { ok: held.n };
	});

/**
 * Each way of changing a map, a set or a date with its own methods.
 * @type {Record<string, function(*): *>}
 */
const CHANGES = {
	mapSet: (node) => node.set("added", 1).size,
	mapDelete: (node) => node.delete("one"),
	mapClear: (node) => node.clear(),
	setAdd: (node) => node.add("added").size,
	setDelete: (node) => node.delete([...node][0]),
	setClear: (node) => node.clear(),
	dateSet: (node) => node.setTime(99)
};

/**
 * Change another module's map, set or date with one of its own methods.
 * @param {string} module - The module's api name.
 * @param {string} key - The object's key.
 * @param {string} how - The change, a key of `CHANGES`.
 * @returns {*} `{ ok: what the method returned }`, or `{ threw }`.
 */
export const change = (module, key, how) => answer(() => ({ ok: CHANGES[how](self[module][key]) ?? null }));

/**
 * Read members of another module's node.
 * @param {string} module - The module's api name.
 * @param {string} key - The node's key.
 * @param {string[]} members - The members read.
 * @returns {object} Each member's answer.
 */
export const read = (module, key, members) => {
	const out = {};
	for (const member of members)
		out[member] = answer(() => {
			const value = self[module][key][member];
			return value !== null && typeof value === "object" ? { object: JSON.stringify(value) } : value;
		});
	return out;
};

/**
 * How another module's node answers the language's own questions.
 * @param {string} module - The module's api name.
 * @param {string} key - The node's key.
 * @returns {object} The answers.
 */
export const asks = (module, key) => {
	const node = self[module][key];
	return {
		name: answer(() => node.name),
		length: answer(() => node.length),
		toString: answer(() => node.toString()),
		string: answer(() => String(node)),
		tag: answer(() => Object.prototype.toString.call(node))
	};
};

/**
 * How another module's data is listed and serialized.
 * @param {string} module - The module's api name.
 * @param {string} key - The node's key.
 * @returns {object} The answers.
 */
export const listings = (module, key) => {
	const node = self[module][key];
	return {
		keys: answer(() => Object.keys(node)),
		spread: answer(() => Object.keys({ ...node })),
		json: answer(() => JSON.stringify(node)),
		clone: answer(() => JSON.stringify(structuredClone(node))),
		entries: answer(() => Object.entries(node).map(([member]) => member))
	};
};
